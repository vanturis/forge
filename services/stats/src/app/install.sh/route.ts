import { INSTALL_SCRIPT_URL } from "@/lib/constants";
import { countDownload } from "@/lib/db";
import { downloadLimiter, isInstallCommand } from "@/lib/downloads";
import { clientIp, hashIp } from "@/lib/new-install-limiter";

export const dynamic = "force-dynamic";

/**
 * `curl -fsSL https://forge.vanturis.de/install.sh | sh` (curl -L follows): the script lives in the
 * repository, so a change there needs no new deploy of this site. A fetch by curl or wget counts as a
 * download of the install command; a browser only reads the script.
 */
export function GET(req: Request) {
  if (isInstallCommand(req.headers.get("user-agent")) && downloadLimiter.tryAdd(hashIp(clientIp(req.headers)))) {
    // The installation must not wait for the database or fail with it.
    void countDownload("script").catch((err: unknown) => console.error("download count failed:", err instanceof Error ? err.message : err));
  }
  return new Response(null, { status: 302, headers: { Location: INSTALL_SCRIPT_URL, "Cache-Control": "no-store" } });
}
