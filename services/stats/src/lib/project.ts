import { compareVersions } from "./versions";

/** Repository of FORGE. */
const REPO = "vanturis/forge";
const CACHE_MS = 30 * 60_000;
/** After a failure: soon enough to recover, rare enough for GitHub's limit of 60 anonymous requests an hour. */
const RETRY_MS = 5 * 60_000;

/** Public facts of the repository for the statistics page. */
export interface Project {
  stars: number;
  /** commits on the default branch; null when GitHub did not say */
  commits: number | null;
  /** newest published release (no dev build), without the "v"; null while there is none */
  latestVersion: string | null;
  latestAt: string | null;
}

/** GitHub pages the commits one per page: the number of the last page is their count. */
export function lastPage(link: string | null): number | null {
  const m = /[?&]page=(\d+)>;\s*rel="last"/.exec(link ?? "");
  return m ? Number(m[1]) : null;
}

export async function fetchProject(fetchFn: typeof fetch = fetch): Promise<Project> {
  const get = (path: string) =>
    fetchFn(`https://api.github.com/repos/${REPO}${path}`, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "forge-stats" },
      signal: AbortSignal.timeout(8_000),
    });
  const [repo, commits, releases] = await Promise.all([get(""), get("/commits?per_page=1"), get("/releases?per_page=30")]);
  if (!repo.ok) throw new Error(`GitHub antwortet mit HTTP ${repo.status}`);
  if (!commits.ok || !releases.ok) console.error(`project: commits HTTP ${commits.status}, releases HTTP ${releases.status}`);
  const r = (await repo.json()) as { stargazers_count?: number };
  const l = releases.ok ? newestRelease((await releases.json()) as Release[]) : null;
  return {
    stars: r.stargazers_count ?? 0,
    commits: commits.ok ? (lastPage(commits.headers.get("link")) ?? 1) : null,
    latestVersion: l?.tag_name ? l.tag_name.replace(/^v/i, "") : null,
    latestAt: l?.published_at ?? null,
  };
}

type Release = { tag_name?: string; published_at?: string; draft?: boolean; prerelease?: boolean };

/**
 * The published FORGE version with the highest number. Not GitHub's "latest": that one stays on the
 * release with the full installer. Pre-releases are dev builds and the FORGE Setup release.
 */
export function newestRelease(releases: Release[]): Release | null {
  const published = releases.filter((r) => !r.draft && !r.prerelease && /^v\d/i.test(r.tag_name ?? ""));
  return published.reduce<Release | null>((max, r) => (max === null || compareVersions(r.tag_name!.slice(1), max.tag_name!.slice(1)) > 0 ? r : max), null);
}

let cache: { value: Project | null; at: number } | null = null;
let inflight: Promise<Project | null> | null = null;

/** The facts at most 30 minutes old; null while GitHub cannot be reached and nothing was fetched before. */
export function getProject(fetchFn: typeof fetch = fetch): Promise<Project | null> {
  if (cache && Date.now() - cache.at < CACHE_MS) return Promise.resolve(cache.value);
  inflight ??= fetchProject(fetchFn)
    .then((value) => {
      cache = { value, at: Date.now() };
      return value;
    })
    .catch((err: unknown) => {
      console.error("project failed:", err instanceof Error ? err.message : err);
      // The last known facts stay; the next try comes after RETRY_MS.
      cache = { value: cache?.value ?? null, at: Date.now() - CACHE_MS + RETRY_MS };
      return cache.value;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}
