---
title: "Claude Code und Agent SDK aktuell halten: Neuerungen prüfen und einbauen (Dependabot, Changelog, MCP-Rückfragen, Probe)"
summary: "Wie FORGE Claude-Code-Neuerungen nachzieht, was zuletzt geprüft und eingebaut wurde (Stand 2.1.326), was bewusst fehlt oder nicht geht, offene Ideen, wie MCP-Rückfragen laufen und wie man neue Optionen mit der echten CLI prüft."
tags: ["sdk","update","sidecar","konvention","telefon"]
updated: "2026-11-17T12:02:23.695Z"
---

Wunsch des Besitzers (2026-11-02, bekräftigt 2026-11-15): FORGE soll immer auf dem neuesten Stand von Claude Code sein und gute Funktionen vereinfacht zeigen.

## Stand
Geprüft bis Claude Code 2.1.326 und Agent SDK 0.3.326 (2026-11-17). Eingebunden ist SDK 0.3.325; 0.3.326 bringt für FORGE nichts Neues (fast nur Fehlerbehebungen). Aus Claude Code 2.0 (September 2025) sind `/rewind`, `/usage`, dynamische Subagenten und die Verlaufssuche abgedeckt; das Denken stellt FORGE über die Aufwand-Auswahl ein.

## Ablauf bei neuen Versionen
- `.github/dependabot.yml` öffnet wöchentlich einen PR gegen `dev`, nur für `@anthropic-ai/claude-agent-sdk`. Nach dem Update `pnpm notices` nicht vergessen.
- FORGE startet die CLI selbst (`pathToClaudeCodeExecutable`), CLI-Fehlerbehebungen und neue Modelle kommen also ohne SDK-Update. Neue Optionen und Typen brauchen das SDK.
- Changelogs: `raw.githubusercontent.com/anthropics/claude-code/refs/heads/main/CHANGELOG.md` und `.../claude-agent-sdk-typescript/main/CHANGELOG.md`. Die CLI-Datei ist über 1 MB groß: mit curl holen, `grep -n '^## '` für die Versionszeilen, dann abschnittsweise lesen. Die Typen ändern sich pro Version wenig: ein Vergleich der exportierten Namen der `sdk.d.ts` (alt gegen das Tarball der neuen Version von registry.npmjs.org) zeigt Neues sofort. Viele Meldungstypen gibt es im SDK schon länger, ohne dass FORGE sie auswertet: also auch `grep` der Typnamen und der `subtype`-Namen gegen `normalize.ts` und `sessions/stream.ts`.
- Neue Optionen zuerst mit der echten CLI prüfen: kleines Skript im Temp-Ordner mit `query()` aus dem SDK des Sidecars (`packages/sidecar/node_modules/@anthropic-ai/claude-agent-sdk/sdk.mjs`, per `pathToFileURL` importieren), `model: "haiku"`, `settingSources: []`, `persistSession: false`, `pathToClaudeCodeExecutable` (Windows: `~/.local/bin/claude`). Für mehrere Durchläufe einen async-Generator als `prompt` nehmen und nach jedem `result` die nächste Nachricht liefern (oder den Generator offen halten, um Durchläufe nach Hintergrund-Aufgaben zu sehen). Die CLI unter `/opt/homebrew/bin` kann älter sein als die von FORGE.
- API-Fehler provozieren: lokaler HTTP-Server, der jede Anfrage mit 529 und `{"type":"error","error":{"type":"overloaded_error"}}` beantwortet, und `ANTHROPIC_BASE_URL=http://127.0.0.1:<port>` im `env` der Probe. Die CLI meldet dann `api_retry` mit wachsender Wartezeit (0,5 s, 1 s, 2 s, 4 s, 9 s, 19 s …, `max_retries` 10).
- Danach gezielt `pnpm vitest run -c vitest.e2e.config.ts -t "..."` in `packages/sidecar` (echte CLI, Haiku). Die Tests bauen aufeinander auf: „imports the project“ und „shows the real git status“ mitnehmen. Der Test „diagnostics“ erwartet ein `five_hour`-Fenster und schlägt mit einem Ultra-Konto fehl; das ist kein Fehler der Änderung.

## Eingebaut am 2026-11-17: Live-Status des Durchlaufs
Alles flüchtig an `LiveSession`, ausgeliefert über `Session` (`core.toSession`), nichts davon steht im Verlauf. Auswertung in `sessions/stream.ts`.
- `system/api_retry` → `Session.retry` (`ApiRetry`: attempt, maxRetries, retryAt, errorStatus, error). `attempt` zählt den kommenden Versuch (1 nach dem ersten Fehler). Gelöscht bei der nächsten `assistant`-Meldung oder `message_start` und beim `result`. Anzeige: eigene Zeile im `WorkingIndicator` (`retryText` in `working.ts`), Telefon in `details`.
- `system/thinking_tokens` → `Session.thinkingTokens`: laufende Schätzung des aktuellen Denkblocks, kommt auch mit Haiku, etwa zwei- bis viermal pro Sekunde. Wird höchstens einmal pro Sekunde veröffentlicht, nur während eines Durchlaufs angenommen, gelöscht bei `content_block_stop`, `message_start`, `message_stop` des Hauptthreads und beim `result`. Die Meldung trägt keine `parent_tool_use_id`.
- `system/session_state_changed` (nur mit `CLAUDE_CODE_EMIT_SESSION_STATE_EVENTS=1`, das FORGE jetzt immer setzt). Gemessen: `running` kommt, sobald ein Prompt ankommt (nicht beim Prozessstart), `idle` direkt nach dem `result`. Läuft ein Befehl im Hintergrund weiter, kommt trotzdem `idle`, und der Durchlauf nach seinem Ende beginnt mit `running`, gut eine Sekunde vor der ersten Ausgabe. Läuft ein Subagent im Hintergrund, bleibt die CLI nach dem `result` auf `running` und meldet für den Folge-Durchlauf nichts. Darum taugt die Meldung nicht als Ersatz für die Fertig-Erkennung (`JobWatcher`) und die Erkennung über die erste Ausgabe in `handle()` bleibt. FORGE nutzt nur: `running` bei Status idle → `turns.markRunning` (`live.cliTurn`), und `idle` ohne `result` dazwischen setzt die Session zurück auf idle.
- Nebenbei gesehen: `system/status` mit `status: "requesting"` kommt vor jeder API-Anfrage des Hauptthreads. Nicht dokumentiert, FORGE wertet es nicht aus.

## Eingebaut in der Runde 2.1.317 bis 2.1.325
- `supersedes` und `retracted_message_uuids`: Der Normalizer merkt sich je SDK-`uuid`, welche Texte (`<messageId>:<index>`) und Werkzeugaufrufe eine Meldung gezeigt hat, und meldet `messages.superseded`. Achtung: Mehrere SDK-Meldungen teilen sich eine API-`message.id` (eine je Inhaltsblock), darum der Weg über die uuid. `chat-items.ts` blendet die Einträge in jedem Thread aus, `lastAnswer` am Telefon überspringt sie.
- Vorschlag für die nächste Nachricht: Option `promptSuggestions`, Meldung `prompt_suggestion` kommt nach dem `result` (nicht nach dem ersten Durchlauf). Liegt flüchtig an `LiveSession.suggestion` / `Session.suggestion`, wird in `SessionCore.setStatus("running")` gelöscht. Composer zeigt ihn als Platzhalter, Tab oder Klick übernimmt. Einstellung `promptSuggestions` (Standard an).
- Ablauf der Anmeldung: `credential_expires_at` steht an jedem `result`. Gespeichert unter dem Schlüssel `loginExpiry` in der Tabelle `settings` (kein Setting), ausgeliefert als `PlanUsage.loginExpiresAt`. `loginDaysLeft` (protocol) warnt ab 10 Tagen: Seitenleiste, Nutzungsansichten, einmal je Start als Toast, `usage_status`, Telefon `usage`.
- Neue Ereignisse: `cli.notice` (`system/informational`, Stufen notice, suggestion, warning; `info` und Fortschrittszeilen zu einem Werkzeug fallen weg), `model.refusal` (`model_refusal_fallback` nur bei `direction: "retry"`, und `model_refusal_no_fallback`), `writes.lost` (`session_writes_lost`), `memory.recall`, `goal` (`active_goal`).
- `onFailure: "block"` am PreToolUse-Guard. Das SDK lehnt eine CLI vor 2.1.317 beim Start ab („does not honor onFailure“); `describeRuntimeError` meldet das als „Claude Code zu alt“.
- `reloadPlugins` im Hintergrund mit `refuseIfBusy`: Antwort „busy“ setzt `live.reloadPending`, nach dem Turn-Ende lädt der Stream nach.
- Projekt-Tag `no-prompts` (Automatik „Ohne Rückfragen“): setzt `settings.permissions.denyInsteadOfPrompting`. Geprüft: `canUseTool` wird dann nicht gefragt, AskUserQuestion und ExitPlanMode werden dem Modell gar nicht angeboten, die CLI meldet `system/permission_denied`. Darum nicht in Sessions im Planmodus (lifecycle.ts).
- Einstellung `autoBackgroundTasks` (Standard aus): setzt `CLAUDE_AUTO_BACKGROUND_TASKS=1`. Das schiebt Subagenten nach etwa zwei Minuten in den Hintergrund und ist zugleich die Voraussetzung für MCP-Tasks im Hintergrund in SDK-Sessions (`task_type: "mcp_task"`). Wegen der geänderten Turn-Abfolge nicht ungefragt eingeschaltet.
- Archiv für Sessions (`archiveSession`, `unarchiveSession`): eigener Eintrag.

## Offene Ideen (dem Besitzer am 2026-11-17 vorgeschlagen, noch nicht gebaut)
Im SDK vorhanden, im Sidecar ungenutzt, keine davon mit der CLI erprobt:
- `listSubagents` / `getSubagentMessages`: Subagenten-Verlauf nach einem Neustart aus dem Transkript laden. FORGE zeigt den Verlauf bisher aus den eigenen Timeline-Ereignissen.
- `prewarm()` / `SpareProcess.claim()` (Alpha): vorgewärmter Prozess für schnellere erste Antwort.
- Eigene Karte für das Workflow-Werkzeug und für `ProposeSkills` (Skill-Vorschläge).
- `fastMode` (Flag-Einstellung, `fast_mode_state`): Abrechnung im Abo ungeklärt.
- `side_question` (im Terminal `/btw`): Steueranfrage steht in den Typen, eine öffentliche Methode an `Query` war nicht zu finden.
- `taskBudget` (Alpha): Token-Budget je Aufgabe.

## Geht nicht oder bewusst nicht eingebaut
- Code Mode (`CLAUDE_CODE_EXPERIMENTAL_CODE_MODE`): läuft laut Doku nur im interaktiven Terminal, nicht mit `-p`, dem Agent SDK oder Desktop-Apps. In FORGE nicht möglich, bis Anthropic das ändert.
- `tool_use_summary`: kam in den Proben nicht an; FORGE zeigt jede Werkzeugkarte einzeln.
- `tool_progress` mit `tool_use_id` „hook-…“ (Herzschlag bei langen Hooks): FORGE wertet `tool_progress` nicht aus, darum unkritisch.
- `wakeup_source`: steht im Node-SDK nicht im Stream.
- Cache-Aufteilung 5 Minuten / 1 Stunde: erfordert neue Zähler, ohne dass eine Entscheidung davon abhängt.
- `permission_policy` je MCP-Werkzeug: FORGE fragt über `autoAllow` ohnehin nach.
- `matchDeniedModels`, `machinePolicy`, Gateway, Mods, Self-hosted Runner, OpenTelemetry, Sandbox-Option, `mcpServersDelivery`: für FORGE ohne Nutzen.
- Offen zu beobachten: Seit 2.1.325 fragen nur lesende Git-Befehle in einem Repository außerhalb des Arbeitsordners nach. Ob das die Hauptsession beim Blick in Agenten-Worktrees trifft, ist nicht getestet.

## MCP-Rückfragen (Elicitation)
Ohne `onElicitation` lehnt die CLI Rückfragen von MCP-Servern automatisch ab. FORGE führt sie als Freigabe mit `toolName = ELICITATION_TOOL` (`packages/protocol/src/elicitation.ts`, `ApprovalGate.elicit`). Dadurch funktionieren Status, Benachrichtigung, Telefon (`respond`) und Tagesbericht ohne zweiten Weg.
- Antworten stehen absichtlich nicht im Session-Verlauf (`updatedInput.content`, nicht `answers`).
- Adressen nur http/https (`elicitationUrl`). Die Anmeldung im Browser lässt sich am Telefon nur ablehnen.

## Frühere Runde (bis 2.1.316)
Einstellungen `subagentEffort` (`CLAUDE_CODE_SUBAGENT_EFFORT`) und `idleCompaction`, Tag `project-files-only`, Verbrauchs-Tipps (`PlanUsage.advice`), Kontext je MCP-Server (`mcpShares`), übersprungene Fragen (`ask_user_question_unanswered_v1`), Karten für ReportFindings, Cron und Wecker.

## Stolperfalle: Git-Version auf dem Mac
macOS bringt Apple Git 2.39 mit. `git merge-tree --merge-base` gibt es erst ab Git 2.40, `merge-tree --write-tree` ab 2.38. Neue Git-Aufrufe in FORGE dürfen nichts über 2.38 voraussetzen.

## Desktop-Komponenten ohne Tauri ansehen
Siehe Eintrag zum Git-Reiter. Es geht auch ohne Brücke: Die temporäre Seite setzt `window.__TAURI_INTERNALS__` (`invoke`, `transformCallback`) und beantwortet `sidecar_send` selbst mit festen Daten als `sidecar://messages`-Ereignis. Danach `rpc.start({ manageSidecar: false })` aufrufen, sonst kommt keine Antwort an. Der erste Aufruf dauert über 20 Sekunden (Vite bündelt Abhängigkeiten), die Seite ist so lange schwarz.
Für eine einzelne Komponente ohne Daten reicht weniger: eine temporäre `apps/desktop/tmp-x.html` mit eigenem Einstieg `src/tmp-x.tsx` (Komponente mit festen Props, `./styles.css`, `paintStoredDesign()`), `pnpm exec vite --port 1466 --strictPort` in `apps/desktop`, dann `preview_interact` mit `wait` auf einen Text. Danach Dateien löschen und den Vite-Prozess beenden.
