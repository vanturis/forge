import { afterAll, describe, expect, it } from "vitest";
import { fillHistory, historyDays, historySql, toHistory } from "./history";
import { COUNTER_KEYS } from "./report";

describe("historyDays", () => {
  it("lists the window oldest first, across month and year ends", () => {
    expect(historyDays("2026-03-02", 4)).toEqual(["2026-02-27", "2026-02-28", "2026-03-01", "2026-03-02"]);
    expect(historyDays("2027-01-01", 2)).toEqual(["2026-12-31", "2027-01-01"]);
    expect(historyDays("2026-10-18")).toHaveLength(30);
  });
});

describe("fillHistory and toHistory", () => {
  it("fills days without reports with zeros", () => {
    const h = fillHistory([{ day: "2026-10-17", active: "2", sessions: "3" }], "2026-10-18", 3);
    expect(h.map((d) => d.day)).toEqual(["2026-10-16", "2026-10-17", "2026-10-18"]);
    expect(h[0]!.activeInstalls).toBe(0);
    expect(h[1]!.activeInstalls).toBe(2);
    expect(h[1]!.increments.sessions).toBe(3);
    expect(h[1]!.increments.tokensInput).toBe(0);
    expect(Object.keys(h[2]!.increments).sort()).toEqual([...COUNTER_KEYS].sort());
  });

  it("sums all four token kinds", () => {
    const h = toHistory([{ day: "2026-10-18", active: "1", tokensInput: "1", tokensOutput: "20", tokensCacheRead: "300", tokensCacheWrite: "4000", claudeTurns: "7", sessions: "2", claudeWorkMs: "9000", costUsdCents: "55" }], "2026-10-18", 1);
    expect(h).toMatchObject([{ day: "2026-10-18", tokens: 4321, claudeTurns: 7, sessions: 2, claudeWorkMs: 9000, costUsdCents: 55, activeInstalls: 1, newInstalls: 0, totalInstalls: 0, downloads: 0 }]);
  });

  it("adds up the installations, those from before the window included, and takes the downloads per day", () => {
    const h = toHistory([], "2026-10-18", 3, {
      newInstalls: new Map([
        ["2026-09-01", 2],
        ["2026-10-15", 1],
        ["2026-10-17", 3],
      ]),
      downloads: new Map([["2026-10-18", 4]]),
    });
    expect(h.map((d) => [d.day, d.newInstalls, d.totalInstalls, d.downloads])).toEqual([
      ["2026-10-16", 0, 3, 0],
      ["2026-10-17", 3, 6, 0],
      ["2026-10-18", 0, 6, 4],
    ]);
  });

  it("builds one increment column per counter", () => {
    const sql = historySql();
    for (const k of COUNTER_KEYS) expect(sql).toContain(`AS "${k}"`);
  });
});

// The increments are computed in SQL. Runs against a real Postgres when STATS_TEST_DATABASE_URL is set,
// for example the FORGE test database; uses days in 2001, so other data does not interfere.
const url = process.env.STATS_TEST_DATABASE_URL;

describe.skipIf(!url)("queryHistory against Postgres", () => {
  const ids = [
    "00000000-0000-4000-8000-0000000000a1",
    "00000000-0000-4000-8000-0000000000a2",
    "00000000-0000-4000-8000-0000000000a3",
    "00000000-0000-4000-8000-0000000000a4",
  ];

  afterAll(async () => {
    const { Pool } = await import("pg");
    const p = new Pool({ connectionString: url });
    await p.query("DELETE FROM installs WHERE install_id = ANY($1::uuid[])", [ids]);
    await p.end();
  });

  it("counts increments against the latest earlier state, not the first state and not decreases", async () => {
    process.env.DATABASE_URL = url;
    const { ping, queryHistory } = await import("./db");
    await ping();
    const { Pool } = await import("pg");
    const p = new Pool({ connectionString: url });
    await p.query("DELETE FROM installs WHERE install_id = ANY($1::uuid[])", [ids]);
    for (const id of ids) {
      await p.query("INSERT INTO installs (install_id, app_version, os, counters) VALUES ($1, '0.1.80', 'Windows', '{}')", [id]);
    }
    const day = (id: string, d: string, c: Record<string, number>) => p.query("INSERT INTO install_days (install_id, day, counters) VALUES ($1, $2, $3)", [id, d, JSON.stringify(c)]);
    // a1: state before the window, then two days in it with a gap between them
    await day(ids[0]!, "2001-01-01", { tokensInput: 100, tokensOutput: 0, claudeTurns: 1 });
    await day(ids[0]!, "2001-01-28", { tokensInput: 150, tokensOutput: 10, claudeTurns: 3 });
    await day(ids[0]!, "2001-01-30", { tokensInput: 160, tokensOutput: 10, claudeTurns: 4 });
    // a2: first state in the window (no increment), then a reset to lower numbers
    await day(ids[1]!, "2001-01-29", { tokensInput: 1000, claudeTurns: 10 });
    await day(ids[1]!, "2001-01-30", { tokensInput: 5, claudeTurns: 1 });
    // a3: an older app without claudeTurns, then with it; a counter that appears is no increment
    // (the app sends its total since installation)
    await day(ids[2]!, "2001-01-29", { tokensInput: 1 });
    await day(ids[2]!, "2001-01-30", { tokensInput: 2, claudeTurns: 9 });
    // a4: a new installation whose first report is kept: its first day counts from that report on
    await p.query("UPDATE installs SET first_counters = $2 WHERE install_id = $1", [ids[3], JSON.stringify({ tokensInput: 3, claudeTurns: 0 })]);
    await day(ids[3]!, "2001-01-29", { tokensInput: 503, claudeTurns: 4 });
    await day(ids[3]!, "2001-01-30", { tokensInput: 603, claudeTurns: 5 });

    const h = await queryHistory("2001-01-30", 3);
    await p.end();
    // The other counters of the history are 0 here; only these were reported.
    expect(h).toMatchObject([
      { day: "2001-01-28", tokens: 60, claudeTurns: 2, activeInstalls: 1 },
      { day: "2001-01-29", tokens: 500, claudeTurns: 4, activeInstalls: 3 },
      { day: "2001-01-30", tokens: 10 + 0 + 1 + 100, claudeTurns: 1 + 0 + 0 + 1, activeInstalls: 4 },
    ]);
  });

  it("keeps the first report of an installation and books what a later one adds on the hour", async () => {
    const { upsertReport } = await import("./db");
    const { COUNTER_KEYS } = await import("./report");
    const { Pool } = await import("pg");
    const p = new Pool({ connectionString: url });
    const id = ids[3]!;
    await p.query("DELETE FROM installs WHERE install_id = $1", [id]);
    const hours = async () => Number((await p.query("SELECT COALESCE(SUM(tokens), 0)::text AS n FROM activity_hours WHERE day = (now() AT TIME ZONE 'UTC')::date")).rows[0].n);
    const report = (tokensInput: number) => ({
      schema: 1 as const,
      installId: id,
      appVersion: "0.1.200",
      os: "Windows_NT 10.0.26200",
      counters: { ...(Object.fromEntries(COUNTER_KEYS.map((k) => [k, 0])) as Record<(typeof COUNTER_KEYS)[number], number>), tokensInput },
      models: {},
      plan: null,
      language: "de",
    });
    const before = await hours();
    expect(await upsertReport(report(40))).toBe(true);
    // Too soon after the first one: not stored.
    expect(await upsertReport(report(70))).toBe(false);
    expect(await hours()).toBe(before);
    await p.query("UPDATE installs SET last_seen = now() - interval '10 minutes' WHERE install_id = $1", [id]);
    expect(await upsertReport(report(100))).toBe(true);
    expect(await hours()).toBe(before + 60);
    const row = (await p.query("SELECT counters->>'tokensInput' AS now, first_counters->>'tokensInput' AS first FROM installs WHERE install_id = $1", [id])).rows[0];
    // Leaves the hour table as it was for the next run.
    await p.query("UPDATE activity_hours SET tokens = tokens - 60 WHERE day = (now() AT TIME ZONE 'UTC')::date AND hour = EXTRACT(HOUR FROM now() AT TIME ZONE 'UTC')::smallint");
    await p.end();
    expect(row).toEqual({ now: "100", first: "40" });
  });

  it("deletes the daily states with the installation", async () => {
    const { deleteInstall } = await import("./db");
    const { Pool } = await import("pg");
    const p = new Pool({ connectionString: url });
    await deleteInstall(ids[0]!);
    const res = await p.query("SELECT COUNT(*)::int AS n FROM install_days WHERE install_id = $1", [ids[0]]);
    await p.end();
    expect(res.rows[0].n).toBe(0);
  });
});
