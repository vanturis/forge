import { describe, expect, it } from "vitest";
import type { SessionEvent, SessionEventBody } from "@forge/protocol";
import { formatElapsed, pickPhrase, PHRASE_INTERVAL_MS, retryText, turnStartedAt, WORKING_PHRASES } from "./working";

let seq = 0;
const ev = (body: SessionEventBody, ts: string): SessionEvent => ({ seq: ++seq, sessionId: "s1", ts, body });
const result: SessionEventBody = { type: "turn.result", subtype: "success", isError: false, text: "ok", durationMs: 1, numTurns: 1, inputTokens: null, outputTokens: null } as SessionEventBody;

describe("working indicator", () => {
  it("measures from the first message of the running turn, not from messages sent in between", () => {
    const events = [
      ev({ type: "user.message", text: "erster Durchlauf" }, "2026-10-10T10:00:00.000Z"),
      ev(result, "2026-10-10T10:01:00.000Z"),
      ev({ type: "user.message", text: "zweiter Durchlauf" }, "2026-10-10T10:05:00.000Z"),
      ev({ type: "user.message", text: "dazwischen" }, "2026-10-10T10:05:30.000Z"),
    ];
    expect(turnStartedAt(events)).toBe("2026-10-10T10:05:00.000Z");
    expect(turnStartedAt([])).toBeNull();
  });

  it("formats the elapsed time", () => {
    expect(formatElapsed(8_400)).toBe("8 s");
    expect(formatElapsed(65_000)).toBe("1 min 05 s");
    expect(formatElapsed(3_720_000)).toBe("1 h 02 min");
    expect(formatElapsed(-5)).toBe("0 s");
  });

  it("keeps a phrase for a while and then moves on", () => {
    const start = "2026-10-10T10:05:00.000Z";
    expect(pickPhrase(start, 0)).toBe(pickPhrase(start, PHRASE_INTERVAL_MS - 1));
    expect(pickPhrase(start, PHRASE_INTERVAL_MS)).not.toBe(pickPhrase(start, 0));
    expect(WORKING_PHRASES).toContain(pickPhrase(start, 123_456));
  });

  it("says why a request is sent again and when", () => {
    const now = Date.parse("2026-10-10T10:05:00.000Z");
    const retry = { attempt: 2, maxRetries: 10, retryAt: "2026-10-10T10:05:07.200Z", errorStatus: 529 as number | null, error: "overloaded" };
    expect(retryText(retry, now)).toBe("Die Claude-API ist überlastet. Neuer Versuch in 8 s (2 von 10).");
    // past the waiting time the attempt runs
    expect(retryText(retry, now + 8000)).toBe("Die Claude-API ist überlastet. Neuer Versuch läuft (2 von 10).");
    expect(retryText({ ...retry, errorStatus: null, error: "unknown" }, now)).toContain("antwortet nicht");
    expect(retryText({ ...retry, errorStatus: 500, error: "server_error" }, now)).toContain("HTTP 500");
    expect(retryText({ ...retry, errorStatus: 429, error: "rate_limit" }, now)).toContain("keine weiteren Anfragen");
  });
});
