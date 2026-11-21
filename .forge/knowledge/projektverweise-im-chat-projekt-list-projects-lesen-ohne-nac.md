---
title: "Projektverweise im Chat: @Projekt, list_projects, Lesen ohne Nachfrage (mentions.ts, project-refs.ts, mentionNote)"
summary: "Wie eine Session auf andere FORGE-Projekte verweist: @Name im Composer, Hinweis an Claude mit dem Ordner, Werkzeug list_projects für normale Sprache, Lesefreigabe für erwähnte Projekte. Vor Änderungen an Composer-Menüs, Freigaben oder FORGE-Werkzeugen lesen."
tags: ["chat","composer","forge-tools","sidecar","projekte","telefon"]
updated: "2026-11-21T01:24:27.424Z"
---

# Projektverweise im Chat

Eingebaut 2026-11-21 auf Wunsch des Besitzers ("Übernehme das Design aus dem Projekt cento").

## Zwei Wege

1. **`@Name` in der Nachricht** (getippt, aus dem Menü im Composer, per Rechtsklick auf ein Projekt in der Seitenleiste "Im Chat erwähnen", oder über die Suche "Auf anderes Projekt verweisen"). Der Sidecar hängt vor die Nachricht einen FORGE-Hinweis mit Ordner, Technik und Wissensordner des Projekts (`mentionNote`). Die Timeline zeigt weiter nur den Text des Nutzers.
2. **Normale Sprache** ("wie im Projekt cento"): Claude hat das Werkzeug `list_projects` (ohne `name` die Liste, mit `name` Ordner und Index des Projektwissens) und eine Zeile im Startkontext (`projectsLine`).

## Code

- `packages/protocol/src/mentions.ts`: `findProjectMentions` (längster Name gewinnt, Namen dürfen Leerzeichen haben, `info@cento.de`, `@types/node`, `@cento-v2` sind keine Verweise), `mentionable` (nur Hauptprojekte mit Ordner, ohne das eigene und ohne temporäre Chats), `mentionQueryAt`, `matchMentionTargets`. Von Sidecar und Oberfläche gemeinsam genutzt, damit beide dasselbe erkennen.
- `packages/sidecar/src/sessions/project-refs.ts`: `mentionNote`, `mentionedDirs`, `listProjectsTool`. Angebunden in `TurnDispatch.build` (Host-Funktion `mentions`) und `forgeSessionTools` (in `common`, also auch für Agenten und Projekte ohne Git).
- Oberfläche: `components/workspace/project-mentions.tsx` (`ProjectMentionMenu`, `MentionedText`, `withMentions`), `lib/project-mention.ts` (`insertMentionSoon`, Ereignis `MENTION_INSERT_EVENT` an das Composer-Feld, gleiches Muster wie das Diktat).

## Entscheidungen

- **Lesen ohne Nachfrage nur nach `@`**: `ApprovalGate.request` lässt Read, Glob, Grep in Ordnern durch, die der Nutzer in dieser Session mit `@` erwähnt hat (`readsInside` in `policy/guard.ts`, Audit-Quelle `mention`). Schlägt Claude ein Projekt nur über `list_projects` nach, fragt FORGE in Safe und Balanced wie bisher pro Datei: Sonst könnte sich Claude die Freigabe selbst geben. Im Autonomous-Profil gibt es ohnehin keine Nachfragen.
- Die erwähnten Ordner werden bei jeder Nachfrage aus den gespeicherten Nutzer-Nachrichten gelesen (`listRecentUserMessages`, letzte 300), kein Zustand im Prozess. So gilt die Freigabe auch nach einem Neustart. Automatische Nachrichten, Antworten von Agenten und Nachrichten an Hintergrundaufgaben zählen nicht.
- Schreiben in anderen Projekten bleibt, wie es war: Nachfrage, im Autonomous-Profil durch `write-outside-project` gesperrt.
- Tag `project-files-only`: kein `list_projects`, der Hinweis sagt Claude, dass es dort nicht lesen kann.
- Menü: Ist das Getippte schon genau ein Projektname, bleibt das Menü zu, damit Enter sendet statt noch einmal auszuwählen. Esc blendet aus, bis sich der Text ändert (gemeinsamer Zustand `dismissedFor` mit den Vorlagen).
- Hervorhebung im Eingabefeld läuft über die Kopie hinter dem Feld (wie ultrathink): nur Farbe und Hintergrund, kein Padding, sonst verrutscht der Text.
- Telefon: kein eigenes Werkzeug. Die Beschreibungen von `send_message` und `start_session` sagen dem Assistenten, Verweise als `@Projektname` zu schreiben.

## Stolperfallen

- Neues FORGE-Werkzeug: Tests in `session-service.test.ts` zählen die Werkzeuge einer Session fest auf, und `forge-tool.ts` braucht einen eigenen `case` (Karte liest die Ergebnistexte in beiden Sprachen: "Kein Projekt"/"No project").
- Composer-Tests mit Sammel-Attrappe (`{ models: [] }` für alles) müssen `projects.list` als Liste beantworten, der Composer liest die Projektliste jetzt immer.
- Ansehen ohne Tauri: temporäre Seite, die `window.__TAURI_INTERNALS__` setzt und `sidecar_send` direkt über `rpc.onLine` beantwortet (keine Brücke nötig), Vite auf eigenem Port. Der erste Aufruf lädt wegen des Kaltstarts leer, der zweite zeigt die Seite.
