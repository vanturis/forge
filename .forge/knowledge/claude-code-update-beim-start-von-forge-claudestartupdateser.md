---
title: "Claude-Code-Update beim Start von FORGE (ClaudeStartUpdateService, claudeUpdateOnStart, ClaudeStartUpdateGate)"
summary: "Wie FORGE beim Start ein Claude-Code-Update von selbst installiert, Session-Starts so lange zurückhält und das Fenster sperrt; lesen vor Änderungen an Start, Session-Start oder Claude-Update."
tags: ["update","sidecar","einstellungen","telefon","stolperfalle"]
updated: "2026-11-21T01:23:16.622Z"
---

# Claude-Code-Update beim Start von FORGE

Wunsch des Besitzers (2026-11-21): Kommt ein Claude-Code-Update, soll es sich beim Start von FORGE von selbst installieren, bevor man etwas machen kann. Nur beim Start; später bleibt der Knopf in der Seitenleiste (`ClaudeUpdateButton`). Grundlagen zu `claude update` und fremd verwalteten Installationen: Eintrag `claude-code-cli-eigene-vs-homebrew-npm-installation-claude-u`.

## Ablauf
- Sidecar: `packages/sidecar/src/claude/start-update.ts` (`ClaudeStartUpdateService`). `app.ts` ruft `run()` einmal im Block `if (process.env.FORGE_APP_VERSION)`, und nur wenn kein Auto-Install gestartet wurde (`!claudePath && !hasOwnClaude()` installiert weiter die eigene Kopie) und `settings.setupDone` gilt. Vor dem Einrichtungsassistenten greift es also nicht.
- Phasen (`ClaudeStartUpdate` in `packages/protocol/src/models.ts`): `idle`, `checking`, `updating`, `failed`, `done`, `skipped`, dazu `installed`, `latest`, `message`, `skippable`. RPC `claude.startUpdateState`, `claude.resolveStartUpdate { action: "retry" | "skip" }`, Ereignis `claude.startUpdate`.
- Prüfung: `claudeSetup.checkUpdate()` (CLI-Version und Release-Endpoint laufen seitdem gleichzeitig), insgesamt höchstens `CHECK_LIMIT_MS` (4 s). Ohne Netz, bei Fehler oder Zeitüberschreitung: `idle`, keine Sperre, keine Meldung. Eine späte Antwort startet nichts mehr.
- Update: `claudeSetup.update()`. Den Fortschritt bekommt der Dienst über `onSetup(payload)` aus dem Emit-Callback der `ClaudeSetupService` (Aufgabe `update` oder `install`, Phase `done`/`error`/`cancelled`). Das Log steht weiter in `ClaudeSetupState.log`.
- Nach `SKIP_OFFER_MS` (60 s) wird `skippable` gesetzt, nach `GIVE_UP_MS` (5 min) gibt der Dienst von selbst frei (`skipped`).

## Sperre für Sessions (Sidecar)
- `SessionService.useStartHold(() => claudeStartUpdate.wait())`; `SessionLifecycle` wartet in `start`, `resume` (nur wenn die Session nicht live ist) und `restartAt`. Damit warten auch Telefon, Crew, Auto-Continue und zurückkehrende Agenten.
- `wait()` liefert `null`, wenn nichts sperrt. Die Lifecycle-Methoden awaiten nur bei einem Promise, sonst ändert sich ihr Timing (Tests zu doppeltem Enter und sofortigem Start hängen daran).
- Gesperrt ist nur in `checking` und `updating`. In `failed` wird nichts ersetzt, also dürfen Sessions starten (sonst hinge ein Anruf oder eine fortgesetzte Session an einem Fenster, vor dem niemand sitzt). Die Sperre am Bildschirm bleibt in `failed` bis zur Antwort.
- Fortsetzen nach einem FORGE-Update: `sessions.resumeAfterUpdate(() => updates.holdsResume() || claudeStartUpdate.blocking())`. So bleiben die Marken in `update_resume` liegen, bis das Update durch ist, und überleben ein Schließen von FORGE währenddessen.
- „Ohne Update weiter“ (`skip`) beendet ein laufendes Update nicht: es läuft im Hintergrund zu Ende wie eines über den Knopf.
- Nicht gesperrt: kurze Einmal-Aufrufe der CLI (Probe, Plan-Nutzung, `runtime.complete` für Titel, Changelog usw.).

## Oberfläche
- `apps/desktop/src/components/layout/ClaudeStartUpdateGate.tsx`, in `App.tsx` um `Shell` gelegt (nur Hauptfenster; Chat-Fenster öffnet die Shell). Die Shell wird währenddessen nicht gemountet statt überdeckt: Tastenkürzel, Dialoge (Portale) und Abfragen der Ansichten kämen an einer Überdeckung vorbei.
- Während `checking` bleibt der Startbildschirm („FORGE startet …“) stehen, damit nichts aufblitzt. `updating`/`failed` zeigen die Karte mit beiden Versionen, letzter Log-Zeile, „Erneut versuchen“ und „Ohne Update weiter“.
- Die Sperre darf nie hängen: Fehler der Abfrage oder ein fehlschlagendes `skip` öffnen die App trotzdem (`released`).
- `server-events.ts` unterdrückt die Toasts zu `claude.setup`, solange das Start-Update in `updating` ist. Der Sidecar sendet erst `claude.setup`, dann `claude.startUpdate`; diese Reihenfolge in `app.ts` nicht drehen.

## Einstellung
`claudeUpdateOnStart` (Standard an): `Settings` im Protokoll, `DEFAULT_SETTINGS` in `db.ts` (keine Migration nötig), Schalter in `SettingsView` unter Claude Code bei „Installation und Anmeldung“, `SETTING_TOGGLES` in `palette-actions.tsx`, Telefon `forge_settings` (`claude_update_on_start`), wird synchronisiert. Telefon `forge_system`: `claude_check` nennt ein fehlgeschlagenes oder hängendes Start-Update, `claude_update` ist dann der neue Versuch, `claude_start_skip` macht ohne Update weiter.

## Stolperfallen
- Ein gepinnter `claudePath` auf eine Homebrew/npm-CLI schlägt bei jedem Start fehl („extern verwaltet“), bis der Pfad geleert oder die Einstellung abgeschaltet ist. Die Karte nennt die Einstellung.
- Tests: `test/claude-start-update.test.ts` (Fake-Timer), Sperre der Starts in `test/session-service.test.ts` („concurrency and lifecycle“), Telefon in `test/phone-call.test.ts` („manages extensions, global settings, updates and backups“ braucht `claude.startUpdateState` in `rpcResults`), UI `ClaudeStartUpdateGate.test.tsx`. In UI-Tests nach `qc.setQueryData` mit `findBy…` warten, das Neuzeichnen kommt nicht synchron.
- Den Sperrbildschirm ohne Tauri ansehen: eine Vite-Konfiguration unter `apps/desktop/node_modules/.cache/` mit einer `/preview.html`, die `__TAURI_INTERNALS__` setzt und `claude.startUpdateState`, `claude.setupState` und `claude.resolveStartUpdate` selbst beantwortet (Antwortzeile `{ id, ok: true, result }` über `sidecar://messages`, danach `sidecar.ready` senden). Mehr braucht die Sperre nicht, weil die Shell nicht gemountet ist.
