import { describe, expect, it } from "vitest";
import { DownloadLimiter, isBrowser, isInstallCommand, setupAssets } from "./downloads";

describe("downloads", () => {
  it("takes only FORGE-Setup.exe, not what installed apps and FORGE Setup fetch", () => {
    const assets = setupAssets({
      assets: [
        { id: 7, name: "FORGE-Setup.exe", download_count: 18, created_at: "2026-10-20T10:42:36Z" },
        { id: 8, name: "FORGE_0.1.135_x64-setup.exe", download_count: 7 },
        { id: 9, name: "FORGE_0.1.135_update_node-24_git-2.zip", download_count: 40 },
        { id: 10, name: "FORGE_0.1.135_darwin-arm64.app.tar.gz", download_count: 3 },
        { name: "FORGE-Setup.exe", download_count: 2 },
      ],
    });
    expect(assets).toEqual([{ id: 7, name: "FORGE-Setup.exe", downloads: 18, createdAt: "2026-10-20T10:42:36Z" }]);
    expect(setupAssets({})).toEqual([]);
  });

  it("counts a download link only for a browser, the install script only for curl and wget", () => {
    const chrome = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";
    expect(isBrowser(chrome)).toBe(true);
    expect(isBrowser("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)")).toBe(false);
    expect(isBrowser("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 HeadlessChrome/141.0.0.0 Safari/537.36")).toBe(false);
    expect(isBrowser("curl/8.7.1")).toBe(false);
    expect(isBrowser(null)).toBe(false);
    expect(isInstallCommand("curl/8.7.1")).toBe(true);
    expect(isInstallCommand("Wget/1.21.4")).toBe(true);
    expect(isInstallCommand(chrome)).toBe(false);
    expect(isInstallCommand(null)).toBe(false);
  });

  it("stops counting one address after the daily limit and starts over the next day", () => {
    let now = Date.parse("2026-11-15T10:00:00Z");
    const limiter = new DownloadLimiter(2, () => now);
    expect(limiter.tryAdd("a")).toBe(true);
    expect(limiter.tryAdd("a")).toBe(true);
    expect(limiter.tryAdd("a")).toBe(false);
    expect(limiter.tryAdd("b")).toBe(true);
    now += 86_400_000;
    expect(limiter.tryAdd("a")).toBe(true);
  });
});

// The ledger is SQL. Runs against a real Postgres when STATS_TEST_DATABASE_URL is set; uses asset IDs
// no real release file has.
const url = process.env.STATS_TEST_DATABASE_URL;

describe.skipIf(!url)("download ledger against Postgres", () => {
  const ids = [900_000_001, 900_000_002];

  it("keeps the count of a replaced file and books only the increase on a day", async () => {
    process.env.DATABASE_URL = url;
    const { getDownloads, ping, storeSetupDownloads } = await import("./db");
    await ping();
    const { Pool } = await import("pg");
    const p = new Pool({ connectionString: url });
    const clean = async () => {
      await p.query("DELETE FROM download_assets WHERE asset_id = ANY($1::bigint[])", [ids]);
      await p.query("DELETE FROM download_days WHERE day = (now() AT TIME ZONE 'UTC')::date AND kind = 'windows'");
    };
    const today = async () => {
      const res = await p.query("SELECT COALESCE(SUM(downloads), 0)::int AS n FROM download_days WHERE day = (now() AT TIME ZONE 'UTC')::date AND kind = 'windows'");
      return res.rows[0].n as number;
    };
    const total = async () => {
      const res = await p.query("SELECT COALESCE(SUM(downloads), 0)::int AS n FROM download_assets WHERE asset_id = ANY($1::bigint[])", [ids]);
      return res.rows[0].n as number;
    };
    await clean();
    try {
      const now = Date.parse("2026-11-15T12:00:00Z");
      const asset = (id: number, downloads: number, createdAt: string) => ({ id, name: "FORGE-Setup.exe", downloads, createdAt });
      // An old file seen for the first time: its count is the total, no day gets it.
      await storeSetupDownloads([asset(ids[0]!, 18, "2026-10-20T10:42:36Z")], now);
      expect([await total(), await today()]).toEqual([18, 0]);
      await storeSetupDownloads([asset(ids[0]!, 21, "2026-10-20T10:42:36Z")], now);
      expect([await total(), await today()]).toEqual([21, 3]);
      // GitHub never reports less; if it did, the higher count stays.
      await storeSetupDownloads([asset(ids[0]!, 20, "2026-10-20T10:42:36Z")], now);
      expect([await total(), await today()]).toEqual([21, 3]);
      // A new upload replaces the file: it starts at 0, the old count stays in the total.
      await storeSetupDownloads([asset(ids[1]!, 2, "2026-11-15T11:50:00Z")], now);
      expect([await total(), await today()]).toEqual([23, 5]);
      expect((await getDownloads()).kinds.windows).toBeGreaterThanOrEqual(23);
    } finally {
      await clean();
      await p.end();
    }
  });
});
