import { buildFileOs, latestBuilds } from "@/lib/builds";
import { REPO_URL } from "@/lib/constants";
import { countDownload } from "@/lib/db";
import { downloadLimiter, isBrowser } from "@/lib/downloads";
import { clientIp, hashIp } from "@/lib/new-install-limiter";

export const dynamic = "force-dynamic";

/**
 * The manual downloads of macOS and Linux go through here, so the site can count them: GitHub's own
 * numbers of these files include every update. Forwards to the file of the newest release on GitHub.
 */
export async function GET(req: Request, ctx: RouteContext<"/dl/[file]">): Promise<Response> {
  const { file } = await ctx.params;
  const os = buildFileOs(file);
  if (!os) return new Response("not found", { status: 404 });
  const builds = await latestBuilds().catch(() => null);
  const target = builds?.[os]?.files.find((f) => f.key === file);
  // GitHub not reachable or no build yet: the release page, where the files are listed.
  if (!target) return Response.redirect(`${REPO_URL}/releases/latest`, 302);
  if (req.method === "GET" && isBrowser(req.headers.get("user-agent")) && downloadLimiter.tryAdd(hashIp(clientIp(req.headers)))) {
    // The download must not wait for the database or fail with it.
    void countDownload(os).catch((err: unknown) => console.error("download count failed:", err instanceof Error ? err.message : err));
  }
  return new Response(null, { status: 302, headers: { Location: target.url, "Cache-Control": "no-store" } });
}
