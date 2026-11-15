"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { Activity, Box, CalendarDays, Check, ChevronDown, Clock, CreditCard, Download, Gauge, GitBranch, Languages, Layers, LayoutGrid, Monitor, MonitorDown, Tag } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { localHours, weekdayMeans } from "@/lib/activity";
import type { Platform, Totals } from "@/lib/db";
import { DOWNLOAD_KINDS } from "@/lib/downloads";
import { tokenSum, type HistoryDay } from "@/lib/history";
import { groupModels } from "@/lib/models";
import { compareVersions, newestVersion } from "@/lib/versions";
import { Skeleton } from "./blocks";
import { useI18n } from "./locale";
import { Reveal } from "./motion";

// The cards of the live stats, two in a row: the history per day (columns, any counter) and the
// installations (area), the activity by time of day and by weekday, the models and token kinds as share
// bars, the platforms as a ring, versions, Claude plans, languages and downloads as share bars, and the
// project facts, feature counters and averages as figures.

/** Height of the plot area; the x-axis band comes below. */
const PLOT_H = 116;
/** Periods of the two day charts; the totals carry 30 days. */
const RANGES = [7, 14, 30] as const;
type Range = (typeof RANGES)[number];
/** Models with their own row; the rest is one row "Andere". */
const TOP_MODELS = 3;
/** Versions, plans and languages with their own row; the rest is one row "Andere". */
const TOP_SHARES = 4;
/** Legend order of the platforms; all four are always listed. */
const PLATFORMS: Platform[] = ["windows", "macos", "linux", "other"];
/** What the history chart can show, in the order of its menu. */
const DAY_METRICS = ["tokens", "cost", "turns", "sessions", "workTime", "prompts", "agents", "toolCalls", "commits", "downloads"] as const;
type DayMetric = (typeof DAY_METRICS)[number];
const INSTALL_METRICS = ["active", "total"] as const;
type InstallMetric = (typeof INSTALL_METRICS)[number];
/** Days behind the weekday chart: four of every weekday. */
const WEEKDAY_DAYS = 28;

/** Clean 1-2-5 steps for an axis up to `max`, at most four steps. */
export function niceTicks(max: number): number[] {
  if (max <= 0) return [0];
  const steps = Array.from({ length: 13 }, (_, i) => [1, 2, 5].map((s) => s * 10 ** i)).flat();
  const step = steps.find((s) => max / s <= 3) ?? steps[steps.length - 1]!;
  const ticks: number[] = [];
  for (let v = 0; v < max + step; v += step) {
    ticks.push(v);
    if (v >= max) break;
  }
  return ticks;
}

function ChartCard({ icon: Icon, title, sub, action, children }: { icon: LucideIcon; title: string; sub: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="chart-card" aria-label={title}>
      <div className="chart-head">
        <span className="icon-tile" aria-hidden>
          <Icon />
        </span>
        <div className="chart-title">
          <h3>{title}</h3>
          <p>{sub}</p>
        </div>
        {action && <div className="chart-actions">{action}</div>}
      </div>
      {children}
    </section>
  );
}

/** A pill with the current choice and a small menu of the others; closes on a click outside and on Escape. */
function MenuSelect<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: Array<{ value: T; label: string }>; onChange: (v: T) => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const current = options.find((o) => o.value === value)?.label ?? "";
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div className="range" ref={root}>
      <button
        type="button"
        className="range-button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`${label}: ${current}`}
        onClick={() => setOpen((o) => !o)}
      >
        {current}
        <ChevronDown aria-hidden />
      </button>
      {open && (
        <div id={menuId} role="menu" className="range-menu" aria-label={label}>
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              role="menuitemradio"
              aria-checked={o.value === value}
              className="range-item"
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
            >
              {o.label}
              {o.value === value && <Check aria-hidden />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function RangeSelect({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  const m = useI18n().t.stats.charts;
  return <MenuSelect label={m.range} value={value} onChange={onChange} options={RANGES.map((r) => ({ value: r, label: m.lastDays(r) }))} />;
}

interface Point {
  key: string;
  value: number;
  /** tooltip: the value first, then what it belongs to */
  tip: [value: string, label: string];
  /** x-axis label at this point; null leaves it out */
  axis: string | null;
}

/** Axis frame with gridlines both ways and a tooltip; inside either columns or a line with the area below it. */
function DayPlot({ points, kind, label }: { points: Point[]; kind: "columns" | "area"; label: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const { t, f } = useI18n();
  const n = points.length;
  const max = Math.max(0, ...points.map((p) => p.value));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1]! || 1;
  const y = (v: number) => PLOT_H - (v / top) * PLOT_H;
  const x = (i: number) => ((i + 0.5) / n) * 100;
  const tip = hover !== null ? points[hover] : null;
  const align = hover === null ? "" : hover < n * 0.15 ? " tip-start" : hover >= n * 0.85 ? " tip-end" : "";
  // The area follows the pointer over the whole plot; the columns are their own targets.
  const onAreaMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    setHover(Math.min(n - 1, Math.max(0, Math.floor(((e.clientX - box.left) / box.width) * n))));
  };
  return (
    <div className="day-plot">
      <div className="y-axis" style={{ height: PLOT_H }} aria-hidden>
        {ticks.map((v) => (
          <span key={v} style={{ top: y(v) }}>
            {f.axis(v)}
          </span>
        ))}
      </div>
      <div className="plot-wrap">
        <div
          className="plot"
          style={{ height: PLOT_H }}
          onPointerMove={kind === "area" && max > 0 ? onAreaMove : undefined}
          onPointerLeave={() => setHover(null)}
        >
          {ticks.map((v) => (
            <div key={v} className="gridline" style={{ top: y(v) }} aria-hidden />
          ))}
          {points.map((p, i) => p.axis && <div key={p.key} className="gridline-v" style={{ left: `${x(i)}%` }} aria-hidden />)}
          {max === 0 ? (
            <p className="chart-empty plot-empty">{t.stats.charts.empty}</p>
          ) : kind === "columns" ? (
            <div className={n <= 12 ? "bars bars-few" : "bars"}>
              {points.map((p, i) => (
                <div
                  key={p.key}
                  className={`col${hover === i ? " col-hover" : ""}`}
                  tabIndex={0}
                  role="img"
                  aria-label={`${p.tip[1]}: ${p.tip[0]}`}
                  onPointerEnter={() => setHover(i)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                >
                  <span className="col-bar" style={{ height: p.value > 0 ? Math.max(2, (p.value / top) * PLOT_H) : 0, "--i": i } as CSSProperties} />
                </div>
              ))}
            </div>
          ) : (
            <>
              <svg className="area" viewBox={`0 0 100 ${PLOT_H}`} preserveAspectRatio="none" role="img" aria-label={label}>
                <defs>
                  <linearGradient id="area-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" className="area-stop" stopOpacity="0.22" />
                    <stop offset="1" className="area-stop" stopOpacity="0.02" />
                  </linearGradient>
                </defs>
                <path
                  className="area-fill"
                  d={`M${x(0)},${PLOT_H} ${points.map((p, i) => `L${x(i)},${y(p.value)}`).join(" ")} L${x(n - 1)},${PLOT_H} Z`}
                  fill="url(#area-fill)"
                />
                <path className="area-line" d={points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.value)}`).join(" ")} vectorEffect="non-scaling-stroke" />
              </svg>
              <span className="area-dot" style={{ left: `${x(n - 1)}%`, top: y(points[n - 1]!.value) }} aria-hidden />
              {hover !== null && hover !== n - 1 && <span className="area-dot area-dot-hover" style={{ left: `${x(hover)}%`, top: y(points[hover]!.value) }} aria-hidden />}
            </>
          )}
          {tip && hover !== null && (
            <div role="tooltip" className={`tooltip${align}`} style={{ left: `${x(hover)}%`, top: Math.max(0, y(tip.value) - 8) }}>
              <div className="tooltip-value">{tip.tip[0]}</div>
              <div className="tooltip-label">{tip.tip[1]}</div>
            </div>
          )}
        </div>
        <div className="x-axis" aria-hidden>
          {points.map(
            (p, i) =>
              p.axis && (
                <span key={p.key} style={{ left: `${x(i)}%` }}>
                  {p.axis}
                </span>
              ),
          )}
        </div>
      </div>
    </div>
  );
}

/** "Claude Opus 4.7" for the known families; anything else as it came. */
const modelName = (label: string) => (/^(Opus|Sonnet|Haiku|Fable) /.test(label) ? `Claude ${label}` : label);

interface ShareRow {
  key: string;
  label: ReactNode;
  value: number;
  /** hover text with the absolute number */
  title: string;
  /** shown at the right instead of the percentage */
  text?: string;
}

/** The first `top` rows, the rest summed into one row; nothing is cut when only one would be left over. */
function topRows(rows: ShareRow[], top: number, other: (value: number) => ShareRow): ShareRow[] {
  if (rows.length <= top + 1) return rows;
  return [...rows.slice(0, top), other(rows.slice(top).reduce((n, r) => n + r.value, 0))];
}

/** Label, share bar and percentage per row; `fine` shows small shares with a decimal. */
function ShareList({ rows, fine }: { rows: ShareRow[]; fine?: boolean }) {
  const { t, f } = useI18n();
  const total = rows.reduce((n, r) => n + r.value, 0);
  if (!total) return <p className="chart-empty card-empty">{t.stats.charts.empty}</p>;
  return (
    <ul className="shares">
      {rows.map((r, i) => (
        <li key={r.key} className="share" title={r.title}>
          <span className="share-label">{r.label}</span>
          <span className="share-track" aria-hidden>
            {r.value > 0 && <span className="share-fill" style={{ width: `${Math.max(1, (r.value / total) * 100)}%`, "--i": i } as CSSProperties} />}
          </span>
          <span className="share-value">{r.text ?? (fine ? f.percentFine(r.value, total) : f.percent(r.value, total))}</span>
        </li>
      ))}
    </ul>
  );
}

function TopModels({ totals }: { totals: Totals }) {
  const { t, f } = useI18n();
  const m = t.stats.charts;
  const rows = groupModels(totals.models).map((r) => ({ key: r.label, label: modelName(r.label), value: r.tokens, title: m.tokens(f.count(r.tokens)) }));
  return <ShareList rows={topRows(rows, TOP_MODELS, (value) => ({ key: "other", label: m.otherModels, value, title: m.tokens(f.count(value)) }))} />;
}

/** The four token kinds, most first: reading the cache is nearly all of it, which the plain sum hides. */
function TokenKinds({ totals }: { totals: Totals }) {
  const { t, f } = useI18n();
  const m = t.stats.charts;
  const c = totals.counters;
  const rows = [
    { key: "cacheRead", value: c.tokensCacheRead },
    { key: "cacheWrite", value: c.tokensCacheWrite },
    { key: "output", value: c.tokensOutput },
    { key: "input", value: c.tokensInput },
  ] as const;
  return <ShareList fine rows={[...rows].sort((a, b) => b.value - a.value).map((r) => ({ key: r.key, label: m.kinds[r.key], value: r.value, title: m.tokens(f.count(r.value)) }))} />;
}

/** Downloads per way with the absolute number; the share is the hover text. */
function DownloadShares({ totals }: { totals: Totals }) {
  const { t, f } = useI18n();
  const m = t.stats.charts;
  const d = totals.downloads;
  return <ShareList rows={DOWNLOAD_KINDS.map((k) => ({ key: k, label: m.downloadKinds[k], value: d.kinds[k], title: f.percent(d.kinds[k], d.total), text: f.count(d.kinds[k]) }))} />;
}

/** Known values in their order, then "Andere" for the rest and last the installations that sent none. */
function withUnknown(known: ShareRow[], unknown: number, other: (value: number) => ShareRow, unknownRow: (value: number) => ShareRow): ShareRow[] {
  const rows = topRows(known, unknown ? TOP_SHARES - 1 : TOP_SHARES, other);
  return unknown ? [...rows, unknownRow(unknown)] : rows;
}

/** The most used versions, newest first; the newest of all gets a mark. */
function Versions({ totals }: { totals: Totals }) {
  const { t, f } = useI18n();
  const m = t.stats.charts;
  const newest = newestVersion(totals.versions);
  const title = (n: number) => m.installs(n, f.count(n));
  const byCount = totals.versions.map((v) => ({
    key: v.version,
    label: (
      <>
        v{v.version}
        {v.version === newest && <span className="share-badge">{m.newest}</span>}
      </>
    ),
    value: v.installs,
    title: title(v.installs),
  }));
  const rows = topRows(byCount, TOP_SHARES, (value) => ({ key: "other", label: m.otherVersions, value, title: title(value) }));
  const own = rows.filter((r) => r.key !== "other").sort((a, b) => compareVersions(b.key, a.key));
  return <ShareList rows={[...own, ...rows.filter((r) => r.key === "other")]} />;
}

/** "ultra" is "Ultra", "max_40x" "Max 40x". */
export const planName = (plan: string) => plan.split("_").map((p, i) => (i === 0 ? p.charAt(0).toUpperCase() + p.slice(1) : p)).join(" ");

function Plans({ totals }: { totals: Totals }) {
  const { t, f } = useI18n();
  const m = t.stats.charts;
  const title = (n: number) => m.installs(n, f.count(n));
  const known = totals.plans.flatMap((p) => (p.plan ? [{ key: p.plan, label: planName(p.plan), value: p.installs, title: title(p.installs) }] : []));
  const unknown = totals.plans.find((p) => !p.plan)?.installs ?? 0;
  return (
    <ShareList
      rows={withUnknown(
        known,
        unknown,
        (value) => ({ key: "other", label: m.otherPlans, value, title: title(value) }),
        (value) => ({ key: "unknown", label: m.unknownPlan, value, title: title(value) }),
      )}
    />
  );
}

function LanguageShares({ totals }: { totals: Totals }) {
  const { locale, t, f } = useI18n();
  const m = t.stats.charts;
  const names = new Intl.DisplayNames([locale], { type: "language" });
  const name = (code: string) => {
    try {
      return names.of(code) ?? code;
    } catch {
      return code;
    }
  };
  const title = (n: number) => m.installs(n, f.count(n));
  const known = totals.languages.flatMap((l) => (l.language ? [{ key: l.language, label: name(l.language), value: l.installs, title: title(l.installs) }] : []));
  const unknown = totals.languages.find((l) => !l.language)?.installs ?? 0;
  return (
    <ShareList
      rows={withUnknown(
        known,
        unknown,
        (value) => ({ key: "other", label: m.otherLanguages, value, title: title(value) }),
        (value) => ({ key: "unknown", label: m.unknownLanguage, value, title: title(value) }),
      )}
    />
  );
}

interface Figure {
  key: string;
  label: string;
  value: string;
  sub: string;
}

/** Figures on quiet tiles, three in a row or two. */
function FigureGrid({ items, two }: { items: Figure[]; two?: boolean }) {
  return (
    <dl className={two ? "figures figures-two" : "figures"}>
      {items.map((it) => (
        <div key={it.key} className="figure">
          <dt>{it.label}</dt>
          <dd className="figure-value">{it.value}</dd>
          <dd className="figure-sub">{it.sub}</dd>
        </div>
      ))}
    </dl>
  );
}

/** The feature counters: own prompts, projects, agents, phone calls, tool calls, commits. */
function Features({ totals }: { totals: Totals }) {
  const { t, f } = useI18n();
  const m = t.stats.charts.figures;
  const c = totals.counters;
  return (
    <FigureGrid
      items={[
        { key: "prompts", value: f.count(c.userTurns), label: m.prompts, sub: m.promptsSub },
        { key: "projects", value: f.count(c.projectsCreated), label: m.projects, sub: m.projectsSub },
        { key: "agents", value: f.count(c.agentsStarted), label: m.agents, sub: m.agentsSub(f.count(c.agentsMerged)) },
        // The duration came with a later app version than the calls.
        { key: "phone", value: f.count(c.phoneCalls), label: m.phoneCalls, sub: c.phoneMs > 0 ? m.phoneMinutes(f.count(Math.round(c.phoneMs / 60_000))) : m.phoneCallsSub },
        { key: "toolCalls", value: f.count(c.toolCalls), label: m.toolCalls, sub: m.toolCallsSub },
        { key: "commits", value: f.count(c.commits), label: m.commits, sub: m.commitsSub },
      ]}
    />
  );
}

/** Means over everything counted; 0 while there is nothing to divide by. */
function Averages({ totals }: { totals: Totals }) {
  const { t, f } = useI18n();
  const m = t.stats.charts.averages;
  const c = totals.counters;
  const per = (a: number, b: number) => (b > 0 ? a / b : 0);
  return (
    <FigureGrid
      items={[
        { key: "tokens", value: f.count(Math.round(per(tokenSum(c), c.claudeTurns))), label: m.tokensPerTurn, sub: m.tokensPerTurnSub },
        { key: "cost", value: f.usd(per(c.costUsdCents, c.claudeTurns)), label: m.costPerTurn, sub: m.costPerTurnSub },
        { key: "time", value: `${f.minutes(per(c.claudeWorkMs, c.claudeTurns))} ${m.minutesUnit}`, label: m.timePerTurn, sub: m.timePerTurnSub },
        { key: "turns", value: f.decimal(per(c.claudeTurns, c.sessions)), label: m.turnsPerSession, sub: m.turnsPerSessionSub },
        { key: "merged", value: f.percent(c.agentsMerged, c.agentsStarted), label: m.merged, sub: m.mergedSub(f.count(c.agentsStarted)) },
        { key: "hours", value: f.hours(per(c.claudeWorkMs, totals.installs)), label: m.hoursPerInstall, sub: m.hoursPerInstallSub },
      ]}
    />
  );
}

/** Facts of the repository; GitHub may be out of reach, the numbers of FORGE are not. */
function ProjectFacts({ totals }: { totals: Totals }) {
  const { t, f } = useI18n();
  const m = t.stats.charts.project;
  const p = totals.project;
  if (!p) return <p className="chart-empty card-empty">{m.unavailable}</p>;
  return (
    <FigureGrid
      two
      items={[
        { key: "stars", value: f.count(p.stars), label: m.stars, sub: m.starsSub },
        ...(p.commits !== null ? [{ key: "commits", value: f.count(p.commits), label: m.commits, sub: m.commitsSub }] : []),
        ...(p.latestVersion ? [{ key: "version", value: `v${p.latestVersion}`, label: m.version, sub: p.latestAt ? m.versionSub(f.date(p.latestAt)) : "" }] : []),
        { key: "license", value: "AGPL-3.0", label: m.license, sub: m.licenseSub },
      ]}
    />
  );
}

/** Radius of the ring in a 42 x 42 box, chosen so its circumference is 100 and dash lengths are percentages. */
const RING_R = 15.9155;

function Platforms({ totals }: { totals: Totals }) {
  const { t, f } = useI18n();
  const m = t.stats.charts;
  const count = (p: Platform) => totals.platforms.find((r) => r.platform === p)?.installs ?? 0;
  const total = PLATFORMS.reduce((n, p) => n + count(p), 0);
  const parts = PLATFORMS.map((p) => ({ platform: p, share: total ? (count(p) / total) * 100 : 0 })).filter((s) => s.share > 0);
  // A small gap between segments, none when one platform has it all.
  const gap = parts.length > 1 ? 0.8 : 0;
  let start = 0;
  return (
    <div className="platforms">
      <div className="ring">
        <svg viewBox="0 0 42 42" aria-hidden>
          <circle className="ring-track" cx="21" cy="21" r={RING_R} />
          {parts.map((s) => {
            const offset = 25 - start - gap / 2;
            start += s.share;
            return (
              <circle
                key={s.platform}
                className={`ring-seg seg-${s.platform}`}
                cx="21"
                cy="21"
                r={RING_R}
                strokeDasharray={`${Math.max(0, s.share - gap)} ${100 - Math.max(0, s.share - gap)}`}
                strokeDashoffset={offset}
              />
            );
          })}
        </svg>
        <div className="ring-center">
          <span className="ring-value">{f.count(total)}</span>
          <span className="ring-label">{m.platformTotal(total)}</span>
        </div>
      </div>
      <ul className="legend">
        {PLATFORMS.map((p) => (
          <li key={p}>
            <i className={`legend-dot seg-${p}`} aria-hidden />
            <span className="legend-label">{m.platformNames[p]}</span>
            <span className="legend-value">{f.percent(count(p), total)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Every day for a week, every second day for two weeks, else every 7th day counted back from today. */
const axisStep = (days: number) => (days <= 7 ? 1 : days <= 14 ? 2 : 7);

/** The visitor's whole hours ahead of UTC; 0 on the server and until the page is mounted. */
function useUtcOffset(): number {
  const [offset, setOffset] = useState(0);
  useEffect(() => setOffset(Math.round(-new Date().getTimezoneOffset() / 60)), []);
  return offset;
}

export function StatsCharts({ totals }: { totals: Totals }) {
  const { t, f } = useI18n();
  const m = t.stats.charts;
  const [dayMetric, setDayMetric] = useState<DayMetric>("tokens");
  const [dayRange, setDayRange] = useState<Range>(30);
  const [installMetric, setInstallMetric] = useState<InstallMetric>("active");
  const [installsRange, setInstallsRange] = useState<Range>(30);
  const offset = useUtcOffset();
  const history = totals.history;
  const today = history[history.length - 1]?.day;
  const dayName = (day: string) => (day === today ? m.today(f.dayLong(day)) : f.dayLong(day));
  const points = (range: Range, value: (d: HistoryDay) => number, tip: (d: HistoryDay) => Point["tip"]): Point[] => {
    const days = history.slice(-range);
    return days.map((d, i) => ({ key: d.day, value: value(d), tip: tip(d), axis: (days.length - 1 - i) % axisStep(range) === 0 ? f.dayShort(d.day) : null }));
  };

  // What a column is worth and what its tooltip says; cost in dollars and working time in hours for the axis.
  const dayMetrics: Record<DayMetric, { value: (d: HistoryDay) => number; tip: (d: HistoryDay) => string }> = {
    tokens: { value: (d) => d.tokens, tip: (d) => m.tokens(f.count(d.tokens)) },
    cost: { value: (d) => d.costUsdCents / 100, tip: (d) => f.usd(d.costUsdCents) },
    turns: { value: (d) => d.claudeTurns, tip: (d) => m.turns(d.claudeTurns, f.count(d.claudeTurns)) },
    sessions: { value: (d) => d.sessions, tip: (d) => m.units.sessions(d.sessions, f.count(d.sessions)) },
    workTime: { value: (d) => d.claudeWorkMs / 3_600_000, tip: (d) => m.units.hours(f.hours(d.claudeWorkMs)) },
    prompts: { value: (d) => d.userTurns, tip: (d) => m.units.prompts(d.userTurns, f.count(d.userTurns)) },
    agents: { value: (d) => d.agentsStarted, tip: (d) => m.units.agents(d.agentsStarted, f.count(d.agentsStarted)) },
    toolCalls: { value: (d) => d.toolCalls, tip: (d) => m.units.toolCalls(d.toolCalls, f.count(d.toolCalls)) },
    commits: { value: (d) => d.commits, tip: (d) => m.units.commits(d.commits, f.count(d.commits)) },
    downloads: { value: (d) => d.downloads, tip: (d) => m.units.downloads(d.downloads, f.count(d.downloads)) },
  };
  const metric = dayMetrics[dayMetric];

  const hours = localHours(
    Array.from({ length: 24 }, (_, h) => totals.hours[h] ?? { tokens: 0, turns: 0 }),
    offset,
  );
  const weekdays = weekdayMeans(history.slice(-WEEKDAY_DAYS).map((d) => ({ day: d.day, value: d.tokens })));

  return (
    <Reveal className="charts">
      <ChartCard
        icon={Activity}
        title={m.perDay}
        sub={m.perDaySub}
        action={
          <>
            <MenuSelect label={m.metric} value={dayMetric} onChange={setDayMetric} options={DAY_METRICS.map((k) => ({ value: k, label: m.metrics[k] }))} />
            <RangeSelect value={dayRange} onChange={setDayRange} />
          </>
        }
      >
        <DayPlot
          kind="columns"
          label={`${m.perDay}: ${m.metrics[dayMetric]}`}
          points={points(dayRange, metric.value, (d) => [metric.tip(d), dayMetric === "tokens" ? `${dayName(d.day)} · ${m.turns(d.claudeTurns, f.count(d.claudeTurns))}` : dayName(d.day)])}
        />
      </ChartCard>
      <ChartCard
        icon={MonitorDown}
        title={m.installsChart}
        sub={installMetric === "active" ? m.installsSubActive : m.installsSubTotal}
        action={
          <>
            <MenuSelect label={m.metric} value={installMetric} onChange={setInstallMetric} options={INSTALL_METRICS.map((k) => ({ value: k, label: m.installMetrics[k] }))} />
            <RangeSelect value={installsRange} onChange={setInstallsRange} />
          </>
        }
      >
        <DayPlot
          kind="area"
          label={`${m.installsChart}: ${m.installMetrics[installMetric]}`}
          points={
            installMetric === "active"
              ? points(
                  installsRange,
                  (d) => d.activeInstalls,
                  (d) => [m.installs(d.activeInstalls, f.count(d.activeInstalls)), dayName(d.day)],
                )
              : points(
                  installsRange,
                  (d) => d.totalInstalls,
                  (d) => [m.installs(d.totalInstalls, f.count(d.totalInstalls)), d.newInstalls > 0 ? `${dayName(d.day)} · ${m.units.newInstalls(f.count(d.newInstalls))}` : dayName(d.day)],
                )
          }
        />
        <dl className="chart-facts">
          {(
            [
              ["day", totals.activeInstalls24h],
              ["week", totals.activeInstalls7d],
              ["month", totals.activeInstalls30d],
            ] as const
          ).map(([key, n]) => (
            <div key={key}>
              <dt>{m.activeFacts[key]}</dt>
              <dd>{f.count(n)}</dd>
            </div>
          ))}
        </dl>
      </ChartCard>
      <ChartCard icon={Clock} title={m.hours} sub={m.hoursSub}>
        <DayPlot
          kind="columns"
          label={m.hours}
          points={hours.map((h, i) => ({
            key: String(i),
            value: h.tokens,
            tip: [m.tokens(f.count(h.tokens)), `${m.hourRange(f.hour(i), f.hour((i + 1) % 24))} · ${m.turns(h.turns, f.count(h.turns))}`],
            axis: i % 6 === 0 ? f.hour(i) : null,
          }))}
        />
      </ChartCard>
      <ChartCard icon={CalendarDays} title={m.weekdays} sub={m.weekdaysSub}>
        <DayPlot
          kind="columns"
          label={m.weekdays}
          points={weekdays.map((v, i) => ({ key: String(i), value: v, tip: [m.tokens(f.count(Math.round(v))), m.weekdayAverage(f.weekday(i, true))], axis: f.weekday(i) }))}
        />
      </ChartCard>
      <ChartCard icon={Box} title={m.topModels} sub={m.topModelsSub}>
        <TopModels totals={totals} />
      </ChartCard>
      <ChartCard icon={Layers} title={m.tokenKinds} sub={m.tokenKindsSub}>
        <TokenKinds totals={totals} />
      </ChartCard>
      <ChartCard icon={Monitor} title={m.platforms} sub={m.platformsSub}>
        <Platforms totals={totals} />
      </ChartCard>
      <ChartCard icon={Tag} title={m.versions} sub={m.versionsSub}>
        <Versions totals={totals} />
      </ChartCard>
      <ChartCard icon={CreditCard} title={m.plans} sub={m.plansSub}>
        <Plans totals={totals} />
      </ChartCard>
      <ChartCard icon={Languages} title={m.languages} sub={m.languagesSub}>
        <LanguageShares totals={totals} />
      </ChartCard>
      <ChartCard icon={Download} title={m.downloads} sub={m.downloadsSub}>
        <DownloadShares totals={totals} />
      </ChartCard>
      <ChartCard icon={GitBranch} title={m.project.title} sub={m.project.sub}>
        <ProjectFacts totals={totals} />
      </ChartCard>
      <ChartCard icon={LayoutGrid} title={m.figures.title} sub={m.figures.sub}>
        <Features totals={totals} />
      </ChartCard>
      <ChartCard icon={Gauge} title={m.averages.title} sub={m.averages.sub}>
        <Averages totals={totals} />
      </ChartCard>
    </Reveal>
  );
}

/** Placeholder in the shape of the cards: same icons and titles, columns, bars, the ring and the figures in gray. */
export function ChartsSkeleton() {
  const { t } = useI18n();
  const m = t.stats.charts;
  const card = (Icon: LucideIcon, title: string, body: ReactNode, selects = 0) => (
    <section className="chart-card" aria-label={title}>
      <div className="chart-head">
        <span className="icon-tile" aria-hidden>
          <Icon />
        </span>
        <div className="chart-title">
          <h3>{title}</h3>
          <p>
            <Skeleton width="11rem" />
          </p>
        </div>
        {selects > 0 && (
          <div className="chart-actions">
            {Array.from({ length: selects }, (_, i) => (
              <Skeleton key={i} width={i === selects - 1 ? "136px" : "104px"} style={{ height: 36, borderRadius: 9999 }} />
            ))}
          </div>
        )}
      </div>
      {body}
    </section>
  );
  const plot = (seed: number, columns = 30) => (
    <div className="day-plot">
      <div className="y-axis" style={{ height: PLOT_H }} />
      <div className="plot-wrap">
        <div className="plot" style={{ height: PLOT_H }}>
          <div className={columns <= 12 ? "bars bars-few" : "bars"}>
            {Array.from({ length: columns }, (_, i) => (
              <div key={i} className="col">
                <span className="col-bar skeleton-bar" style={{ height: `${12 + ((i * 37 + seed * 11) % 70)}%` }} />
              </div>
            ))}
          </div>
        </div>
        <div className="x-axis" />
      </div>
    </div>
  );
  const shares = (rows: number) => (
    <ul className="shares">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="share">
          <span className="share-label">
            <Skeleton width={`${55 + ((i * 13) % 30)}%`} />
          </span>
          <span className="share-track">
            <span className="share-fill skeleton-bar" style={{ width: `${Math.max(12, 70 - i * 18)}%` }} />
          </span>
          <span className="share-value">
            <Skeleton width="2rem" />
          </span>
        </li>
      ))}
    </ul>
  );
  const figures = (count: number, two = false) => (
    <dl className={two ? "figures figures-two" : "figures"}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="figure">
          <dt>
            <Skeleton width={`${50 + ((i * 17) % 35)}%`} />
          </dt>
          <dd className="figure-value">
            <Skeleton width="3.5rem" />
          </dd>
          <dd className="figure-sub">
            <Skeleton width="70%" />
          </dd>
        </div>
      ))}
    </dl>
  );
  return (
    <div className="charts" aria-busy>
      {card(Activity, m.perDay, plot(0), 2)}
      {card(
        MonitorDown,
        m.installsChart,
        <>
          {plot(1)}
          <dl className="chart-facts">
            {(["day", "week", "month"] as const).map((key) => (
              <div key={key}>
                <dt>{m.activeFacts[key]}</dt>
                <dd>
                  <Skeleton width="1.5rem" />
                </dd>
              </div>
            ))}
          </dl>
        </>,
        2,
      )}
      {card(Clock, m.hours, plot(2, 24))}
      {card(CalendarDays, m.weekdays, plot(3, 7))}
      {card(Box, m.topModels, shares(4))}
      {card(Layers, m.tokenKinds, shares(4))}
      {card(
        Monitor,
        m.platforms,
        <div className="platforms">
          <div className="ring">
            <svg viewBox="0 0 42 42" aria-hidden>
              <circle className="ring-track skeleton-ring" cx="21" cy="21" r={RING_R} />
            </svg>
          </div>
          <ul className="legend">
            {PLATFORMS.map((p) => (
              <li key={p}>
                <i className="legend-dot" aria-hidden />
                <span className="legend-label">{m.platformNames[p]}</span>
                <span className="legend-value">
                  <Skeleton width="2rem" />
                </span>
              </li>
            ))}
          </ul>
        </div>,
      )}
      {card(Tag, m.versions, shares(4))}
      {card(CreditCard, m.plans, shares(4))}
      {card(Languages, m.languages, shares(3))}
      {card(Download, m.downloads, shares(4))}
      {card(GitBranch, m.project.title, figures(4, true))}
      {card(LayoutGrid, m.figures.title, figures(6))}
      {card(Gauge, m.averages.title, figures(6))}
    </div>
  );
}
