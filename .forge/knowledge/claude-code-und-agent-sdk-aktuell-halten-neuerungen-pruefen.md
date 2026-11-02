---
title: "Claude Code und Agent SDK aktuell halten: Neuerungen prüfen und einbauen (Dependabot, Changelog, MCP-Rückfragen, Probe)"
summary: "Wie FORGE Claude-Code-Neuerungen nachzieht, was zuletzt geprüft wurde, was bewusst fehlt, wie MCP-Rückfragen (Elicitation) laufen und wie man neue Optionen mit der echten CLI prüft."
tags: ["sdk","update","sidecar","konvention","telefon"]
updated: "2026-11-02T14:40:06.101Z"
---

Wunsch des Besitzers (2026-11-02): FORGE soll immer auf dem neuesten Stand von Claude Code sein und gute Funktionen vereinfacht zeigen.

## Stand
Geprüft bis Claude Code 2.1.316 und Agent SDK 0.3.316. „Claude Code 2.0“ ist im offiziellen Changelog die Version von September 2025; FORGE arbeitet längst auf 2.1.x. Aus 2.0 sind `/rewind`, `/usage`, dynamische Subagenten und die Verlaufssuche (Composer: Pfeil hoch, Strg+R) abgedeckt; das Denken stellt FORGE über die Aufwand-Auswahl ein.

## Ablauf bei neuen Versionen
- `.github/dependabot.yml` öffnet wöchentlich einen PR gegen `dev`, nur für `@anthropic-ai/claude-agent-sdk`. Die Konfiguration greift erst, wenn sie auf `main` liegt. Nach dem Update `pnpm notices` nicht vergessen.
- FORGE startet die CLI selbst (`pathToClaudeCodeExecutable`), CLI-Fehlerbehebungen kommen also unabhängig vom SDK. Neue Optionen und Typen brauchen das SDK.
- Changelogs: `raw.githubusercontent.com/anthropics/claude-code/refs/heads/main/CHANGELOG.md` und `.../claude-agent-sdk-typescript/main/CHANGELOG.md`. Die CLI-Datei ist über 1 MB groß, darum mit curl holen und abschnittsweise lesen. Zum Vergleich hilft ein diff der `sdk.d.ts` zwischen installierter und neuer Version.
- Neue Optionen zuerst mit der echten CLI prüfen: kleines Skript im Temp-Ordner mit `query()` aus dem SDK des Sidecars, `model: "haiku"`, `settingSources: []`, `persistSession: false`, `pathToClaudeCodeExecutable: ~/.local/bin/claude`. Die CLI unter `/opt/homebrew/bin` kann älter sein als die von FORGE. Das CLI-Binary ist über 300 MB groß: `grep -a` mit langen Mustern hängt, kurze Muster und `LC_ALL=C` nutzen.

## MCP-Rückfragen (Elicitation)
Ohne `onElicitation` lehnt die CLI Rückfragen von MCP-Servern automatisch ab. FORGE führt sie als Freigabe mit `toolName = ELICITATION_TOOL` (`packages/protocol/src/elicitation.ts`, `ApprovalGate.elicit`). Dadurch funktionieren Status, Benachrichtigung, Telefon (`respond`) und Tagesbericht ohne zweiten Weg.
- Antworten stehen absichtlich nicht im Session-Verlauf (`updatedInput.content`, nicht `answers`).
- Adressen nur http/https (`elicitationUrl`). Die Anmeldung im Browser lässt sich am Telefon nur ablehnen.
- Geprüft mit einem eigenen stdio-MCP-Server, der `elicitation/create` sendet: Das Ergebnis kommt beim Server an.

## Weitere Punkte dieser Runde
Einstellungen `subagentEffort` (Umgebung `CLAUDE_CODE_SUBAGENT_EFFORT`) und `idleCompaction`, Tag `project-files-only`, Verbrauchs-Tipps (`PlanUsage.advice` aus `behaviors.*.recommendations`), Kontext je MCP-Server (`mcpShares`), übersprungene Fragen (`ask_user_question_unanswered_v1`), Karten für ReportFindings, Cron und Wecker. MCP-Login, Plugin-Einstellungen und Erkennen ohne Neustart stehen im Eintrag zur MCP-Verwaltung.

## Bewusst nicht eingebaut
- `wakeup_source`: steht im Node-SDK nicht im Stream.
- Cache-Aufteilung 5 Minuten / 1 Stunde: erfordert neue Zähler, ohne dass eine Entscheidung davon abhängt.
- `permission_policy` je MCP-Werkzeug: FORGE fragt über `autoAllow` ohnehin nach.
- Gateway, Mods, Self-hosted Runner, OpenTelemetry: für FORGE ohne Nutzen.

## Stolperfalle: Git-Version auf dem Mac
macOS bringt Apple Git 2.39 mit. `git merge-tree --merge-base` gibt es erst ab Git 2.40, `merge-tree --write-tree` ab 2.38. Neue Git-Aufrufe in FORGE dürfen nichts über 2.38 voraussetzen; auf dem Mac nutzt FORGE kein mitgeliefertes Git. In `agent-finish.ts` war `--merge-base=HEAD` überflüssig, weil Agenten-Stand und Stash beide von HEAD abstammen.
