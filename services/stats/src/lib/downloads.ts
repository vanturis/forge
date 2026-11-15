// What counts as a download: a person fetching an installer for a new installation.
//
//   windows  FORGE-Setup.exe (release "installer"), counted by GitHub. Only people fetch it: the app never
//            does, and every official link (this site, the README) leads to it.
//   macos    a .dmg from the download page (/dl/macos-arm64, /dl/macos-x64), counted here
//   linux    the AppImage or .deb from the download page (/dl/linux-appimage, /dl/linux-deb), counted here
//   script   /install.sh fetched by curl or wget: the install command of macOS and Linux
//
// Not GitHub's numbers of the other release files: installed apps fetch FORGE_<v>_x64-setup.exe (update to
// another runtime, repair), FORGE Setup fetches it once per installation, the updates of macOS and Linux
// are the same .app.tar.gz and AppImage the install command takes, and every file of a release is fetched
// once by a machine right after it was published.

/** Repository whose releases carry the FORGE installers. */
const REPO = "vanturis/forge";
/** Release that always holds the current FORGE-Setup.exe (.github/workflows/setup.yml). */
const SETUP_RELEASE = "installer";
const SETUP = /^FORGE-Setup\.exe$/i;

export const DOWNLOAD_KINDS = ["windows", "macos", "linux", "script"] as const;
export type DownloadKind = (typeof DOWNLOAD_KINDS)[number];

export interface Downloads {
  total: number;
  kinds: Record<DownloadKind, number>;
}

/** One upload of FORGE-Setup.exe. A new build replaces the file, and GitHub starts its count again at 0. */
export interface SetupAsset {
  id: number;
  name: string;
  downloads: number;
  createdAt: string | null;
}

type Asset = { id?: number; name?: string; download_count?: number; created_at?: string };
type Release = { assets?: Asset[] };

export function setupAssets(release: Release): SetupAsset[] {
  return (release.assets ?? []).flatMap((a) =>
    typeof a.id === "number" && a.name && SETUP.test(a.name) ? [{ id: a.id, name: a.name, downloads: a.download_count ?? 0, createdAt: a.created_at ?? null }] : [],
  );
}

/** FORGE-Setup.exe with its download count, from the GitHub API without login. */
export async function fetchSetupAssets(fetchFn: typeof fetch = fetch): Promise<SetupAsset[]> {
  const res = await fetchFn(`https://api.github.com/repos/${REPO}/releases/tags/${SETUP_RELEASE}`, {
    headers: { Accept: "application/vnd.github+json", "User-Agent": "forge-stats" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new Error(`GitHub antwortet mit HTTP ${res.status}`);
  return setupAssets((await res.json()) as Release);
}

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|monitor|headless|lighthouse|scanner/i;

/** A browser a person sits at; crawlers and link previews follow download links too. */
export function isBrowser(userAgent: string | null): boolean {
  return !!userAgent && /^Mozilla\//.test(userAgent) && !BOT.test(userAgent);
}

/** `curl … | sh` and its wget counterpart; a browser opening /install.sh only reads the script. */
export function isInstallCommand(userAgent: string | null): boolean {
  return /^(curl|wget)\//i.test(userAgent ?? "");
}

export const MAX_DOWNLOADS_PER_IP_PER_DAY = 6;

/** Counted downloads per hashed IP and UTC day, in memory only: reloading a download link adds nothing. */
export class DownloadLimiter {
  private day = "";
  private readonly seen = new Map<string, number>();

  constructor(
    private readonly max = MAX_DOWNLOADS_PER_IP_PER_DAY,
    private readonly now: () => number = Date.now,
  ) {}

  /** False when that address already reached the limit today. */
  tryAdd(ipHash: string): boolean {
    const today = new Date(this.now()).toISOString().slice(0, 10);
    if (today !== this.day) {
      this.day = today;
      this.seen.clear();
    }
    const n = this.seen.get(ipHash) ?? 0;
    if (n >= this.max) return false;
    this.seen.set(ipHash, n + 1);
    return true;
  }
}

export const downloadLimiter = new DownloadLimiter();
