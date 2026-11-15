import { installExists, syncSetupDownloads, upsertReport } from "@/lib/db";
import { clientIp, hashIp, newInstallLimiter } from "@/lib/new-install-limiter";
import { parseReport, readBodyLimited } from "@/lib/report";

export const dynamic = "force-dynamic";

function error(status: number, message: string): Response {
  return Response.json({ error: message }, { status });
}

export async function POST(req: Request): Promise<Response> {
  const raw = await readBodyLimited(req);
  if (raw === null) return error(413, "body too large");
  const parsed = parseReport(raw);
  if (!parsed.ok) return error(parsed.status, parsed.error);
  const { report } = parsed;

  try {
    if (!(await installExists(report.installId))) {
      if (!newInstallLimiter.tryAdd(hashIp(clientIp(req.headers)), report.installId)) {
        return error(429, "too many new installations");
      }
    }
    if (!(await upsertReport(report))) return error(429, "too many reports");
  } catch (err) {
    console.error("report failed:", err instanceof Error ? err.message : err);
    return error(503, "database unavailable");
  }
  // Reports arrive every few minutes, also when nobody opens the page: they keep the download count current.
  void syncSetupDownloads();
  return new Response(null, { status: 204 });
}
