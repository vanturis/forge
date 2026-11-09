---
title: "Schneller Chat (tmp-Ordner, projects.tmpChat, TmpChatCleanup 30 Tage) und Chat-Ansicht \"Datei\" (LatestFileView)"
summary: "Wie temporäre Chats ohne Projekt samt Löschen nach 30 Tagen und die Chat-Ansicht mit der zuletzt bearbeiteten Datei aufgebaut sind; wichtig bei Änderungen an Projektlisten, Sync, Löschen oder Chat-Ansichten."
tags: ["sessions","projekte","ui","sync","telefon","chat"]
updated: "2026-11-09T08:53:37.429Z"
---

## Schneller Chat
Ein Chat ohne eigenes Projekt ist eine normale Session in einem versteckten Projekt `<defaultProjectDir>/tmp`, ohne Git und ohne Agenten. So gelten Chat, Rechtsklick, Suche und Telefon ohne Sonderwege.

- Sidecar: `ProjectManager.tmpChat()` legt Ordner und Projekt beim ersten Aufruf an, RPC `projects.tmpChat`, Telefon-Werkzeug `quick_chat`. Ohne `defaultProjectDir` kommt VALIDATION mit `projectsDirFirst`.
- Markierung über den Tag `TMP_CHAT_TAG` (`tmp-chat`, in `@forge/protocol`), bewusst keine DB-Spalte.
- Liegt in dem Ordner schon ein eigenes Projekt des Nutzers, wird es benutzt und nicht umgetaggt.
- Versteckt durch `splitProjects` (Sidebar-Zähler, Projekte-Seite, Bericht, Gruppen). `projects.list` enthält das Projekt weiter, sonst fehlt es bei `groupOf` und in der Palette. Der Sync überspringt es, weil der Pfad rechnerspezifisch ist.
- Stolperfalle: `splitProjects` liest `p.tags`, Test-Fixtures brauchen also `tags: []`.

Einstieg: Blitz-Symbol neben "Geöffnet" in der Sidebar, Strg+Umschalt+N, Befehlspalette, macOS-Menü.

## Löschen nach 30 Tagen (Wunsch des Besitzers, 2026-11-09)
`projects/tmp-chat-cleanup.ts`, gestartet in `app.ts`: erster Lauf 60 s nach dem Start, dann alle 6 Stunden.
- Löscht Sessions (mit Transkript), deren `updatedAt` älter als 30 Tage ist und die keinen laufenden Prozess haben.
- Löscht Einträge der obersten Ebene im tmp-Ordner, wenn die neueste Änderung darin (mtime, ctime, birthtime, rekursiv) älter als 30 Tage ist. Punkt-Ordner (`.claude`, `.forge`) bleiben. Läuft eine Session im Projekt, wird der Ordner in diesem Lauf nicht angefasst.
- Nur Projekte mit Tag UND Ordnername `tmp`: Den Tag kann man in den Projekteinstellungen von Hand tippen, ohne die Namensprüfung würde das ein echtes Projekt leeren.

## Chat-Ansicht "Datei"
Vierte Ansicht neben Alles, Prompts, Antworten (`CHAT_VIEWS` in `chat-view.tsx`). Der Besitzer wollte ausdrücklich keinen eigenen Seitenbereich, sondern einen Filter, der nur die zuletzt bearbeitete Datei zeigt. Eine erste Fassung als geteilter Bereich neben dem Chat wurde deshalb wieder entfernt.
- `LatestFileView.tsx` ersetzt in `SessionThread` den Verlauf, der Composer bleibt. Der Verlauf bleibt per `hidden` im DOM, weil Scroll-Logik und Virtualizer an den Elementen hängen.
- `latest-file.ts`: Quelle sind `tool.use`/`tool.result` von Write, Edit, MultiEdit, NotebookEdit der Session. Datei-Änderungen über Bash erscheinen nicht, Dateien außerhalb des Projekts auch nicht (`projects.readFile` kann sie nicht lesen).
- Teil-Eingaben eines Werkzeugs gibt es nicht im Ereignisstrom: Die Datei wird nach jedem abgeschlossenen Bearbeitungsschritt neu gelesen (`version` im Query-Key), nicht Zeichen für Zeichen.

## Vorschau im Browser
Die ganze App mit Fake-Sidecar braucht sehr viele RPC-Antworten (Chat, Dialoge). Schneller: temporäre Seite unter `apps/desktop/.preview-*/`, die nur die geänderten Komponenten mit `QueryClientProvider` und `TooltipProvider` einbindet und `rpc.start({ manageSidecar: false })` aufruft. Zusätzlich braucht es `window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener() {} }`. Der erste Aufruf nach dem Start von Vite kann leer bleiben, ein zweiter klappt. Das Verzeichnis ist nicht in .gitignore, also vor dem Commit löschen.
