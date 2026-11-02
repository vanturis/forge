import type { agentReturn as De } from "../../de/core/agent-return.js";

export const agentReturn: typeof De = {
  oneDone: (name) => `Agent "${name}" is done.`,
  manyDone: (n) => `${n} agents are done.`,
  label: (id, title, branch) => `Agent ${id}${title ? ` ("${title}")` : ""}${branch ? `, branch ${branch}` : ""}`,
  head: (woken) =>
    woken
      ? "[FORGE note, not written by the user] Parallel agents you started with start_agent are done. FORGE started this turn for that, the user wrote nothing."
      : "[FORGE note, not written by the user] Since your last turn, parallel agents you started with start_agent have finished:",
  agentHead: (label) => `## ${label}`,
  outcome: (outcome, message) =>
    outcome === "merged"
      ? `FORGE: ${message ?? "merged"} Its changes are now in your branch.`
      : outcome === "skipped"
        ? `FORGE: ${message ?? "not merged"} Its branch remains; merge or discard it with finish_agent only after checking with the user.`
        : outcome === "waiting"
          ? `FORGE: ${message ?? "The merge is waiting."} FORGE merges it itself as soon as possible and tells you then.`
          : "FORGE: Its changes are on its branch. Merge or discard it with finish_agent only after checking with the user.",
  answer: (text) => `Its final answer:\n${text}`,
  noAnswer: "It wrote no final answer; agent_status shows its state.",
  lateHead: "Merged later:",
  lateLine: (label, message) => `${label}: ${message}`,
  tail: (woken, running) =>
    [
      woken
        ? "Evaluate this and briefly tell the user what is done and what remains open. Pass on notes, questions and decisions of the agents the user needs to know. If something next belongs to your task, carry on with it."
        : "Take this into account with the user's message.",
      running > 0
        ? `${running === 1 ? "1 more agent is" : `${running} more agents are`} still working. You don't need to wait for ${running === 1 ? "it" : "them"}: FORGE reports back when ${running === 1 ? "it is" : "they are"} done.`
        : "",
    ]
      .filter(Boolean)
      .join(" "),
  notWoken: (reason) => `An agent is done, but this session could not continue: ${reason}`,
};
