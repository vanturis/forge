import { compareVersions } from "./versions";

// The releases of FORGE on GitHub, fetched once for everything that reads them: the download page, the
// project facts of the statistics and the "what's new" page.

/** Repository whose releases carry the FORGE builds. */
const REPO = "vanturis/forge";
const CACHE_MS = 15 * 60_000;
/** After a failure: soon enough to recover, rare enough for GitHub's limit of 60 anonymous requests an hour. */
const RETRY_MS = 2 * 60_000;

export interface ReleaseAsset {
  name?: string;
  browser_download_url?: string;
}

export interface GithubRelease {
  tag_name?: string;
  body?: string | null;
  published_at?: string | null;
  html_url?: string;
  draft?: boolean;
  prerelease?: boolean;
  assets?: ReleaseAsset[];
}

export async function fetchReleases(fetchFn: typeof fetch = fetch): Promise<GithubRelease[]> {
  const res = await fetchFn(`https://api.github.com/repos/${REPO}/releases?per_page=100`, {
    headers: { Accept: "application/vnd.github+json", "User-Agent": "forge-stats" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`GitHub antwortet mit HTTP ${res.status}`);
  return (await res.json()) as GithubRelease[];
}

let cache: { value: GithubRelease[]; at: number } | null = null;
let failedAt = 0;
let inflight: Promise<GithubRelease[]> | null = null;

/**
 * The releases, newest first as GitHub lists them, at most 15 minutes old. While GitHub cannot be
 * reached the last list stays; without one the error goes to the caller.
 */
export function getReleases(fetchFn: typeof fetch = fetch): Promise<GithubRelease[]> {
  const now = Date.now();
  if (cache && (now - cache.at < CACHE_MS || now - failedAt < RETRY_MS)) return Promise.resolve(cache.value);
  inflight ??= fetchReleases(fetchFn)
    .then((value) => {
      cache = { value, at: Date.now() };
      return value;
    })
    .catch((err: unknown) => {
      failedAt = Date.now();
      if (!cache) throw err;
      console.error("releases failed:", err instanceof Error ? err.message : err);
      return cache.value;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** Published FORGE versions, highest first. Pre-releases are dev builds and the FORGE Setup release. */
export function publishedReleases(releases: GithubRelease[]): GithubRelease[] {
  return releases
    .filter((r) => !r.draft && !r.prerelease && /^v\d/i.test(r.tag_name ?? ""))
    .sort((a, b) => compareVersions(b.tag_name!.slice(1), a.tag_name!.slice(1)));
}

export interface ChangeItem {
  /** part of FORGE the line names before its colon ("Chat", "Git"); null without one */
  area: string | null;
  text: string;
}

export interface ChangelogEntry {
  version: string;
  publishedAt: string | null;
  url: string | null;
  items: ChangeItem[];
}

/** "Chat: Suche mit Strg+F" names its area; a colon later in a sentence or after several words does not. */
const AREA = /^([\p{L}\p{N}][\p{L}\p{N} .+/-]{0,23}):\s+(\S.*)$/u;

/**
 * The lines of release notes as items. The release workflow writes one line per change, "- Area: what
 * changed"; anything else (headings, blank lines) is left out, and the same line twice counts once.
 */
export function changeItems(body: string | null | undefined): ChangeItem[] {
  const seen = new Set<string>();
  const items: ChangeItem[] = [];
  for (const raw of (body ?? "").split(/\r?\n/)) {
    const line = raw.trim();
    const bullet = /^[-*]\s+(.*)$/.exec(line);
    const text = (bullet ? bullet[1]! : line).trim();
    if (!text || line.startsWith("#") || seen.has(text)) continue;
    seen.add(text);
    const m = AREA.exec(text);
    // More than two words before the colon is a sentence, not an area.
    items.push(m && m[1]!.trim().split(/\s+/).length <= 2 ? { area: m[1]!.trim(), text: m[2]! } : { area: null, text });
  }
  return items;
}

/** What each published version brought, newest first; versions without notes are left out. */
export function toChangelog(releases: GithubRelease[]): ChangelogEntry[] {
  return publishedReleases(releases)
    .map((r) => ({ version: r.tag_name!.slice(1), publishedAt: r.published_at ?? null, url: r.html_url ?? null, items: changeItems(r.body) }))
    .filter((e) => e.items.length > 0);
}
