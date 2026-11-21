import type { ClaudeSetupState, ClaudeStartUpdate, ClaudeUpdateInfo } from "@forge/protocol";

/** The whole check (CLI version and release endpoint) may take this long; after it FORGE starts without the update. */
export const CHECK_LIMIT_MS = 4_000;
/** An update running this long offers going on without it. */
export const SKIP_OFFER_MS = 60_000;
/** After this long nothing waits for the update any more, also when nobody answers (phone, crew, sessions coming back). */
export const GIVE_UP_MS = 5 * 60_000;

export interface StartUpdateDeps {
  /** setting claudeUpdateOnStart */
  enabled: () => boolean;
  check: () => Promise<ClaudeUpdateInfo>;
  /** starts the update; its progress comes back through onSetup() */
  update: () => ClaudeSetupState;
  emit: (s: ClaudeStartUpdate) => void;
  log?: (m: string) => void;
}

const IDLE: ClaudeStartUpdate = { phase: "idle", installed: null, latest: null, message: null, skippable: false };

function settled<T>(p: Promise<T>, limitMs: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), limitMs);
    timer.unref?.();
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
    );
  });
}

/**
 * Installs a waiting Claude Code update when FORGE starts. Sessions started meanwhile would run the
 * old CLI while it is being replaced, so their start waits here (wait()); the window only shows it.
 * Nothing waits once the update failed: no CLI is being replaced then, and the lock on the screen is
 * the user's to answer.
 */
export class ClaudeStartUpdateService {
  private state: ClaudeStartUpdate = IDLE;
  private waiters: Array<() => void> = [];
  private timers: Array<ReturnType<typeof setTimeout>> = [];
  private ran = false;

  constructor(private readonly deps: StartUpdateDeps) {}

  current(): ClaudeStartUpdate {
    return this.state;
  }

  /** The check or the update runs: no session may start. */
  blocking(): boolean {
    return this.state.phase === "checking" || this.state.phase === "updating";
  }

  /** Resolves once sessions may start; null when they may right now. */
  wait(): Promise<void> | null {
    if (!this.blocking()) return null;
    return new Promise((resolve) => this.waiters.push(resolve));
  }

  private set(patch: Partial<ClaudeStartUpdate>) {
    this.state = { ...this.state, ...patch };
    if (this.state.phase !== "updating") this.clearTimers();
    this.deps.emit(this.state);
    if (this.blocking()) return;
    for (const done of this.waiters.splice(0)) done();
  }

  private clearTimers() {
    for (const t of this.timers.splice(0)) clearTimeout(t);
  }

  /** Runs once, at the start of FORGE; later updates are the user's (button in the sidebar). Never throws; without network or with a failing check nothing happens. */
  async run(): Promise<void> {
    if (this.ran) return;
    this.ran = true;
    if (!this.deps.enabled()) return;
    this.set({ ...IDLE, phase: "checking" });
    const info = await settled(this.deps.check(), CHECK_LIMIT_MS);
    // skipped meanwhile
    if (this.current().phase !== "checking") return;
    if (!info?.available) {
      this.set({ phase: "idle", installed: info?.installed ?? null, latest: info?.latest ?? null });
      return;
    }
    this.deps.log?.(`Claude Code ${info.installed ?? "?"} -> ${info.latest ?? "?"}: Update beim Start`);
    this.begin(info.installed, info.latest);
  }

  private begin(installed: string | null, latest: string | null) {
    this.set({ phase: "updating", installed, latest, message: null, skippable: false });
    try {
      this.deps.update();
    } catch (e) {
      this.set({ phase: "failed", message: e instanceof Error ? e.message : String(e) });
      return;
    }
    const offer = setTimeout(() => this.state.phase === "updating" && this.set({ skippable: true }), SKIP_OFFER_MS);
    const giveUp = setTimeout(() => this.state.phase === "updating" && this.set({ phase: "skipped" }), GIVE_UP_MS);
    offer.unref?.();
    giveUp.unref?.();
    this.timers.push(offer, giveUp);
  }

  /** Every state of the install or update step; only those of the update started here count. */
  onSetup(s: ClaudeSetupState) {
    if (this.state.phase !== "updating" || (s.task !== "update" && s.task !== "install")) return;
    if (s.phase === "done") this.set({ phase: "done" });
    else if (s.phase === "error") this.set({ phase: "failed", message: s.message });
    else if (s.phase === "cancelled") this.set({ phase: "skipped" });
  }

  /** Runs a failed update again. */
  retry(): ClaudeStartUpdate {
    if (this.state.phase === "failed") this.begin(this.state.installed, this.state.latest);
    return this.state;
  }

  /** Goes on without the update. One that still runs is left to finish: ending it halfway helps nobody. */
  skip(): ClaudeStartUpdate {
    if (this.blocking() || this.state.phase === "failed") this.set({ phase: "skipped" });
    return this.state;
  }

  shutdown() {
    this.clearTimers();
  }
}
