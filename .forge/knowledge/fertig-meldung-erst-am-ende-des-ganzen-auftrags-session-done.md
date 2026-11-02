---
title: "Fertig-Meldung und fertige Agenten: Hauptsession macht weiter (session.done, AgentReturn)"
summary: "Wann FORGE „Claude ist fertig“ meldet (erst am Ende des ganzen Auftrags) und wie ein fertiger paralleler Agent die startende Session mit einem eigenen Durchlauf zurückholt (AgentReturn)."
tags: ["agenten","sessions","hintergrund","telefon","stolperfalle"]
updated: "2026-11-02T18:10:14.192Z"
---

## Entscheidungen
- 2026-10-13: „Fertig“ (Ton, Windows-Benachrichtigung, Anruf) erst, wenn der ganze Auftrag fertig ist, nicht nach jedem Durchlauf mit laufenden Hintergrund-Aufgaben oder Agenten.
- 2026-11-02: Die Hauptsession soll wie im echten Claude Code auf fertige Agenten reagieren. Vorher gab es nur eine Zeile im Chat (nur UI); Claude erfuhr nichts, nicht einmal mit der nächsten Nachricht.

## Fertige Agenten → Durchlauf der Elternsession (`sessions/agent-return.ts`, `AgentReturn`)
- Auslöser: `TurnAutomation.turnDone` → `SessionService.agentTurnDone`: erst Snapshot (Titel, `lastAnswer`, Branch), denn auto-merge löscht die Agent-Session; dann `AgentAutoMerge.turnDone` (gibt jetzt `AutoMergeResult` zurück); dann `AgentReturn.finished`.
- Nicht gemeldet: Agent mit Hintergrund-Aufgaben, Konflikt (geht an den Agenten zurück, er arbeitet weiter), auto-merge ohne Ergebnis (neuer Durchlauf des Agenten), fehlgeschlagene Durchläufe (Fehler meldet FORGE eh sofort), Elternsession gelöscht oder Crew-Spiegel.
- Elternsession frei → sofort `turns.send(parent, "Agent „X“ ist fertig.", [], "auto", { agents, note })`. Der Hinweis (`core.agentReturn`, Schlussantwort bis 6000 Zeichen, Merge-Ergebnis, Zahl noch laufender Agenten) geht als Block vor dem Text an Claude, die Timeline zeigt nur den Text + `user.message.agents` (`AgentReturnRef`).
- Elternsession beschäftigt → gesammelt; nach ihrem `turnDone` (nach Auto-Commit und den Merges, die dadurch möglich wurden, `retryWaiting` → `settled`) ein gemeinsamer Durchlauf. Schreibt der Nutzer vorher, gehen sie per `TurnHost.note` → `takeNote` mit seiner Nachricht mit (kein extra Durchlauf).
- Merge „waiting“ schon gemeldet → späteres „merged“ kommt nur als Hinweis mit der nächsten Nachricht (`late`), kein zweites Wecken. `forget()` beim Löschen der Agent-Session (Merge) behält das absichtlich.
- Senden scheitert → Fehler in der Elternsession + `session.done`.
- Desktop: `AgentReturnMessage` in `UserMessage.tsx` (schlanke Zeile je Agent, Bot-Icon, Klick/Rechtsklick öffnet die Agent-Session, solange sie existiert).

## session.done (`sessions/job-done.ts`, `JobWatcher`, in `app.ts`)
- Erfolgreiches `turn.result` mit laufenden Hintergrund-Aufgaben oder beschäftigten Kind-Sessions: Session wartet (`waiting`), kein done. Hintergrund-Aufgaben starten selbst einen neuen Durchlauf; dessen Ende entscheidet.
- Agenten: `wakes(agent)` true → weder Agent noch Elternsession werden beim Agent-Ende gemeldet; der Durchlauf auf das Ergebnis entscheidet. `expects(parent)` (wartende Agent-Ergebnisse) hält die Elternsession offen. Agent ohne meldbare Elternsession meldet sich wie früher selbst bzw. settled die wartende Elternsession.
- Beim `turn.result` steht die Session selbst noch auf running; deshalb wird `finished` beim Prüfen ausgenommen. Fehler/Unterbrechungen löschen `waiting`.
- Restlücke: Endet die Elternsession genau zwischen Agent-`turn.result` und dessen Merge, kann done zweimal kommen.

## Abnehmer
- Desktop: `apps/desktop/src/lib/server-events.ts` (`session.done`: Ton + `notifyDone`).
- Telefon: `PhoneService.onServerEvent` ruft bei `session.done` an und erzählt `lastTurn`, jetzt also Claudes Auswertung der Agenten.
- Tests: `test/job-done.test.ts`, `test/agent-return.test.ts`, `session-service.test.ts` „brings the starting session back…“.
