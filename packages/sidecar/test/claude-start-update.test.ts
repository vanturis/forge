import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ClaudeSetupState, ClaudeStartUpdate, ClaudeUpdateInfo } from "@forge/protocol";
import { CHECK_LIMIT_MS, ClaudeStartUpdateService, GIVE_UP_MS, SKIP_OFFER_MS } from "../src/claude/start-update.js";

const info = (patch: Partial<ClaudeUpdateInfo> = {}): ClaudeUpdateInfo => ({
  installed: "2.1.100",
  latest: "2.1.105",
  channel: "latest",
  available: true,
  checkedAt: "2026-11-21T08:00:00.000Z",
  error: null,
  ...patch,
});
const setupState = (patch: Partial<ClaudeSetupState>): ClaudeSetupState => ({ task: "update", phase: "running", url: null, log: [], message: null, ...patch });

function make(opts: { enabled?: boolean; check?: () => Promise<ClaudeUpdateInfo>; update?: () => ClaudeSetupState } = {}) {
  const states: ClaudeStartUpdate[] = [];
  const update = vi.fn(opts.update ?? (() => setupState({})));
  const check = vi.fn(opts.check ?? (async () => info()));
  const svc = new ClaudeStartUpdateService({ enabled: () => opts.enabled ?? true, check, update, emit: (s) => states.push(s) });
  return { svc, states, update, check };
}

/** Whether the promise sessions wait on has resolved by now. */
async function opened(wait: Promise<void> | null): Promise<boolean> {
  if (!wait) return true;
  let done = false;
  void wait.then(() => (done = true));
  await Promise.resolve();
  await Promise.resolve();
  return done;
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("Claude Code update at the start of FORGE", () => {
  it("installs a waiting update and holds session starts until it is done", async () => {
    const { svc, states, update } = make();
    const run = svc.run();
    expect(svc.current().phase).toBe("checking");
    const duringCheck = svc.wait();
    expect(duringCheck).not.toBeNull();
    await run;

    expect(update).toHaveBeenCalledTimes(1);
    expect(svc.current()).toMatchObject({ phase: "updating", installed: "2.1.100", latest: "2.1.105", skippable: false });
    expect(svc.blocking()).toBe(true);
    const duringUpdate = svc.wait();
    expect(await opened(duringCheck)).toBe(false);
    expect(await opened(duringUpdate)).toBe(false);

    // What the updater prints on the way does not end it.
    svc.onSetup(setupState({ log: ["Downloading 2.1.105"] }));
    expect(svc.current().phase).toBe("updating");

    svc.onSetup(setupState({ phase: "done", message: "Claude Code 2.1.105 ist installiert." }));
    expect(svc.current().phase).toBe("done");
    expect(svc.blocking()).toBe(false);
    expect(svc.wait()).toBeNull();
    expect(await opened(duringCheck)).toBe(true);
    expect(await opened(duringUpdate)).toBe(true);
    expect(states.map((s) => s.phase)).toEqual(["checking", "updating", "done"]);
  });

  it("follows the install that replaces a CLI of a package manager", async () => {
    const { svc } = make({ update: () => setupState({ task: "install" }) });
    await svc.run();
    svc.onSetup(setupState({ task: "install", phase: "done" }));
    expect(svc.current().phase).toBe("done");
  });

  it("does nothing when switched off", async () => {
    const { svc, states, check, update } = make({ enabled: false });
    await svc.run();
    expect(check).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(states).toEqual([]);
    expect(svc.wait()).toBeNull();
  });

  it.each([
    ["Claude Code is current", info({ latest: "2.1.100", available: false })],
    ["there is no network", info({ latest: null, available: false, error: "fetch failed" })],
    ["no CLI is installed", info({ installed: null, available: false })],
  ])("goes on without a lock and without a message when %s", async (_why, result) => {
    const { svc, update } = make({ check: async () => result });
    const run = svc.run();
    const wait = svc.wait();
    await run;
    expect(update).not.toHaveBeenCalled();
    expect(svc.current()).toMatchObject({ phase: "idle", message: null });
    expect(await opened(wait)).toBe(true);
  });

  it("goes on when the check throws", async () => {
    const { svc, update } = make({ check: async () => Promise.reject(new Error("boom")) });
    await svc.run();
    expect(update).not.toHaveBeenCalled();
    expect(svc.current().phase).toBe("idle");
  });

  it("does not wait longer than a few seconds for the check, and a late answer starts nothing", async () => {
    let answer: (i: ClaudeUpdateInfo) => void = () => {};
    const { svc, update } = make({ check: () => new Promise<ClaudeUpdateInfo>((r) => (answer = r)) });
    const run = svc.run();
    const wait = svc.wait();
    await vi.advanceTimersByTimeAsync(CHECK_LIMIT_MS - 1);
    expect(svc.current().phase).toBe("checking");
    await vi.advanceTimersByTimeAsync(1);
    await run;
    expect(svc.current().phase).toBe("idle");
    expect(await opened(wait)).toBe(true);

    answer(info());
    await Promise.resolve();
    expect(update).not.toHaveBeenCalled();
    expect(svc.current().phase).toBe("idle");
  });

  it("reports why the update failed, lets sessions start and offers a retry", async () => {
    const { svc, update } = make();
    await svc.run();
    const wait = svc.wait();
    svc.onSetup(setupState({ phase: "error", message: "Dieses Claude Code wird von einem Paketmanager verwaltet." }));

    expect(svc.current()).toMatchObject({ phase: "failed", message: "Dieses Claude Code wird von einem Paketmanager verwaltet.", latest: "2.1.105" });
    // Nothing is being replaced any more: FORGE is not held hostage by a failed update.
    expect(svc.blocking()).toBe(false);
    expect(await opened(wait)).toBe(true);

    expect(svc.retry()).toMatchObject({ phase: "updating", message: null, installed: "2.1.100", latest: "2.1.105" });
    expect(update).toHaveBeenCalledTimes(2);
    expect(svc.blocking()).toBe(true);
    svc.onSetup(setupState({ phase: "done" }));
    expect(svc.current().phase).toBe("done");
  });

  it("fails with the reason when the update cannot even start", async () => {
    const { svc } = make({
      update: () => {
        throw new Error("Es läuft bereits ein Einrichtungsschritt.");
      },
    });
    await svc.run();
    expect(svc.current()).toMatchObject({ phase: "failed", message: "Es läuft bereits ein Einrichtungsschritt." });
    expect(svc.blocking()).toBe(false);
  });

  it("goes on without the update when asked to, from a failure or while it still runs", async () => {
    const failed = make();
    await failed.svc.run();
    failed.svc.onSetup(setupState({ phase: "error", message: "kaputt" }));
    expect(failed.svc.skip().phase).toBe("skipped");

    const running = make();
    await running.svc.run();
    const wait = running.svc.wait();
    expect(running.svc.skip().phase).toBe("skipped");
    expect(await opened(wait)).toBe(true);
    // The update finishing in the background changes nothing any more.
    running.svc.onSetup(setupState({ phase: "error", message: "zu spät" }));
    expect(running.svc.current()).toMatchObject({ phase: "skipped", message: null });
  });

  it("offers a way out of a hanging update and gives up on its own in the end", async () => {
    const { svc } = make();
    await svc.run();
    const wait = svc.wait();
    await vi.advanceTimersByTimeAsync(SKIP_OFFER_MS - 1);
    expect(svc.current()).toMatchObject({ phase: "updating", skippable: false });
    await vi.advanceTimersByTimeAsync(1);
    expect(svc.current()).toMatchObject({ phase: "updating", skippable: true });
    expect(await opened(wait)).toBe(false);

    await vi.advanceTimersByTimeAsync(GIVE_UP_MS - SKIP_OFFER_MS);
    expect(svc.current().phase).toBe("skipped");
    expect(await opened(wait)).toBe(true);
  });

  it("does not offer the way out once the update ended in time", async () => {
    const { svc, states } = make();
    await svc.run();
    svc.onSetup(setupState({ phase: "done" }));
    const emitted = states.length;
    await vi.advanceTimersByTimeAsync(GIVE_UP_MS);
    expect(states).toHaveLength(emitted);
    expect(svc.current()).toMatchObject({ phase: "done", skippable: false });
  });

  it("ignores setup steps that are not its update", async () => {
    const { svc } = make();
    // A login that fails while nothing is updating.
    svc.onSetup(setupState({ task: "login", phase: "error", message: "abgebrochen" }));
    expect(svc.current().phase).toBe("idle");
    await svc.run();
    svc.onSetup(setupState({ task: "login", phase: "done" }));
    expect(svc.current().phase).toBe("updating");
    // Retry and skip have nothing to do outside their states.
    expect(svc.retry().phase).toBe("updating");
    svc.onSetup(setupState({ phase: "done" }));
    expect(svc.skip().phase).toBe("done");
  });

  it("runs only once per start", async () => {
    const { svc, check } = make({ check: async () => info({ available: false }) });
    await svc.run();
    await svc.run();
    expect(check).toHaveBeenCalledTimes(1);
  });
});
