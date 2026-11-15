import { getDownloads } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Installer downloads by people, without updates (lib/downloads.ts): `downloads` is the total and what
 * the README badge shows, the rest splits it by the way of the download.
 */
export async function GET(): Promise<Response> {
  try {
    const d = await getDownloads();
    return Response.json({ downloads: d.total, ...d.kinds }, { headers: { "Cache-Control": "public, max-age=1800" } });
  } catch (err) {
    console.error("downloads failed:", err instanceof Error ? err.message : err);
    return Response.json({ error: "downloads unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
