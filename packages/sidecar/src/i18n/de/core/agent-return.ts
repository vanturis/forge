/** German texts (core.agentReturn): finished parallel agents told to the session that started them. Source of the keys: the English file is typed against this one. */
export const agentReturn = {
  /** timeline text of the automatic message */
  oneDone: (name: string) => `Agent „${name}“ ist fertig.`,
  manyDone: (n: number) => `${n} Agenten sind fertig.`,
  label: (id: string, title: string | null, branch: string | null) =>
    `Agent ${id}${title ? ` („${title}“)` : ""}${branch ? `, Branch ${branch}` : ""}`,
  head: (woken: boolean): string =>
    woken
      ? "[FORGE-Hinweis, nicht vom Nutzer geschrieben] Parallele Agenten, die du mit start_agent gestartet hast, sind fertig. FORGE startet dafür diesen Durchlauf, der Nutzer hat nichts geschrieben."
      : "[FORGE-Hinweis, nicht vom Nutzer geschrieben] Seit deinem letzten Durchlauf sind parallele Agenten fertig geworden, die du mit start_agent gestartet hast:",
  agentHead: (label: string) => `## ${label}`,
  outcome: (outcome: "done" | "merged" | "skipped" | "waiting", message: string | null): string =>
    outcome === "merged"
      ? `FORGE: ${message ?? "zusammengeführt"} Seine Änderungen sind jetzt in deinem Branch.`
      : outcome === "skipped"
        ? `FORGE: ${message ?? "nicht zusammengeführt"} Sein Branch besteht weiter; zusammenführen oder verwerfen mit finish_agent nur nach Rücksprache mit dem Nutzer.`
        : outcome === "waiting"
          ? `FORGE: ${message ?? "Das Zusammenführen wartet."} FORGE führt ihn selbst zusammen, sobald es geht, und sagt dir dann Bescheid.`
          : "FORGE: Seine Änderungen liegen auf seinem Branch. Zusammenführen oder verwerfen mit finish_agent nur nach Rücksprache mit dem Nutzer.",
  answer: (text: string) => `Seine Schlussantwort:\n${text}`,
  noAnswer: "Er hat keine Schlussantwort geschrieben; agent_status zeigt seinen Stand.",
  lateHead: "Später zusammengeführt:",
  lateLine: (label: string, message: string) => `${label}: ${message}`,
  tail: (woken: boolean, running: number): string =>
    [
      woken
        ? "Werte das aus und berichte dem Nutzer knapp, was erledigt ist und was offen bleibt. Übernimm Hinweise, Rückfragen und Entscheidungen der Agenten, die der Nutzer kennen muss. Gehört als Nächstes etwas zu deiner Aufgabe, mach damit weiter."
        : "Berücksichtige das bei der Nachricht des Nutzers.",
      running > 0
        ? `Noch ${running === 1 ? "arbeitet 1 weiterer Agent" : `arbeiten ${running} weitere Agenten`}. Du musst nicht auf ${running === 1 ? "ihn" : "sie"} warten: FORGE meldet sich wieder, wenn ${running === 1 ? "er" : "sie"} fertig ${running === 1 ? "ist" : "sind"}.`
        : "",
    ]
      .filter(Boolean)
      .join(" "),
  notWoken: (reason: string) => `Ein Agent ist fertig, aber diese Session konnte nicht weiterarbeiten: ${reason}`,
};
