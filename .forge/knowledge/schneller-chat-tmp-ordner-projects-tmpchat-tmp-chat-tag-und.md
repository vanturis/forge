---
title: "Schneller Chat (tmp-Ordner, projects.tmpChat, TMP_CHAT_TAG) und Live-Dateien neben dem Chat (LiveFilesPane)"
summary: "Wie temporäre Chats ohne Projekt und der dritte Bereich mit den gerade bearbeiteten Dateien aufgebaut sind; wichtig bei Änderungen an Projektlisten, Sync oder dem Workspace-Layout."
tags: ["sessions","projekte","ui","sync","telefon"]
updated: "2026-11-09T08:22:16.962Z"
---

## Schneller Chat
Ein Chat ohne eigenes Projekt ist eine normale Session in einem versteckten Projekt `<defaultProjectDir>/tmp`, ohne Git und ohne Agenten. So gelten Chat, Rechtsklick, Suche und Telefon ohne Sonderwege.

- Sidecar: `ProjectManager.tmpChat()` legt Ordner und Projekt beim ersten Aufruf an, RPC `projects.tmpChat`, Telefon-Werkzeug `quick_chat`. Ohne `defaultProjectDir` kommt VALIDATION mit `projectsDirFirst`.
- Markierung über den Tag `TMP_CHAT_TAG` (`tmp-chat`, in `@forge/protocol`), bewusst keine DB-Spalte.
- Liegt in dem Ordner schon ein eigenes Projekt des Nutzers, wird es benutzt und nicht umgetaggt.
- Versteckt durch `splitProjects` (Sidebar-Zähler, Projekte-Seite, Bericht, Gruppen). `projects.list` enthält das Projekt weiter, sonst fehlt es bei `groupOf` und in der Palette. Der Sync überspringt es, weil der Pfad rechnerspezifisch ist.
- Stolperfalle: `splitProjects` liest `p.tags`, Test-Fixtures brauchen also `tags: []`.
- Es gibt kein automatisches Aufräumen: Der tmp-Ordner und die Sessions bleiben, bis jemand sie löscht.

Einstieg: Blitz-Symbol neben "Geöffnet" in der Sidebar, Strg+Umschalt+N, Befehlspalette, macOS-Menü.

## Live-Dateien
`components/workspace/LiveFilesPane.tsx`, reine Logik in `live-files.ts`. Dritter Bereich neben unterem Panel und rechter Seitenleiste; teilt nur die Chat-Fläche. `liveFilesOpen` wird wie die anderen Panels nicht gespeichert.

- Quelle sind die `tool.use`/`tool.result`-Ereignisse von Write, Edit, MultiEdit, NotebookEdit der offenen Session. Datei-Änderungen über Bash erscheinen nicht.
- Teil-Eingaben eines Werkzeugs gibt es nicht im Ereignisstrom: Die Datei wird nach jedem abgeschlossenen Bearbeitungsschritt neu gelesen (`version` im Query-Key), nicht Zeichen für Zeichen.
- Dateien außerhalb des Projektordners fehlen, `projects.readFile` kann sie nicht lesen.

## Vorschau im Browser
Die ganze App mit Fake-Sidecar braucht sehr viele RPC-Antworten (Chat, Dialoge). Schneller: temporäre Seite unter `apps/desktop/.preview-*/`, die nur die geänderten Komponenten mit `QueryClientProvider` und `TooltipProvider` einbindet und `rpc.start({ manageSidecar: false })` aufruft. Zusätzlich braucht es `window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener() {} }`. Das Verzeichnis ist nicht in .gitignore, also vor Ende des Durchlaufs löschen.
