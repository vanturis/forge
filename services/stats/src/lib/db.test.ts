import { describe, expect, it } from "vitest";
import { REPORT_INTERVAL_MINUTES, reportDelta } from "./db";
import { COUNTER_KEYS, type Counters } from "./report";

describe("REPORT_INTERVAL_MINUTES", () => {
  // The app reports every 5 minutes; a lock as long as that would reject every second report
  // whenever a timer fires a little early.
  it("is 4 minutes, a minute below the app's interval", () => {
    expect(REPORT_INTERVAL_MINUTES).toBe(4);
    expect(REPORT_INTERVAL_MINUTES).toBeLessThan(5);
  });
});

describe("reportDelta", () => {
  const counters = (c: Partial<Counters>) => ({ ...(Object.fromEntries(COUNTER_KEYS.map((k) => [k, 0])) as Counters), ...c });

  it("is the difference to the previous report over all four token kinds", () => {
    const prev = counters({ tokensInput: 10, tokensOutput: 20, tokensCacheRead: 300, tokensCacheWrite: 40, claudeTurns: 5 });
    const now = counters({ tokensInput: 15, tokensOutput: 30, tokensCacheRead: 900, tokensCacheWrite: 40, claudeTurns: 7 });
    expect(reportDelta(prev, now)).toEqual({ tokens: 615, turns: 2 });
  });

  it("counts nothing for a first report and nothing for a decrease", () => {
    expect(reportDelta(null, counters({ tokensInput: 5_000_000, claudeTurns: 90 }))).toEqual({ tokens: 0, turns: 0 });
    expect(reportDelta(counters({ tokensInput: 1000, claudeTurns: 10 }), counters({ tokensInput: 5, claudeTurns: 1 }))).toEqual({ tokens: 0, turns: 0 });
  });

  it("takes a counter missing in the previous report as 0", () => {
    expect(reportDelta({ tokensInput: 10 }, counters({ tokensInput: 12, claudeTurns: 3 }))).toEqual({ tokens: 2, turns: 3 });
  });
});
