---
title: "Claude Code und Agent SDK aktuell halten: Neuerungen prüfen und einbauen (Dependabot, Changelog, MCP-Rückfragen, Probe)"
summary: "Wie FORGE Claude-Code-Neuerungen nachzieht, was zuletzt geprüft wurde, was bewusst fehlt, wie MCP-Rückfragen (Elicitation) laufen und wie man neue Optionen mit der echten CLI prüft."
tags: ["sdk","update","sidecar","konvention","telefon"]
updated: "2026-11-02T14:06:08.425Z"
---

Wunsch des Besitzers (2026-11-02): FORGE soll immer auf dem neuesten Stand von Claude Code sein und gute Funktionen vereinfacht zeigen.

## Stand
Geprüft bis Claude Code 2.1.316 und Agent SDK 0.3.316. „Claude Code 2.0“ ist im offiziellen Changelog die Version von September 2025; FORGE arbeitet längst auf 2.1.x.

## Ablauf bei neuen Versionen
- `.github/dependabot.yml` öffnet wöchentlich einen PR gegen `dev`, nur für `@anthropic-ai/claude-agent-sdk`. Nach dem Update `pnpm notices` nicht vergessen.
- FORGE startet die CLI selbst (`pathToClaudeCodeExecutable`), CLI-Fehlerbehebungen kommen also unabhängig vom SDK. Neue Optionen und Typen brauchen das SDK.
- Changelogs: `raw.githubusercontent.com/anthropics/claude-code/refs/heads/main/CHANGELOG.md` und `.../claude-agent-sdk-typescript/main/CHANGELOG.md`. Die CLI-Datei ist über 1 MB groß, darum mit curl holen und abschnittsweise lesen. Zum Vergleich hilft ein diff der `sdk.d.ts` zwischen installierter und neuer Version.
- Neue Optionen zuerst mit der echten CLI prüfen: kleines Skript im Temp-Ordner mit `query()` aus dem SDK des Sidecars, `model: "haiku"`, `settingSources: []`, `persistSession: false`, `pathToClaudeCodeExecutable: ~/.local/bin/claude`. Die CLI unter `/opt/homebrew/bin` kann älter sein als die von FORGE.

## MCP-Rückfragen (Elicitation)
Ohne `onElicitation` lehnt die CLI Rückfragen von MCP-Servern automatisch ab. FORGE führt sie als Freigabe mit `toolName = ELICITATION_TOOL` (`packages/protocol/src/elicitation.ts`, `ApprovalGate.elicit`). Dadurch funktionieren Status, Benachrichtigung, Telefon (`respond`) und Tagesbericht ohne zweiten Weg.
- Antworten stehen absichtlich nicht im Session-Verlauf (`updatedInput.content`, nicht `answers`).
- Adressen nur http/https (`elicitationUrl`). Die Anmeldung im Browser geht am Telefon nur abzulehnen.
- Geprüft mit einem eigenen stdio-MCP-Server, der `elicitation/create` sendet: Das Ergebnis kommt beim Server an.

## Weitere Punkte dieser Runde
Einstellungen `subagentEffort` (Umgebung `CLAUDE_CODE_SUBAGENT_EFFORT`) und `idleCompaction`, Tag `project-files-only`, Verbrauchs-Tipps (`PlanUsage.advice` aus `behaviors.*.recommendations`), `reloadPlugins({ holdOnCacheImpact: true })` nach Plugin-Änderungen, Kontext je MCP-Server (`mcpShares`), übersprungene Fragen (`ask_user_question_unanswered_v1`), Karten für ReportFindings, Cron und Wecker, Nachrichtenverlauf im Composer (Pfeil hoch).

## Bewusst nicht eingebaut
- `wakeup_source`: steht im Node-SDK nicht im Stream.
- Cache-Aufteilung 5 Minuten / 1 Stunde: erfordert neue Zähler, ohne dass eine Entscheidung davon abhängt.
- `permission_policy` je MCP-Werkzeug: FORGE fragt über `autoAllow` ohnehin nach.
- Gateway, Mods, Self-hosted Runner, OpenTelemetry: für FORGE ohne Nutzen.

## Stolperfalle
Auf dem Mac liefert Apple Git 2.39 kein `git merge-tree --merge-base`. Darum schlagen dort `agent-finish.test.ts` und ein Test in `agent-auto-merge.test.ts` fehl, unabhängig von dieser Arbeit.
