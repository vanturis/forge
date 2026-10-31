import { describe, expect, it } from "vitest";
import type { PlanUsage, RateLimitState } from "@forge/protocol";
import { describeUsage, toPlanUsage } from "../src/claude/usage.js";
import { buildCommitPrompt, cleanCommitMessage } from "../src/git/commit-message.js";

describe("toPlanUsage", () => {
  it("keeps documented windows and model-scoped rows, ignores unknown keys", () => {
    const u = toPlanUsage({
      subscription_type: "max",
      rate_limits_available: true,
      rate_limits: {
        five_hour: { utilization: 17.4, resets_at: "2026-10-10T19:40:00Z" },
        seven_day: { utilization: 36, resets_at: "2026-10-12T05:00:00Z" },
        seven_day_opus: null,
        iguana_necktie: { utilization: 0, resets_at: null },
        model_scoped: [{ display_name: "Fable", utilization: 31, resets_at: "2026-10-12T05:00:00Z" }],
      },
    });
    expect(u.available).toBe(true);
    expect(u.subscriptionType).toBe("max");
    expect(u.windows.map((w) => [w.key, w.label, w.utilization])).toEqual([
      ["five_hour", "5 Stunden", 17],
      ["seven_day", "Woche", 36],
      ["model:Fable", "Woche Fable", 31],
    ]);
  });

  it("reports unavailable for API-key sessions or garbage", () => {
    expect(toPlanUsage({ rate_limits_available: false, rate_limits: null }).available).toBe(false);
    expect(toPlanUsage(null)).toMatchObject({ available: false, windows: [] });
  });

  it("leaves out the 5-hour window of a verified Ultra account", () => {
    for (const five_hour of [null, undefined]) {
      const u = toPlanUsage({
        subscription_type: "max",
        rate_limits_available: true,
        rate_limits: { five_hour, seven_day: { utilization: 36, resets_at: "2026-10-12T05:00:00Z" } },
      });
      expect(u.available).toBe(true);
      expect(u.windows.map((w) => w.key)).toEqual(["seven_day"]);
    }
  });
});

describe("describeUsage", () => {
  it("names the plan by its tier and needs no 5-hour window", () => {
    const usage: PlanUsage = {
      available: true,
      subscriptionType: "max",
      rateLimitTier: "default_claude_max_20x",
      windows: [{ key: "seven_day", label: "Woche", utilization: 36, resetsAt: null }],
      fetchedAt: "2026-10-31T10:00:00Z",
      error: null,
    };
    const text = describeUsage(usage, { status: "ok", limitType: null, resetsAt: null, utilization: null, overageInUse: false, updatedAt: null } as unknown as RateLimitState);
    expect(text).toContain("Woche: 36 % genutzt");
    expect(text).toContain("Abo: Ultra");
    expect(text).not.toContain("5 Stunden");
  });
});

describe("commit message prompt", () => {
  const diff = {
    path: "src/a.ts",
    binary: false,
    additions: 1,
    deletions: 0,
    truncated: false,
    lines: [
      { kind: "hunk" as const, text: "@@ -1 +1,2 @@", oldNo: null, newNo: null },
      { kind: "add" as const, text: 'const token = "ghp_abcdefghijklmnopqrstuvwxyz0123";', oldNo: null, newNo: 1 },
    ],
  };

  it("includes history style, skipped files and redacts secrets", () => {
    const p = buildCommitPrompt([diff], ["feat: login", "fix: typo"], [".env"]);
    expect(p).toContain("- feat: login");
    expect(p).toContain("Nicht mitgeschickt (sensible Dateien): .env");
    expect(p).toContain("--- src/a.ts");
    expect(p).not.toContain("ghp_abc");
  });

  it("falls back to conventional commits without history", () => {
    expect(buildCommitPrompt([diff], [], [])).toContain("Conventional Commits");
  });

  it("cleans fences, labels and quotes", () => {
    expect(cleanCommitMessage("```\nfeat: x\n```")).toBe("feat: x");
    expect(cleanCommitMessage('Commit-Nachricht: "fix: y"')).toBe("fix: y");
    expect(cleanCommitMessage("feat: z\n\n\n- a\n- b\n")).toBe("feat: z\n\n- a\n- b");
  });
});
