import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PlanUsage } from "@forge/protocol";
import { describeUsage, settleUsage } from "../src/claude/usage.js";
import type { UsageSample } from "../src/claude/usage-forecast.js";
import type { ClaudeRuntime } from "../src/claude/runtime.js";
import type { ProjectManager } from "../src/projects/project-manager.js";
import { RuntimeCatalog } from "../src/sessions/runtime-catalog.js";
import type { SessionCore } from "../src/sessions/session-core.js";

const T0 = Date.parse("2026-10-14T10:00:00Z");
const at = (minutes: number) => new Date(T0 + minutes * 60_000).toISOString();

function usage(fiveHourResetsAt: string, fiveHour = 92): PlanUsage {
  return {
    available: true,
    subscriptionType: "max",
    windows: [
      { key: "five_hour", label: "5 Stunden", utilization: fiveHour, resetsAt: fiveHourResetsAt },
      { key: "seven_day", label: "Woche", utilization: 40, resetsAt: at(3 * 24 * 60) },
    ],
    fetchedAt: new Date().toISOString(),
    error: null,
  };
}

describe("settleUsage", () => {
  it("puts windows whose reset time has passed back to 0 %", () => {
    const u = usage(at(30));
    expect(settleUsage(u, T0)).toBe(u);
    const after = settleUsage(u, T0 + 30 * 60_000);
    expect(after.windows.map((w) => [w.key, w.utilization])).toEqual([
      ["five_hour", 0],
      ["seven_day", 40],
    ]);
    expect(after.windows[0]?.resetsAt).toBe(at(30));
  });
});

describe("RuntimeCatalog.planUsage", () => {
  let answers: PlanUsage[];
  let calls: number;
  let catalog: RuntimeCatalog;
  let samples: UsageSample[];
  let loginExpiry: string | null;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    answers = [];
    calls = 0;
    samples = [];
    loginExpiry = null;
    const core = {
      db: {
        getSettings: () => ({ claudePath: process.execPath, stripApiKey: true }),
        addUsageSamples: (s: UsageSample[]) => samples.push(...s),
        listUsageSamples: () => samples,
        getLoginExpiry: () => loginExpiry,
        setLoginExpiry: (iso: string) => {
          loginExpiry = iso;
        },
      },
    } as unknown as SessionCore;
    const runtime = {
      planUsage: async () => {
        calls++;
        return answers.shift() ?? usage(at(-1), 0);
      },
    } as unknown as ClaudeRuntime;
    catalog = new RuntimeCatalog(core, {} as ProjectManager, runtime);
  });

  afterEach(() => vi.useRealTimers());

  it("serves the cache within a minute while no window resets", async () => {
    answers.push(usage(at(30)));
    await catalog.planUsage(false);
    vi.advanceTimersByTime(30_000);
    expect((await catalog.planUsage(false)).windows[0]?.utilization).toBe(92);
    expect(calls).toBe(1);
  });

  it("forgets the cached usage after a sign-in or sign-out", async () => {
    answers.push(usage(at(30)), usage(at(30), 5));
    await catalog.planUsage(false);
    catalog.invalidate();
    expect((await catalog.planUsage(false)).windows[0]?.utilization).toBe(5);
    expect(calls).toBe(2);
  });

  it("reads the usage again once a window of the cached reading has reset", async () => {
    answers.push(usage(at(0.5)), usage(at(5 * 60), 0));
    await catalog.planUsage(false);
    vi.advanceTimersByTime(40_000);
    const fresh = await catalog.planUsage(false);
    expect(calls).toBe(2);
    expect(fresh.windows[0]).toMatchObject({ utilization: 0, resetsAt: at(5 * 60) });
  });

  it("stores every reading and forecasts each window from them", async () => {
    answers.push(usage(at(180), 20), usage(at(180), 35), usage(at(180), 50));
    expect((await catalog.planUsage(true)).windows[0]).not.toHaveProperty("forecast");
    vi.advanceTimersByTime(30 * 60_000);
    await catalog.planUsage(true);
    vi.advanceTimersByTime(30 * 60_000);
    const u = await catalog.planUsage(true);
    expect(samples).toHaveLength(6);
    expect(u.windows[0]?.forecast).toEqual({ outcome: "limit", limitAt: at(160), perHour: 30 });
    // The weekly window did not rise: no forecast instead of a made-up one.
    expect(u.windows[1]).not.toHaveProperty("forecast");
    // The cached answer carries the forecast as well.
    expect((await catalog.planUsage(false)).windows[0]?.forecast?.outcome).toBe("limit");
  });

  it("reports a passed window as reset even when Claude Code still sends the old numbers", async () => {
    answers.push(usage(at(-0.1)));
    const u = await catalog.planUsage(true);
    expect(u.windows.map((w) => w.utilization)).toEqual([0, 40]);
    // The stale answer does not make every following call spawn a CLI.
    await catalog.planUsage(false);
    expect(calls).toBe(1);
  });

  it("adds the end of the Claude sign-in to the usage without reading it again", async () => {
    answers.push(usage(at(180)));
    await catalog.planUsage(true);
    catalog.noteLoginExpiry("kein Datum");
    catalog.noteLoginExpiry(undefined);
    expect((await catalog.planUsage(false)).loginExpiresAt).toBeUndefined();
    catalog.noteLoginExpiry(at(3 * 24 * 60));
    const u = await catalog.planUsage(false);
    expect(u.loginExpiresAt).toBe(at(3 * 24 * 60));
    expect(calls).toBe(1);
    expect(describeUsage(u, { status: "ok", resetsAt: null, limitType: null, utilization: null, updatedAt: null }, T0)).toContain("Die Anmeldung bei Claude endet in 3 Tagen");
    // more than ten days ahead nobody needs to hear of it
    catalog.noteLoginExpiry(at(30 * 24 * 60));
    expect(describeUsage(await catalog.planUsage(false), { status: "ok", resetsAt: null, limitType: null, utilization: null, updatedAt: null }, T0)).not.toContain("Anmeldung");
  });
});
