import { describe, expect, it } from "vitest";
import { fetchProject, lastPage } from "./project";

describe("project facts", () => {
  it("reads the number of commits from the last page of the commit list", () => {
    expect(lastPage('<https://api.github.com/repositories/1/commits?per_page=1&page=2>; rel="next", <https://api.github.com/repositories/1/commits?per_page=1&page=1843>; rel="last"')).toBe(1843);
    expect(lastPage(null)).toBeNull();
    expect(lastPage('<https://api.github.com/x?page=2>; rel="next"')).toBeNull();
  });

  it("puts stars, commits and the newest release together", async () => {
    const fetchFn = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/commits?per_page=1")) return new Response("[]", { headers: { link: '<https://api.github.com/x?per_page=1&page=512>; rel="last"' } });
      if (url.endsWith("/releases?per_page=30")) {
        return Response.json([
          { tag_name: "v0.1.192-dev", prerelease: true, published_at: "2026-11-14T20:00:00Z" },
          { tag_name: "v0.1.135", published_at: "2026-10-22T15:46:58Z" },
          { tag_name: "v0.1.183", published_at: "2026-11-12T10:30:00Z" },
          { tag_name: "installer", prerelease: true, published_at: "2026-10-18T21:00:00Z" },
          { tag_name: "v0.1.200", draft: true },
        ]);
      }
      return Response.json({ stargazers_count: 3 });
    }) as typeof fetch;
    expect(await fetchProject(fetchFn)).toEqual({ stars: 3, commits: 512, latestVersion: "0.1.183", latestAt: "2026-11-12T10:30:00Z" });
  });

  it("works without a release and without the commit count", async () => {
    const fetchFn = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/commits?per_page=1")) return new Response("", { status: 403 });
      if (url.endsWith("/releases?per_page=30")) return Response.json([]);
      return Response.json({ stargazers_count: 1 });
    }) as typeof fetch;
    expect(await fetchProject(fetchFn)).toEqual({ stars: 1, commits: null, latestVersion: null, latestAt: null });
  });
});
