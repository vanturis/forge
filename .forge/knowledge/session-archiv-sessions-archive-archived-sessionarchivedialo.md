---
title: "Session-Archiv (sessions.archive, archived, SessionArchiveDialog, archiveTranscript)"
summary: "Wie das Archiv für Sessions aufgebaut ist (ausblenden ohne löschen), welche Listen archivierte weglassen, was beim Archivieren passiert und welche Stolperfallen es gibt; nötig vor Änderungen an Session-Listen, send/resume oder neuen Stellen, die Sessions aufzählen."
tags: ["sessions","sidecar","ui","telefon","sdk","stolperfalle"]
updated: "2026-11-15T10:08:24.391Z"
---

# Session-Archiv (seit 2026-11-15)

Eine Session lässt sich archivieren (ausblenden, ohne sie zu löschen) und zurückholen. Anlass: Agent SDK 0.3.325 mit `archiveSession` / `unarchiveSession` und `archived` in `listSessions()`.

## Aufbau
- Protokoll: `Session.archived` (Pflicht), `ExternalSession.archived` und `SearchHit.archived` (optional, nur gesetzt wenn true). RPC `sessions.archive { sessionId, archived }` → Session. Der Auftrag nannte `{ id, archived }`; genommen wurde `sessionRef` wie bei allen anderen Session-Methoden.
- `sessions.list` liefert `{ sessions, external, archived }`: `sessions` ohne Archiv, `archived` ist das Archiv des Projekts. So hat die Session-Auswahl die Anzahl ohne zweite Abfrage.
- `sessions.listAll` nimmt `archived: "only" | "all"`; ohne Angabe fehlen archivierte. Dadurch lassen alle bisherigen Aufrufer (Startseite, Sessions-Ansicht, Palette, Telefon-Übersicht, offene Freigaben im Tagesbericht) das Archiv von selbst weg.
- DB: Spalte `sessions.archived` (Migration am Ende der Liste), `Db.updateSession({ archived })`, `listAllSessions(query, status, "no" | "only" | "all")`, `latestSession` ohne Archiv (sonst zeigt die Projektkarte eine archivierte als letzte Session). `Db.listSessions(projectId)` liefert bewusst weiter alle: Agenten-Zusammenführung, Tagesbericht und `projectBusy` brauchen auch archivierte.
- `SessionService.archive(id, archived)`: lehnt arbeitende Sessions ab (`SESSION_BUSY`: Status starting/running/waiting_approval/stopping, laufender Turn, offene Freigabe, Hintergrundaufgaben, Subagenten, Tests/Commit nach dem Turn, Start in Arbeit), streicht eine geplante Fortsetzung nach Limit, beendet einen untätigen Prozess mit `lifecycle.close` (wie IdleClose), setzt das Feld, sendet `session.updated` und ruft danach `runtime.archiveTranscript` auf. Ein Fehler des SDK wird geschluckt.
- `runtime.ts`: `archiveTranscript(claudeSessionId, archived, dir)` kapselt beide SDK-Aufrufe; `listSessions` reicht `archived` durch. `SessionService.list` blendet im Terminal archivierte fremde Sessions aus.
- Desktop: `components/workspace/session-archive.tsx` (`archiveSession`, `unarchiveSession`, `canArchive`, `archiveMenuItems` für Menüs), `SessionArchive.tsx` (`SessionArchiveDialogHost`, in `App.tsx` eingehängt; `ArchivedBar`), Store `stores/session-archive.ts` (`open(projectId | null)`, null = alle Projekte), Query `useArchivedSessions` unter dem Schlüssel `allSessions`, den jedes `session.updated` als veraltet markiert.
- Einstiege: Eintrag „Archiv“ mit Anzahl in der Session-Auswahl (`SessionBar`), Knopf und Rechtsklick in der Session-Leiste, Rechtsklick in der Seitenleiste (`OpenSessions`) und in der Sessions-Ansicht, dort auch der Filter „Archiv“; Palette: `session-archive`, `session-unarchive`, `archive-open`, archivierte Sessions als Einträge mit Hinweis „Archiviert“; macOS-Menü unter Session.
- Telefon: Werkzeug `sessions` mit `archive`, `unarchive`, `archive_list`, mit PIN, ohne Tastatur-Code (umkehrbar). `unarchive` sucht Titel im Archiv selbst, weil `resolve()` nur nicht archivierte kennt; Kürzel wie S3 gehen über `sessions.get`.

## Entscheidungen
- Eine archivierte Session ist im Chat nur lesbar: `Composer` zeigt statt der Eingabe die `ArchivedBar`. Umgesetzt als Hülle in `Composer.tsx`, damit `ChatPanel.tsx` unberührt bleibt.
- Nachricht an eine archivierte Session holt sie zurück: `send` und `resume` rufen vorher `archive(id, false)`. Wege an `send` vorbei (Claude-App, zurückkehrender Agent, bearbeitete Nachricht) fängt `core.onRecord` bei `user.message` ab; dort ohne SDK-Aufruf, Claude Code löscht seine Markierung mit dem Prompt selbst.
- „Alle Sessions löschen“ (`deleteAll`, auch am Telefon) lässt das Archiv stehen. Archivierte gehen nur einzeln. Der Dialog sagt das.
- Verzweigung und Fortsetzung (`fork`, `handoff`) einer archivierten Session starten außerhalb des Archivs.
- Der Tagesbericht zählt die Arbeit archivierter Sessions weiter mit; nur die Liste offener Freigaben lässt sie weg.
- Archivieren ändert `updated_at` (läuft über `updateSession`): Das Archiv ist nach Archivierungszeit sortiert, eine zurückgeholte Session steht oben.

## Stolperfallen
- `send` darf vor `turns.send` nicht bedingungslos warten. Ein `await` davor ließ den Test „does not close under a message that is being sent“ scheitern: Die Nachricht gilt erst mit `turns.send` als unterwegs, IdleClose schloss den Prozess dazwischen. Deshalb `await` nur, wenn die Session archiviert ist.
- `Db.insertSession` nimmt `archived` optional. So bleiben die vielen Test-Fixtures ohne das Feld gültig; `SessionRecord` selbst verlangt es.
- `patchSessionLists` (`lib/server-events.ts`) verschiebt eine Session zwischen `sessions` und `archived` der Projektliste. Wer das Ergebnis von `sessions.list` erweitert, muss dort mitziehen, sonst bleibt die Liste bis zum nächsten Laden falsch.
- Test-Fixtures mit laufenden Hintergrundaufgaben bekommen keine Aktion `session-archive` (`canArchive`). Der Menü-Test in `palette-actions.test.tsx` sammelt deshalb zusätzlich eine Variante ohne Hintergrundaufgaben.
- Vorschau ohne Tauri: Eine temporäre Seite unter `apps/desktop/.preview-*` mit eigenem `window.__TAURI_INTERNALS__` braucht beim ersten Laden gut 20 Sekunden (Vite bündelt Abhängigkeiten). Erst danach zeigt `preview_screenshot` etwas; `preview_interact` mit `wait` auf einen Text ist zuverlässiger.

## Offen
- FORGE übernimmt die Archiv-Markierung nicht, wenn eine von FORGE gestartete Session im Terminal archiviert wird.
- Archivierte temporäre Chats löscht die 30-Tage-Bereinigung weiterhin.
- Das Archiv eines Projekts zeigt nur dessen eigene Sessions, nicht die seiner Agenten-Worktrees; die stehen im Archiv aller Projekte.
