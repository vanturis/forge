import type { ServerEvent, Session, SessionStatus } from "@forge/protocol";

const BUSY: ReadonlySet<SessionStatus> = new Set<SessionStatus>(["starting", "running", "stopping", "waiting_approval"]);

export interface JobWatcherDeps {
  session(id: string): Session | null;
  /** the session that started this one as a parallel agent (start_agent) */
  parent(id: string): string | null;
  children(id: string): string[];
  emit(e: ServerEvent): void;
  /** the end of this agent brings the session that started it back with a turn of its own (AgentReturn) */
  wakes?(id: string): boolean;
  /** finished agents wait to be told to this session: a turn of it follows */
  expects?(id: string): boolean;
}

/**
 * Tells when a whole job is done (`session.done`), not every turn: a turn that leaves background
 * tasks running, or parallel agents it started, is only a step. Background tasks bring Claude back
 * with a new turn of their own, and so do agents (AgentReturn): the end of that turn decides. An
 * agent whose session cannot be told settles it instead. An agent's own end is part of that job and
 * is not announced.
 */
export class JobWatcher {
  /** turn ended successfully, but background tasks or agents were still at work */
  private readonly waiting = new Set<string>();

  constructor(private readonly d: JobWatcherDeps) {}

  onServerEvent(e: ServerEvent) {
    if (e.event !== "session.event" || e.payload.body.type !== "turn.result") return;
    const id = e.payload.sessionId;
    // Errors and stops are announced on their own (or were the user's doing): no "done" after them.
    if (e.payload.body.isError) this.waiting.delete(id);
    else this.settle(id, id);
  }

  /** `finished`: the session whose turn just ended; its status still says running at this point. */
  private settle(id: string, finished: string) {
    if (!this.open(id, finished)) {
      this.waiting.add(id);
      return;
    }
    this.waiting.delete(id);
    // The session that started this agent gets its result in a turn; that turn's end tells.
    if (id === finished && this.d.wakes?.(id)) return;
    const parent = this.d.parent(id);
    const p = parent ? this.d.session(parent) : null;
    if (parent && this.waiting.has(parent)) this.settle(parent, finished);
    // The starting session is still in its turn: its own end takes the agents into account.
    else if (!p || !BUSY.has(p.status)) this.d.emit({ event: "session.done", payload: { sessionId: id } });
  }

  /** Nothing of the job is left: no background task, no agent at work. */
  private open(id: string, finished: string): boolean {
    const s = this.d.session(id);
    if (!s || s.background.length || this.d.expects?.(id)) return false;
    if (id !== finished && BUSY.has(s.status)) return false;
    return this.d.children(id).every((c) => c === finished || !this.busy(c));
  }

  private busy(id: string): boolean {
    const s = this.d.session(id);
    return !!s && (BUSY.has(s.status) || s.background.length > 0 || this.waiting.has(id));
  }
}
