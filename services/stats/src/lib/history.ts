import { COUNTER_KEYS, type Counters } from "./report";

/** Length of the history on the page and in /api/v1/totals, today (UTC) included. */
export const HISTORY_DAYS = 30;

export interface HistoryDay {
  day: string;
  /** all four token kinds together */
  tokens: number;
  claudeTurns: number;
  sessions: number;
  claudeWorkMs: number;
  /** what the tokens would have cost at API prices, in US cents */
  costUsdCents: number;
  userTurns: number;
  agentsStarted: number;
  toolCalls: number;
  commits: number;
  activeInstalls: number;
  /** installations whose first report was on this day */
  newInstalls: number;
  /** installations known at the end of this day */
  totalInstalls: number;
  /** installer downloads counted on this day (lib/downloads.ts) */
  downloads: number;
}

/** One row of historySql(): a day with reports, the increments as numeric text. */
export type HistoryRow = { day: string; active: string } & Partial<Record<string, string>>;

/** What the history takes from other tables than install_days. */
export interface HistoryExtras {
  /** first reports per day, over all time */
  newInstalls: Map<string, number>;
  /** counted downloads per day */
  downloads: Map<string, number>;
}

/** The `days` ISO dates ending with `endDay`, oldest first. */
export function historyDays(endDay: string, days = HISTORY_DAYS): string[] {
  const end = Date.parse(`${endDay}T00:00:00Z`);
  return Array.from({ length: days }, (_, i) => new Date(end - (days - 1 - i) * 86_400_000).toISOString().slice(0, 10));
}

/**
 * Increments per day and counter over all installations, from the daily states in install_days. The
 * increment of a day is the state minus the installation's latest earlier state, even when that lies
 * before the window. On an installation's first day the earlier state is its very first report
 * (installs.first_counters): a new installation reports a minute after its start, so its first day counts
 * from there. Installations from before that column have none, their first day is no increment. A negative
 * difference (reinstall with a reset database) counts as 0, and so does a counter missing in the earlier
 * state (it came with a newer app version, which sends its total since installation). $1 is the first day
 * of the window, $2 the last.
 * The keys come from COUNTER_KEYS, not from input, so interpolating them is safe.
 */
export function historySql(): string {
  const increments = COUNTER_KEYS.map(
    (k) => `COALESCE(SUM(GREATEST(0, (counters->>'${k}')::numeric - (prev->>'${k}')::numeric)), 0)::text AS "${k}"`,
  ).join(",\n       ");
  return `WITH win AS (
    SELECT install_id, day, counters FROM install_days WHERE day BETWEEN $1::date AND $2::date
  ), before AS (
    SELECT DISTINCT ON (d.install_id) d.install_id, d.day, d.counters
    FROM install_days d
    WHERE d.day < $1::date AND d.install_id IN (SELECT install_id FROM win)
    ORDER BY d.install_id, d.day DESC
  ), lagged AS (
    SELECT s.day, s.counters,
      COALESCE(LAG(s.counters) OVER (PARTITION BY s.install_id ORDER BY s.day), i.first_counters) AS prev
    FROM (SELECT * FROM win UNION ALL SELECT * FROM before) s
    JOIN installs i ON i.install_id = s.install_id
  )
  SELECT to_char(day, 'YYYY-MM-DD') AS day, COUNT(*)::text AS active,
       ${increments}
  FROM lagged
  WHERE day >= $1::date
  GROUP BY day
  ORDER BY day`;
}

/** Increments per counter for every day of the window; days without reports are zero. */
export function fillHistory(rows: HistoryRow[], endDay: string, days = HISTORY_DAYS): Array<{ day: string; activeInstalls: number; increments: Counters }> {
  const byDay = new Map(rows.map((r) => [r.day, r]));
  return historyDays(endDay, days).map((day) => {
    const r = byDay.get(day);
    return {
      day,
      activeInstalls: Number(r?.active ?? 0),
      increments: Object.fromEntries(COUNTER_KEYS.map((k) => [k, Number(r?.[k] ?? 0)])) as Counters,
    };
  });
}

export function tokenSum(c: Pick<Counters, "tokensInput" | "tokensOutput" | "tokensCacheRead" | "tokensCacheWrite">): number {
  return c.tokensInput + c.tokensOutput + c.tokensCacheRead + c.tokensCacheWrite;
}

export function toHistory(rows: HistoryRow[], endDay: string, days = HISTORY_DAYS, extras?: HistoryExtras): HistoryDay[] {
  const filled = fillHistory(rows, endDay, days);
  const first = filled[0]?.day ?? endDay;
  // Installations from before the window: ISO dates compare as text.
  let total = 0;
  for (const [day, n] of extras?.newInstalls ?? []) if (day < first) total += n;
  return filled.map((d) => {
    const newInstalls = extras?.newInstalls.get(d.day) ?? 0;
    total += newInstalls;
    return {
      day: d.day,
      tokens: tokenSum(d.increments),
      claudeTurns: d.increments.claudeTurns,
      sessions: d.increments.sessions,
      claudeWorkMs: d.increments.claudeWorkMs,
      costUsdCents: d.increments.costUsdCents,
      userTurns: d.increments.userTurns,
      agentsStarted: d.increments.agentsStarted,
      toolCalls: d.increments.toolCalls,
      commits: d.increments.commits,
      activeInstalls: d.activeInstalls,
      newInstalls,
      totalInstalls: total,
      downloads: extras?.downloads.get(d.day) ?? 0,
    };
  });
}
