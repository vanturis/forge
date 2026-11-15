import { getReleases, publishedReleases, type GithubRelease } from "./releases";

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

/**
 * Stars and commits from the GitHub API, the newest version from the releases (null: not available).
 * That is the highest published version, not GitHub's "latest", which stays on the release with the
 * full installer.
 */
export async function fetchProject(fetchFn: typeof fetch, releases: GithubRelease[] | null): Promise<Project> {
  const get = (path: string) =>
    fetchFn(`https://api.github.com/repos/${REPO}${path}`, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "forge-stats" },
      signal: AbortSignal.timeout(8_000),
    });
  const [repo, commits] = await Promise.all([get(""), get("/commits?per_page=1")]);
  if (!repo.ok) throw new Error(`GitHub antwortet mit HTTP ${repo.status}`);
  if (!commits.ok) console.error(`project: commits HTTP ${commits.status}`);
  const r = (await repo.json()) as { stargazers_count?: number };
  const newest = releases ? publishedReleases(releases)[0] : undefined;
  return {
    stars: r.stargazers_count ?? 0,
    commits: commits.ok ? (lastPage(commits.headers.get("link")) ?? 1) : null,
    latestVersion: newest?.tag_name ? newest.tag_name.replace(/^v/i, "") : null,
    latestAt: newest?.published_at ?? null,
  };
}

let cache: { value: Project | null; at: number } | null = null;
let inflight: Promise<Project | null> | null = null;

/** The facts at most 30 minutes old; null while GitHub cannot be reached and nothing was fetched before. */
export function getProject(fetchFn: typeof fetch = fetch): Promise<Project | null> {
  if (cache && Date.now() - cache.at < CACHE_MS) return Promise.resolve(cache.value);
  inflight ??= getReleases(fetchFn)
    .catch(() => null)
    .then((releases) => fetchProject(fetchFn, releases))
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
