import { describe, expect, it } from "vitest";
import type { SessionEventBody } from "@forge/protocol";
import { AgentReturn } from "../src/sessions/agent-return.js";
import type { TaskTurn } from "../src/sessions/turns.js";
import type { Db } from "../src/persistence/db.js";

interface FakeSession {
  title: string | null;
  parent: string | null;
  busy?: boolean;
  background?: boolean;
  mirror?: boolean;
  answer?: string;
}

function setup(initial: Record<string, FakeSession>, opts: { sendFails?: boolean } = {}) {
  const sessions = new Map(Object.entries(initial));
  const sent: Array<{ id: string; text: string; turn: TaskTurn }> = [];
  const recorded: Array<{ id: string; body: SessionEventBody }> = [];
  const done: string[] = [];
  const tracked: Promise<unknown>[] = [];
  const db = {
    getSession: (id: string) => {
      const s = sessions.get(id);
      return s ? { id, title: s.title, ...(s.mirror ? { mirror: { memberId: "m" } } : {}) } : null;
    },
    listEvents: (id: string) => {
      const a = sessions.get(id)?.answer;
      return a ? [{ seq: 1, sessionId: id, ts: "", body: { type: "turn.result", subtype: "success", isError: false, text: a } }] : [];
    },
  } as unknown as Db;
  const ret = new AgentReturn({
    db,
    parentOf: (id) => sessions.get(id)?.parent ?? null,
    children: (id) => [...sessions.entries()].filter(([, s]) => s.parent === id).map(([c]) => c),
    busy: (id) => !!sessions.get(id)?.busy,
    hasBackground: (id) => !!sessions.get(id)?.background,
    send: async (id, text, turn) => {
      if (opts.sendFails) throw new Error("Ordner fehlt");
      sent.push({ id, text, turn });
    },
    record: (id, body) => recorded.push({ id, body }),
    done: (id) => done.push(id),
    track: (p) => tracked.push(p),
  });
  const finish = (id: string, merge: Parameters<AgentReturn["finished"]>[1] = null) => {
    const snap = ret.snapshot(id, `agent/${id}`);
    if (snap) ret.finished(snap, merge, sessions.get(id)!.parent);
    return snap;
  };
  return { sessions, ret, sent, recorded, done, finish, settle: () => Promise.all(tracked) };
}

describe("AgentReturn", () => {
  it("starts a turn of the idle starting session with the agent's final answer", () => {
    const { sent, finish } = setup({ p: { title: "Haupt", parent: null }, a: { title: "CSV-Export", parent: "p", answer: "CSV-Export fertig, Tests grün. Offen: Doku." } });
    finish("a");
    expect(sent).toHaveLength(1);
    expect(sent[0]!.id).toBe("p");
    expect(sent[0]!.text).toContain("CSV-Export");
    expect(sent[0]!.turn.agents).toEqual([{ sessionId: "a", title: "CSV-Export", branch: "agent/a", outcome: "done" }]);
    expect(sent[0]!.turn.note).toContain("CSV-Export fertig, Tests grün. Offen: Doku.");
    expect(sent[0]!.turn.note).toContain("agent/a");
  });

  it("holds agents done while the session works and brings them in together after its turn", () => {
    const { sessions, ret, sent, finish } = setup({
      p: { title: null, parent: null, busy: true },
      a: { title: "A", parent: "p", answer: "a fertig" },
      b: { title: "B", parent: "p", answer: "b fertig" },
    });
    finish("a");
    finish("b");
    expect(sent).toEqual([]);
    expect(ret.expects("p")).toBe(true);
    sessions.get("p")!.busy = false;
    ret.turnDone("p");
    expect(sent).toHaveLength(1);
    expect(sent[0]!.turn.agents?.map((x) => x.sessionId)).toEqual(["a", "b"]);
    expect(sent[0]!.turn.note).toContain("a fertig");
    expect(sent[0]!.turn.note).toContain("b fertig");
    expect(ret.expects("p")).toBe(false);
  });

  it("gives finished agents to the user's own message when it comes first", () => {
    const { ret, sent, finish } = setup({ p: { title: null, parent: null, busy: true }, a: { title: "A", parent: "p", answer: "a fertig" } });
    finish("a");
    expect(ret.takeNote("p")).toContain("a fertig");
    ret.turnDone("p");
    expect(sent).toEqual([]);
    expect(ret.takeNote("p")).toBeNull();
  });

  it("names the merge result, and leaves an agent whose conflict went back to it", () => {
    const { sent, finish } = setup({ p: { title: null, parent: null }, a: { title: "A", parent: "p" }, b: { title: "B", parent: "p" } });
    finish("b", { outcome: "conflict", message: "Konflikt", branch: "agent/b" });
    expect(sent).toEqual([]);
    finish("a", { outcome: "merged", message: "Automatisch zusammengeführt: 2 Commits", branch: "agent/a" });
    expect(sent[0]!.turn.agents?.[0]?.outcome).toBe("merged");
    expect(sent[0]!.turn.note).toContain("2 Commits");
  });

  it("updates a waiting merge before the report goes out, and tells a later merge with the next message", () => {
    const { sessions, ret, sent, finish } = setup({ p: { title: null, parent: null, busy: true }, a: { title: "A", parent: "p" }, b: { title: "B", parent: "p" } });
    finish("a", { outcome: "waiting", message: "wartet", branch: "agent/a" });
    sessions.get("p")!.busy = false;
    ret.settled("a", { outcome: "merged", message: "zusammengeführt", branch: "agent/a" });
    expect(sent[0]!.turn.agents?.[0]?.outcome).toBe("merged");

    finish("b", { outcome: "waiting", message: "wartet", branch: "agent/b" });
    expect(sent[1]!.turn.agents?.[0]?.outcome).toBe("waiting");
    ret.settled("b", { outcome: "merged", message: "jetzt zusammengeführt", branch: "agent/b" });
    expect(sent).toHaveLength(2);
    expect(ret.takeNote("p")).toContain("jetzt zusammengeführt");
  });

  it("does not report agents with background tasks, of deleted or read-only sessions", () => {
    const { ret, sent, finish } = setup({
      p: { title: null, parent: null },
      m: { title: null, parent: null, mirror: true },
      a: { title: "A", parent: "p", background: true },
      b: { title: "B", parent: "gone" },
      c: { title: "C", parent: "m" },
    });
    expect(finish("a")).toBeNull();
    expect(finish("b")).toBeNull();
    expect(finish("c")).toBeNull();
    expect(ret.wakes("b")).toBe(false);
    expect(sent).toEqual([]);
  });

  it("tells the user and counts the job done when the session cannot go on", async () => {
    const { recorded, done, finish, settle } = setup({ p: { title: null, parent: null }, a: { title: "A", parent: "p" } }, { sendFails: true });
    finish("a");
    await settle();
    expect(recorded[0]).toMatchObject({ id: "p", body: { type: "error" } });
    expect(done).toEqual(["p"]);
  });
});
