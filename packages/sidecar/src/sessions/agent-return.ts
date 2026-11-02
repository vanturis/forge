import type { AgentReturnRef, SessionEventBody } from "@forge/protocol";
import type { AutoMergeResult } from "../automation/agent-auto-merge.js";
import type { Db } from "../persistence/db.js";
import { lastAnswer } from "../phone/session-info.js";
import { tr } from "../i18n/index.js";
import type { TaskTurn } from "./turns.js";

/** Longest final answer of an agent passed on in full; agents are asked for a short summary. */
export const MAX_ANSWER_CHARS = 6_000;

/** An agent whose job is done, waiting to be told to the session that started it. */
export interface FinishedAgent {
  sessionId: string;
  title: string | null;
  branch: string | null;
  answer: string;
  outcome: AgentReturnRef["outcome"];
  /** what auto-merge said; null without auto-merge */
  message: string | null;
}

export interface AgentReturnDeps {
  db: Db;
  /** the session that started this one with start_agent */
  parentOf(sessionId: string): string | null;
  /** agents the session started */
  children(sessionId: string): string[];
  /** the session works, waits for a decision, gets a message or runs its post-turn work: no new turn now */
  busy(sessionId: string): boolean;
  /** background tasks of the session still run; their end brings a turn of its own */
  hasBackground(sessionId: string): boolean;
  /** starts a turn of the session with an automatic message ("auto") */
  send(sessionId: string, text: string, turn: TaskTurn): Promise<unknown>;
  record(sessionId: string, body: SessionEventBody): void;
  /** the whole job of the session is done (no turn followed) */
  done(sessionId: string): void;
  track(p: Promise<unknown>): void;
}

/**
 * Brings the session that started parallel agents back when one of them is done, like Claude Code does
 * for its own background agents: a turn of its own with the agent's final answer and what FORGE did
 * with its branch. While the session works, finished agents wait for the end of that turn and come in
 * together; when the user writes first, they go along with that message.
 */
export class AgentReturn {
  /** session that started them -> agents done since it last heard of them */
  private readonly pending = new Map<string, FinishedAgent[]>();
  /** agent -> session told it waits for the merge; the merge later goes along with its next message */
  private readonly toldWaiting = new Map<string, string>();
  /** session -> later merges of agents it was told about, for its next message */
  private readonly late = new Map<string, string[]>();

  constructor(private readonly d: AgentReturnDeps) {}

  /** A turn of a start_agent agent ends: it is reported to the session that started it (which still exists). */
  wakes(agentId: string): boolean {
    const parent = this.d.parentOf(agentId);
    const rec = parent ? this.d.db.getSession(parent) : null;
    return !!rec && !rec.mirror;
  }

  /**
   * What is needed of an agent whose turn ended, read before auto-merge removes its session.
   * null: no agent of a session that is told, or its background tasks keep it at work.
   */
  snapshot(agentId: string, branch: string | null): Omit<FinishedAgent, "outcome" | "message"> | null {
    if (!this.wakes(agentId) || this.d.hasBackground(agentId)) return null;
    const rec = this.d.db.getSession(agentId);
    if (!rec) return null;
    return { sessionId: agentId, title: rec.title ?? null, branch, answer: lastAnswer(this.d.db, agentId) };
  }

  /** The agent's post-turn work is done; `merge`: what auto-merge did (null without it). */
  finished(snap: Omit<FinishedAgent, "outcome" | "message">, merge: AutoMergeResult | null, parentId: string | null) {
    // A conflict went back to the agent: it works on, its next end is reported.
    if (merge?.outcome === "conflict") return;
    const parent = parentId ?? this.d.parentOf(snap.sessionId);
    if (!parent || !this.d.db.getSession(parent)) return;
    const entry: FinishedAgent = {
      ...snap,
      branch: merge?.branch ?? snap.branch,
      outcome: merge ? merge.outcome : "done",
      message: merge?.message ?? null,
    };
    const list = (this.pending.get(parent) ?? []).filter((a) => a.sessionId !== snap.sessionId);
    this.pending.set(parent, [...list, entry]);
    this.flush(parent);
  }

  /** A later try of auto-merge settled a waiting agent: the waiting report gets the result, or the next message does. */
  settled(agentId: string, merge: AutoMergeResult) {
    for (const [parent, list] of this.pending) {
      const hit = list.find((a) => a.sessionId === agentId);
      if (!hit) continue;
      if (merge.outcome === "conflict") {
        // Back to the agent: it reports again when it is through.
        this.pending.set(parent, list.filter((a) => a !== hit));
      } else {
        hit.outcome = merge.outcome;
        hit.message = merge.message;
        hit.branch = merge.branch ?? hit.branch;
      }
      this.flush(parent);
      return;
    }
    const parent = this.toldWaiting.get(agentId);
    if (!parent) return;
    this.toldWaiting.delete(agentId);
    if (!this.d.db.getSession(parent)) return;
    this.late.set(parent, [...(this.late.get(parent) ?? []), tr().core.agentReturn.lateLine(this.label(agentId, null), merge.message)]);
  }

  /** Finished agents wait to be told to this session. */
  expects(sessionId: string): boolean {
    return (this.pending.get(sessionId)?.length ?? 0) > 0;
  }

  /** A turn of the session ended and its post-turn work (auto-commit, merges) is done: agents done meanwhile come in now. */
  turnDone(sessionId: string) {
    this.flush(sessionId);
  }

  /** Agents done and later merges, for a message the user sends before FORGE could start a turn. */
  takeNote(sessionId: string): string | null {
    const list = this.pending.get(sessionId) ?? [];
    this.pending.delete(sessionId);
    const late = this.late.get(sessionId) ?? [];
    this.late.delete(sessionId);
    if (!list.length && !late.length) return null;
    this.rememberWaiting(sessionId, list);
    return this.note(sessionId, list, late, false);
  }

  /** The session is deleted. An agent's own deletion (its merge) keeps what its parent is still to hear. */
  forget(sessionId: string) {
    this.pending.delete(sessionId);
    this.late.delete(sessionId);
    for (const [agent, parent] of this.toldWaiting) if (parent === sessionId) this.toldWaiting.delete(agent);
  }

  private flush(parent: string) {
    const list = this.pending.get(parent);
    if (!list?.length) return;
    const rec = this.d.db.getSession(parent);
    if (!rec || rec.mirror) {
      this.pending.delete(parent);
      return;
    }
    if (this.d.busy(parent)) return;
    this.pending.delete(parent);
    const late = this.late.get(parent) ?? [];
    this.late.delete(parent);
    this.rememberWaiting(parent, list);
    const m = tr().core.agentReturn;
    const refs: AgentReturnRef[] = list.map((a) => ({ sessionId: a.sessionId, title: a.title, branch: a.branch, outcome: a.outcome }));
    const text = list.length === 1 ? m.oneDone(list[0]!.title ?? list[0]!.branch ?? short(list[0]!.sessionId)) : m.manyDone(list.length);
    this.d.track(
      this.d.send(parent, text, { agents: refs, note: this.note(parent, list, late, true) }).catch((e: unknown) => {
        // The session cannot go on (folder gone, no Claude): the user sees why, and the job counts as done.
        this.d.record(parent, { type: "error", message: m.notWoken(e instanceof Error ? e.message : String(e)), retryable: false });
        this.d.done(parent);
      }),
    );
  }

  /** Agents reported as waiting for the merge: their merge goes along with the session's next message. */
  private rememberWaiting(parent: string, list: FinishedAgent[]) {
    for (const a of list) if (a.outcome === "waiting") this.toldWaiting.set(a.sessionId, parent);
  }

  private label(agentId: string, a: Pick<FinishedAgent, "title" | "branch"> | null): string {
    const title = a?.title ?? this.d.db.getSession(agentId)?.title ?? null;
    return tr().core.agentReturn.label(short(agentId), title, a?.branch ?? null);
  }

  private note(parent: string, list: FinishedAgent[], late: string[], woken: boolean): string {
    const m = tr().core.agentReturn;
    const blocks = list.map((a) =>
      [
        m.agentHead(this.label(a.sessionId, a)),
        m.outcome(a.outcome, a.message),
        a.answer.trim() ? m.answer(cut(a.answer.trim())) : m.noAnswer,
      ].join("\n"),
    );
    const running = this.d.children(parent).filter((c) => !list.some((a) => a.sessionId === c) && this.d.busy(c)).length;
    return [m.head(woken), ...blocks, ...(late.length ? [m.lateHead, ...late.map((l) => `- ${l}`)] : []), m.tail(woken, running)].join("\n\n");
  }
}

const short = (id: string) => id.slice(0, 8);

function cut(text: string): string {
  return text.length > MAX_ANSWER_CHARS ? `${text.slice(0, MAX_ANSWER_CHARS)} …` : text;
}
