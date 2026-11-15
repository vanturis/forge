import { Pool } from "pg";
import { ONLINE_MINUTES } from "./constants";
import { DOWNLOAD_KINDS, fetchSetupAssets, type DownloadKind, type Downloads, type SetupAsset } from "./downloads";
import { HISTORY_DAYS, historyDays, historySql, toHistory, tokenSum, type HistoryDay, type HistoryRow } from "./history";
import { getProject, type Project } from "./project";
import { COUNTER_KEYS, type Counters, type ModelUsage, type Report } from "./report";
import type { VersionCount } from "./versions";

export interface PlanCount {
  plan: string | null;
  installs: number;
  /** of them online now */
  online: number;
}

export interface LanguageCount {
  /** null: app versions before the language was sent */
  language: string | null;
  installs: number;
}

export type Platform = "windows" | "macos" | "linux" | "other";

export interface PlatformCount {
  platform: Platform;
  installs: number;
}

/** What all installations did in one hour of the day (UTC), summed over the last 30 days. */
export interface HourActivity {
  tokens: number;
  turns: number;
}

/** Minimum time between two accepted reports of one installation; the app reports every 5 minutes. */
export const REPORT_INTERVAL_MINUTES = 4;
const TOTALS_MAX_AGE_MS = 5 * 60 * 1000;
/** The online count is one cheap query; the page asks for it every 30 seconds. */
const ONLINE_MAX_AGE_MS = 15 * 1000;
/** Models in /api/v1/totals; every installation can send 20 IDs of its own, so the list is capped. */
const MAX_TOTAL_MODELS = 50;

export interface Totals {
  installs: number;
  activeInstalls30d: number;
  activeInstalls7d: number;
  /** installations with a report in the last 24 hours */
  activeInstalls24h: number;
  /** installations whose first report was in the last 30 days */
  newInstalls30d: number;
  /** installations with a report in the last ONLINE_MINUTES */
  onlineInstalls: number;
  counters: Counters;
  updatedAt: string;
  /** summed over all installations, most tokens first */
  models: Record<string, ModelUsage>;
  /** installations active in the last 30 days per app version, most first */
  versions: VersionCount[];
  /** installations active in the last 30 days per Claude plan, most first; plan null: unknown */
  plans: PlanCount[];
  /** installations active in the last 30 days per operating system, most first */
  platforms: PlatformCount[];
  /** installations active in the last 30 days per interface language, most first */
  languages: LanguageCount[];
  /** the last 30 days (UTC), oldest first */
  history: HistoryDay[];
  /** 24 entries, index = hour of the day in UTC, over the last 30 days */
  hours: HourActivity[];
  /** installer downloads by people, without updates (lib/downloads.ts) */
  downloads: Downloads;
  /** facts of the repository on GitHub; null while GitHub cannot be reached */
  project: Project | null;
}

let pool: Pool | null = null;
let schemaReady: Promise<void> | null = null;

function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is not set");
    pool = new Pool({ connectionString, max: 5, connectionTimeoutMillis: 5000 });
    // An idle client losing its connection must not crash the process.
    pool.on("error", (err) => console.error("postgres pool error:", err.message));
  }
  return pool;
}

async function db(): Promise<Pool> {
  const p = getPool();
  schemaReady ??= p
    .query(
      `CREATE TABLE IF NOT EXISTS installs (
        install_id uuid PRIMARY KEY,
        first_seen timestamptz NOT NULL DEFAULT now(),
        last_seen timestamptz NOT NULL DEFAULT now(),
        app_version text NOT NULL,
        os text NOT NULL,
        counters jsonb NOT NULL
      );
      ALTER TABLE installs ADD COLUMN IF NOT EXISTS models jsonb NOT NULL DEFAULT '{}'::jsonb;
      ALTER TABLE installs ADD COLUMN IF NOT EXISTS plan text;
      ALTER TABLE installs ADD COLUMN IF NOT EXISTS language text;
      ALTER TABLE installs ADD COLUMN IF NOT EXISTS first_counters jsonb;
      CREATE TABLE IF NOT EXISTS install_days (
        install_id uuid NOT NULL REFERENCES installs(install_id) ON DELETE CASCADE,
        day date NOT NULL,
        counters jsonb NOT NULL,
        PRIMARY KEY (install_id, day)
      );
      CREATE INDEX IF NOT EXISTS install_days_day ON install_days (day);
      CREATE TABLE IF NOT EXISTS activity_hours (
        day date NOT NULL,
        hour smallint NOT NULL,
        tokens numeric NOT NULL DEFAULT 0,
        turns integer NOT NULL DEFAULT 0,
        PRIMARY KEY (day, hour)
      );
      CREATE TABLE IF NOT EXISTS download_assets (
        asset_id bigint PRIMARY KEY,
        name text NOT NULL,
        downloads integer NOT NULL,
        first_seen timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS download_days (
        day date NOT NULL,
        kind text NOT NULL,
        downloads integer NOT NULL,
        PRIMARY KEY (day, kind)
      )`,
    )
    .then(() => undefined)
    .catch((err: unknown) => {
      schemaReady = null;
      throw err;
    });
  await schemaReady;
  return p;
}

export async function installExists(installId: string): Promise<boolean> {
  const p = await db();
  const res = await p.query("SELECT 1 FROM installs WHERE install_id = $1", [installId]);
  return (res.rowCount ?? 0) > 0;
}

/**
 * What a report adds to the hour it arrives in: the difference to the installation's previous report.
 * Nothing for a first report (its total is no work of this hour) and nothing for a decrease.
 */
export function reportDelta(prev: Partial<Counters> | null, now: Counters): HourActivity {
  if (!prev) return { tokens: 0, turns: 0 };
  const before = {
    tokensInput: prev.tokensInput ?? 0,
    tokensOutput: prev.tokensOutput ?? 0,
    tokensCacheRead: prev.tokensCacheRead ?? 0,
    tokensCacheWrite: prev.tokensCacheWrite ?? 0,
  };
  return { tokens: Math.max(0, tokenSum(now) - tokenSum(before)), turns: Math.max(0, now.claudeTurns - (prev.claudeTurns ?? 0)) };
}

/**
 * Stores the report as the installation's latest state and as its state of the current UTC day; false
 * when the previous report is younger than the interval (then nothing is written). The first report of
 * an installation also stays as first_counters, the base of its first day in the history.
 */
export async function upsertReport(r: Report): Promise<boolean> {
  const p = await db();
  // All parts of the statement see the table as it was before: prev is the state this report replaces.
  const res = await p.query<{ prev: Partial<Counters> | null }>(
    `WITH prev AS (
       SELECT counters FROM installs WHERE install_id = $1
     ), up AS (
       INSERT INTO installs (install_id, first_seen, last_seen, app_version, os, counters, models, plan, language, first_counters)
       VALUES ($1, now(), now(), $2, $3, $4::jsonb, $5, $7, $8, $4::jsonb)
       ON CONFLICT (install_id) DO UPDATE
         SET last_seen = now(), app_version = EXCLUDED.app_version, os = EXCLUDED.os,
             counters = EXCLUDED.counters, models = EXCLUDED.models, plan = EXCLUDED.plan,
             language = EXCLUDED.language
         WHERE installs.last_seen <= now() - make_interval(mins => $6)
       RETURNING install_id
     ), days AS (
       INSERT INTO install_days (install_id, day, counters)
       SELECT install_id, (now() AT TIME ZONE 'UTC')::date, $4::jsonb FROM up
       ON CONFLICT (install_id, day) DO UPDATE SET counters = EXCLUDED.counters
       RETURNING 1
     )
     SELECT (SELECT counters FROM prev) AS prev FROM days`,
    [r.installId, r.appVersion, r.os, JSON.stringify(r.counters), JSON.stringify(r.models), REPORT_INTERVAL_MINUTES, r.plan, r.language],
  );
  const row = res.rows[0];
  if (!row) return false;
  const delta = reportDelta(row.prev, r.counters);
  if (delta.tokens > 0 || delta.turns > 0) {
    // The report is stored; the hour chart missing a few minutes is no reason to make the app send again.
    await p
      .query(
        `INSERT INTO activity_hours (day, hour, tokens, turns)
         VALUES ((now() AT TIME ZONE 'UTC')::date, EXTRACT(HOUR FROM now() AT TIME ZONE 'UTC')::smallint, $1, $2)
         ON CONFLICT (day, hour) DO UPDATE
           SET tokens = activity_hours.tokens + EXCLUDED.tokens, turns = activity_hours.turns + EXCLUDED.turns`,
        [delta.tokens, delta.turns],
      )
      .catch((err: unknown) => console.error("activity failed:", err instanceof Error ? err.message : err));
  }
  return true;
}

export async function deleteInstall(installId: string): Promise<void> {
  const p = await db();
  // install_days goes with it (ON DELETE CASCADE).
  await p.query("DELETE FROM installs WHERE install_id = $1", [installId]);
}

export async function ping(): Promise<void> {
  await (await db()).query("SELECT 1");
}

async function queryModels(p: Pool): Promise<Record<string, ModelUsage>> {
  const res = await p.query<{ id: string; tokens: string; cost: string }>(
    `SELECT m.key AS id,
       SUM((m.value->>'tokens')::numeric)::text AS tokens,
       SUM((m.value->>'costUsdCents')::numeric)::text AS cost
     FROM installs, jsonb_each(installs.models) AS m
     GROUP BY m.key
     ORDER BY SUM((m.value->>'tokens')::numeric) DESC, m.key
     LIMIT $1`,
    [MAX_TOTAL_MODELS],
  );
  return Object.fromEntries(res.rows.map((r) => [r.id, { tokens: Number(r.tokens), costUsdCents: Number(r.cost) }]));
}

async function queryVersions(p: Pool): Promise<VersionCount[]> {
  const res = await p.query<{ version: string; installs: string }>(
    `SELECT app_version AS version, COUNT(*)::text AS installs
     FROM installs
     WHERE last_seen > now() - interval '30 days'
     GROUP BY app_version
     ORDER BY COUNT(*) DESC, app_version DESC`,
  );
  return res.rows.map((r) => ({ version: r.version, installs: Number(r.installs) }));
}

// App versions before the rename to Ultra and Max keep reporting the old names.
const CURRENT_PLAN = `CASE plan WHEN 'max_20x' THEN 'ultra' WHEN 'max_5x' THEN 'max' ELSE plan END`;

async function queryPlans(p: Pool): Promise<PlanCount[]> {
  const res = await p.query<{ plan: string | null; installs: string; online: string }>(
    `SELECT ${CURRENT_PLAN} AS plan, COUNT(*)::text AS installs,
       COUNT(*) FILTER (WHERE last_seen > now() - make_interval(mins => $1))::text AS online
     FROM installs
     WHERE last_seen > now() - interval '30 days'
     GROUP BY 1
     ORDER BY COUNT(*) DESC, 1 NULLS LAST`,
    [ONLINE_MINUTES],
  );
  return res.rows.map((r) => ({ plan: r.plan, installs: Number(r.installs), online: Number(r.online) }));
}

async function queryLanguages(p: Pool): Promise<LanguageCount[]> {
  const res = await p.query<{ language: string | null; installs: string }>(
    `SELECT language, COUNT(*)::text AS installs
     FROM installs
     WHERE last_seen > now() - interval '30 days'
     GROUP BY language
     ORDER BY COUNT(*) DESC, language NULLS LAST`,
  );
  return res.rows.map((r) => ({ language: r.language, installs: Number(r.installs) }));
}

/** The app sends `os.type() os.release()`: "Windows_NT 10.0.26200", "Darwin 24.1.0", "Linux 6.8.0". */
async function queryPlatforms(p: Pool): Promise<PlatformCount[]> {
  const res = await p.query<{ platform: Platform; installs: string }>(
    `SELECT CASE
         WHEN os ILIKE 'windows%' THEN 'windows'
         WHEN os ILIKE 'darwin%' THEN 'macos'
         WHEN os ILIKE 'linux%' THEN 'linux'
         ELSE 'other'
       END AS platform, COUNT(*)::text AS installs
     FROM installs
     WHERE last_seen > now() - interval '30 days'
     GROUP BY 1
     ORDER BY COUNT(*) DESC, 1`,
  );
  return res.rows.map((r) => ({ platform: r.platform, installs: Number(r.installs) }));
}

async function queryHours(p: Pool): Promise<HourActivity[]> {
  const res = await p.query<{ hour: number; tokens: string; turns: string }>(
    `SELECT hour, SUM(tokens)::text AS tokens, SUM(turns)::text AS turns
     FROM activity_hours
     WHERE day > (now() AT TIME ZONE 'UTC')::date - ${HISTORY_DAYS}
     GROUP BY hour`,
  );
  const hours: HourActivity[] = Array.from({ length: 24 }, () => ({ tokens: 0, turns: 0 }));
  for (const r of res.rows) if (hours[r.hour]) hours[r.hour] = { tokens: Number(r.tokens), turns: Number(r.turns) };
  return hours;
}

// ---- downloads (what counts as one: lib/downloads.ts)

/**
 * Remembers the download count of every FORGE-Setup.exe ever seen, so the total survives the next upload
 * (GitHub starts the new file at 0), and books the increase since the last look on today.
 */
export async function storeSetupDownloads(assets: SetupAsset[], now = Date.now()): Promise<void> {
  const p = await db();
  for (const a of assets) {
    // A file that was there long before the first look: its count so far belongs to no day.
    const old = a.createdAt !== null && now - Date.parse(a.createdAt) > 86_400_000;
    const res = await p.query<{ delta: number }>(
      `WITH prev AS (
         SELECT downloads FROM download_assets WHERE asset_id = $1
       ), up AS (
         INSERT INTO download_assets (asset_id, name, downloads) VALUES ($1, $2, $3)
         ON CONFLICT (asset_id) DO UPDATE
           SET downloads = GREATEST(download_assets.downloads, EXCLUDED.downloads), updated_at = now()
         RETURNING downloads
       )
       SELECT ((SELECT downloads FROM up) - COALESCE((SELECT downloads FROM prev), $4))::int AS delta`,
      [a.id, a.name, a.downloads, old ? a.downloads : 0],
    );
    const delta = res.rows[0]?.delta ?? 0;
    if (delta > 0) await countDownload("windows", delta);
  }
}

/** Books downloads on today (UTC). For "windows" this feeds the day chart only; its total is download_assets. */
export async function countDownload(kind: DownloadKind, n = 1): Promise<void> {
  const p = await db();
  await p.query(
    `INSERT INTO download_days (day, kind, downloads) VALUES ((now() AT TIME ZONE 'UTC')::date, $1, $2)
     ON CONFLICT (day, kind) DO UPDATE SET downloads = download_days.downloads + EXCLUDED.downloads`,
    [kind, n],
  );
}

async function queryDownloads(p: Pool): Promise<Downloads> {
  const res = await p.query<{ kind: string; n: string }>(
    `SELECT 'windows' AS kind, COALESCE(SUM(downloads), 0)::text AS n FROM download_assets
     UNION ALL
     SELECT kind, SUM(downloads)::text AS n FROM download_days WHERE kind <> 'windows' GROUP BY kind`,
  );
  const kinds = Object.fromEntries(DOWNLOAD_KINDS.map((k) => [k, 0])) as Record<DownloadKind, number>;
  for (const r of res.rows) if (r.kind in kinds) kinds[r.kind as DownloadKind] = Number(r.n);
  return { total: DOWNLOAD_KINDS.reduce((n, k) => n + kinds[k], 0), kinds };
}

const SETUP_SYNC_MS = 30 * 60_000;
let setupSyncAt = 0;
let setupSync: Promise<void> | null = null;
/** what GitHub reported last, for the badge while the database is down */
let setupSeen: number | null = null;

/**
 * Looks at GitHub's count of FORGE-Setup.exe at most every 30 minutes. Never throws: the page and the
 * reports that trigger it work without GitHub. A failed look is tried again after a minute.
 */
export function syncSetupDownloads(fetchFn: typeof fetch = fetch): Promise<void> {
  if (Date.now() - setupSyncAt < SETUP_SYNC_MS) return Promise.resolve();
  setupSync ??= (async () => {
    try {
      const assets = await fetchSetupAssets(fetchFn);
      setupSeen = assets.reduce((n, a) => n + a.downloads, 0);
      await storeSetupDownloads(assets);
      setupSyncAt = Date.now();
    } catch (err) {
      console.error("download sync failed:", err instanceof Error ? err.message : err);
      setupSyncAt = Date.now() - SETUP_SYNC_MS + 60_000;
    }
  })().finally(() => {
    setupSync = null;
  });
  return setupSync;
}

/** The downloads, current with GitHub; without the database what GitHub reported last (Windows only). */
export async function getDownloads(): Promise<Downloads> {
  await syncSetupDownloads();
  try {
    return await queryDownloads(await db());
  } catch (err) {
    if (setupSeen === null) throw err;
    return { total: setupSeen, kinds: { windows: setupSeen, macos: 0, linux: 0, script: 0 } };
  }
}

async function countsByDay(p: Pool, sql: string, params: unknown[] = []): Promise<Map<string, number>> {
  const res = await p.query<{ day: string; n: string }>(sql, params);
  return new Map(res.rows.map((r) => [r.day, Number(r.n)]));
}

/** The history of the `days` UTC days up to `endDay` (today when left out). */
export async function queryHistory(endDay?: string, days = HISTORY_DAYS): Promise<HistoryDay[]> {
  const p = await db();
  const end = endDay ?? new Date().toISOString().slice(0, 10);
  const start = historyDays(end, days)[0];
  const [res, newInstalls, downloads] = await Promise.all([
    p.query<HistoryRow>(historySql(), [start, end]),
    countsByDay(p, `SELECT to_char((first_seen AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD') AS day, COUNT(*)::text AS n FROM installs GROUP BY 1`),
    countsByDay(
      p,
      `SELECT to_char(day, 'YYYY-MM-DD') AS day, SUM(downloads)::text AS n FROM download_days WHERE day BETWEEN $1::date AND $2::date GROUP BY day`,
      [start, end],
    ),
  ]);
  return toHistory(res.rows, end, days, { newInstalls, downloads });
}

async function queryTotals(): Promise<Totals> {
  const p = await db();
  const project = getProject();
  // Before the history, which shows today's downloads.
  await syncSetupDownloads();
  const [models, versions, plans, platforms, languages, history, hours, downloads] = await Promise.all([
    queryModels(p),
    queryVersions(p),
    queryPlans(p),
    queryPlatforms(p),
    queryLanguages(p),
    queryHistory(),
    queryHours(p),
    queryDownloads(p),
  ]);
  // The keys come from COUNTER_KEYS, not from input, so interpolating them is safe.
  const sums = COUNTER_KEYS.map((k) => `COALESCE(SUM((counters->>'${k}')::numeric), 0)::text AS "${k}"`).join(",\n");
  const res = await p.query<Record<string, string>>(
    `SELECT COUNT(*)::text AS installs,
       COUNT(*) FILTER (WHERE last_seen > now() - interval '30 days')::text AS active,
       COUNT(*) FILTER (WHERE last_seen > now() - interval '7 days')::text AS active7,
       COUNT(*) FILTER (WHERE last_seen > now() - interval '24 hours')::text AS active1,
       COUNT(*) FILTER (WHERE first_seen > now() - interval '30 days')::text AS new,
       COUNT(*) FILTER (WHERE last_seen > now() - make_interval(mins => $1))::text AS online,
       ${sums}
     FROM installs`,
    [ONLINE_MINUTES],
  );
  const row = res.rows[0] ?? {};
  const counters = Object.fromEntries(COUNTER_KEYS.map((k) => [k, Number(row[k] ?? 0)])) as Counters;
  return {
    installs: Number(row.installs ?? 0),
    activeInstalls30d: Number(row.active ?? 0),
    activeInstalls7d: Number(row.active7 ?? 0),
    activeInstalls24h: Number(row.active1 ?? 0),
    newInstalls30d: Number(row.new ?? 0),
    onlineInstalls: Number(row.online ?? 0),
    counters,
    updatedAt: new Date().toISOString(),
    models,
    versions,
    plans,
    platforms,
    languages,
    history,
    hours,
    downloads,
    project: await project,
  };
}

let cached: { at: number; totals: Totals } | null = null;
let inflight: Promise<Totals> | null = null;

/** Totals at most five minutes old; a failed query is not cached. */
export async function getTotals(): Promise<Totals> {
  if (cached && Date.now() - cached.at < TOTALS_MAX_AGE_MS) return cached.totals;
  inflight ??= queryTotals()
    .then((totals) => {
      cached = { at: Date.now(), totals };
      return totals;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export interface Online {
  onlineInstalls: number;
  /** online installations per plan; plans without any are left out */
  plans: Array<{ plan: string | null; online: number }>;
}

let onlineCached: { at: number; online: Online } | null = null;

/** Installations online now, at most 15 seconds old; between two totals the page updates only this. */
export async function getOnline(): Promise<Online> {
  if (onlineCached && Date.now() - onlineCached.at < ONLINE_MAX_AGE_MS) return onlineCached.online;
  const p = await db();
  const res = await p.query<{ plan: string | null; online: string }>(
    `SELECT ${CURRENT_PLAN} AS plan, COUNT(*)::text AS online FROM installs
     WHERE last_seen > now() - make_interval(mins => $1)
     GROUP BY 1`,
    [ONLINE_MINUTES],
  );
  const plans = res.rows.map((r) => ({ plan: r.plan, online: Number(r.online) }));
  const online = { onlineInstalls: plans.reduce((n, r) => n + r.online, 0), plans };
  onlineCached = { at: Date.now(), online };
  return online;
}
