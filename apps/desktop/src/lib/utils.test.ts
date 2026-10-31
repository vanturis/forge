import { describe, expect, it } from "vitest";
import { planLabel } from "./utils";

describe("planLabel", () => {
  it("uses the current plan names for what Claude Code still reports as max", () => {
    expect(planLabel({ subscriptionType: "max", rateLimitTier: "default_claude_max_20x" })).toBe("Ultra Abo");
    expect(planLabel({ subscriptionType: "max", rateLimitTier: "default_claude_max_5x" })).toBe("Max Abo");
    expect(planLabel({ subscriptionType: "ultra", rateLimitTier: null })).toBe("Ultra Abo");
  });

  it("keeps an unknown multiplier visible", () => {
    expect(planLabel({ subscriptionType: "max", rateLimitTier: "default_claude_max_40x" })).toBe("Max 40x Abo");
  });

  it("falls back to the plan alone", () => {
    expect(planLabel({ subscriptionType: "max", rateLimitTier: null })).toBe("Max Abo");
    expect(planLabel({ subscriptionType: "pro", rateLimitTier: "default_claude_ai" })).toBe("Pro Abo");
    expect(planLabel({ subscriptionType: null, rateLimitTier: null })).toBeNull();
  });
});
