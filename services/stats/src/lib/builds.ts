import { getReleases, type GithubRelease } from "./releases";

export type Os = "windows" | "macos" | "linux";

/** A file of the newest release that has builds for macOS or Linux, for the manual download. */
export interface BuildFile {
  /** name in the counted download link /dl/<key> */
  key: string;
  label: string;
  url: string;
}

export interface Builds {
  /** version of the newest release with macOS builds, null while there is none */
  macos: { version: string; files: BuildFile[] } | null;
  linux: { version: string; files: BuildFile[] } | null;
}

type Release = Pick<GithubRelease, "tag_name" | "draft" | "prerelease" | "assets">;

/** File names of the release workflow (ADR 0014) and how the download page names them. */
const FILES: Record<"macos" | "linux", { key: string; pattern: RegExp; label: string }[]> = {
  macos: [
    { key: "macos-arm64", pattern: /^FORGE_[^_]+_darwin-arm64\.dmg$/, label: "Apple silicon (.dmg)" },
    { key: "macos-x64", pattern: /^FORGE_[^_]+_darwin-x64\.dmg$/, label: "Intel (.dmg)" },
  ],
  linux: [
    { key: "linux-appimage", pattern: /^FORGE_[^_]+_linux-x64\.AppImage$/, label: "AppImage" },
    { key: "linux-deb", pattern: /^FORGE_[^_]+_linux-x64\.deb$/, label: "Debian, Ubuntu (.deb)" },
  ],
};

/** The system a counted download link /dl/<key> belongs to; null for an unknown key. */
export function buildFileOs(key: string): "macos" | "linux" | null {
  return (["macos", "linux"] as const).find((os) => FILES[os].some((f) => f.key === key)) ?? null;
}

function newest(releases: Release[], os: "macos" | "linux"): Builds["macos"] {
  for (const r of releases) {
    // Pre-releases are dev builds (and the FORGE Setup release); new installations get the stable one.
    if (r.draft || r.prerelease) continue;
    const files = FILES[os].flatMap(({ key, pattern, label }) => {
      const a = r.assets?.find((x) => x.name && pattern.test(x.name));
      return a?.browser_download_url ? [{ key, label, url: a.browser_download_url }] : [];
    });
    if (files.length) return { version: (r.tag_name ?? "").replace(/^v/, ""), files };
  }
  return null;
}

export function findBuilds(releases: Release[]): Builds {
  return { macos: newest(releases, "macos"), linux: newest(releases, "linux") };
}

/** The newest macOS and Linux builds from the releases on GitHub (lib/releases.ts, at most 15 minutes old). */
export async function latestBuilds(): Promise<Builds> {
  return findBuilds(await getReleases());
}

/** The visitor's system from the client hint Chrome and Edge send, else from the user agent; null on phones. */
export function detectOs(platformHint: string | null, userAgent: string | null): Os | null {
  const hint = platformHint?.replace(/"/g, "").toLowerCase();
  if (hint === "windows") return "windows";
  if (hint === "macos") return "macos";
  if (hint === "linux" || hint === "chrome os") return "linux";
  if (hint === "android" || hint === "ios") return null;
  const ua = userAgent ?? "";
  if (/Android|iPhone|iPad|iPod/i.test(ua)) return null;
  if (/Windows/i.test(ua)) return "windows";
  if (/Macintosh|Mac OS X/i.test(ua)) return "macos";
  if (/Linux|X11|CrOS/i.test(ua)) return "linux";
  return null;
}
