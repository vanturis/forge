---
title: "Temporärer Chat (tmp-Ordner, isTmpChat, Löschen nach 30 Tagen) und Chat-Ansicht \"Datei\" (LatestFileView)"
summary: "Wie temporäre Chats ohne Projekt aufgebaut, gekennzeichnet und nach 30 Tagen gelöscht werden, und wie die Chat-Ansicht mit der zuletzt bearbeiteten Datei funktioniert; wichtig bei Änderungen an Projektlisten, Kopfzeile, Sync, Löschen oder Chat-Ansichten."
tags: ["sessions","projekte","ui","sync","telefon","chat"]
updated: "2026-11-09T09:14:03.761Z"
---

## Temporärer Chat
Name in der UI: **„Temporärer Chat“** (EN „Temporary chat“). Bis 2026-11-09 hieß er „Schneller Chat“; der Besitzer wollte die Umbenennung. Ein temporärer Chat ist eine normale Session in einem versteckten Projekt `<defaultProjectDir>/tmp`, ohne Git und ohne Agenten. So gelten Chat, Rechtsklick, Suche und Telefon ohne Sonderwege.

- Sidecar: `ProjectManager.tmpChat()` legt Ordner und Projekt beim ersten Aufruf an, RPC `projects.tmpChat`, Telefon-Werkzeug `temp_chat`. Ohne `defaultProjectDir` kommt VALIDATION mit `projectsDirFirst`.
- Markierung über den Tag `TMP_CHAT_TAG` (`tmp-chat`), Prüfung immer mit `isTmpChat(p)` aus `@forge/protocol` (verträgt fehlendes `tags`, viele Test-Fixtures haben keins). Bewusst keine DB-Spalte.
- Projektname setzt FORGE: `nameTmpChats()` beim Start benennt das Projekt in der aktuellen Sprache um (alte Builds: „Schnelle Chats“).
- Liegt in dem Ordner schon ein eigenes Projekt des Nutzers, wird es benutzt und nicht umgetaggt.
- Versteckt durch `splitProjects` (Sidebar-Zähler, Projekte-Seite, Bericht, Gruppen). `projects.list` enthält das Projekt weiter, sonst fehlt es bei `groupOf` und in der Palette. Der Sync überspringt es, weil der Pfad rechnerspezifisch ist.

### Oberfläche (Wunsch des Besitzers: keine Projekteinstellungen, deutlich als temporär erkennbar)
- `workspaceTabsFor` liefert nur `["chat"]`. `WorkspaceView` blendet Reiterleiste, rechte Seitenleiste und unteres Panel aus.
- `WorkspaceHeader` hat einen eigenen Zweig: `TempChatIcon`, Name, Hinweis „Ohne Projekt, wird nach 30 Tagen gelöscht“, nur Split und Remote, kein Stern, keine Tags, kein Rechteprofil.
- Kennzeichnung rechts: `TempChatBadge` („Temporär“, Tooltip mit 30-Tage-Hinweis) in der `SessionBar` und in der unteren Leiste des `Composer`. Leerer neuer Chat zeigt eigenen Text. Sidebar-Baum zeigt `TempChatIcon` statt Projektbild.
- Palette: Für den temporären Chat fehlen Wissen, Terminal und Panels, Profile, Projekteinstellungen, Git, Gruppe und Tags (`addProjectSettings` wird übersprungen).
- Einstieg: Symbol `MessageSquareDashed` neben „Geöffnet“ in der Sidebar, Strg+Umschalt+N, Palette `temp-chat`, macOS-Menü.

## Löschen nach 30 Tagen (Wunsch des Besitzers, 2026-11-09)
`projects/tmp-chat-cleanup.ts`, gestartet in `app.ts`: erster Lauf 60 s nach dem Start, dann alle 6 Stunden.
- Löscht Sessions (mit Transkript), deren `updatedAt` älter als 30 Tage ist und die keinen laufenden Prozess haben.
- Löscht Einträge der obersten Ebene im tmp-Ordner, wenn die neueste Änderung darin (mtime, ctime, birthtime, rekursiv) älter als 30 Tage ist. Punkt-Ordner (`.claude`, `.forge`) bleiben. Läuft eine Session im Projekt, wird der Ordner in diesem Lauf nicht angefasst.
- Nur Projekte mit Tag UND Ordnername `tmp`: Den Tag kann man von Hand tippen, ohne die Namensprüfung würde das ein echtes Projekt leeren.

## Chat-Ansicht "Datei"
Vierte Ansicht neben Alles, Prompts, Antworten (`CHAT_VIEWS` in `chat-view.tsx`). Der Besitzer wollte ausdrücklich keinen eigenen Seitenbereich, sondern einen Filter, der nur die zuletzt bearbeitete Datei zeigt. Eine erste Fassung als geteilter Bereich neben dem Chat wurde deshalb wieder entfernt.
- `LatestFileView.tsx` ersetzt in `SessionThread` den Verlauf, der Composer bleibt. Der Verlauf bleibt per `hidden` im DOM, weil Scroll-Logik und Virtualizer an den Elementen hängen.
- `latest-file.ts`: Quelle sind `tool.use`/`tool.result` von Write, Edit, MultiEdit, NotebookEdit der Session. Datei-Änderungen über Bash erscheinen nicht, Dateien außerhalb des Projekts auch nicht.
- Die Datei wird nach jedem abgeschlossenen Bearbeitungsschritt neu gelesen (`version` im Query-Key), nicht Zeichen für Zeichen: Teil-Eingaben eines Werkzeugs gibt es nicht im Ereignisstrom.

## Vorschau im Browser
Temporäre Seite unter `apps/desktop/.preview-*/`, die nur die geänderten Komponenten mit `QueryClientProvider` und `TooltipProvider` einbindet und `rpc.start({ manageSidecar: false })` aufruft. Zusätzlich `window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener() {} }`. Komponenten mit `useProject(id).data!` brauchen vorab `queryClient.setQueryData(keys.project(id), …)`, sonst bleibt die Seite ohne Fehlermeldung leer. Der erste Aufruf nach dem Start von Vite bleibt oft leer, ein zweiter klappt. Das Verzeichnis ist nicht in .gitignore, also vor Ende des Durchlaufs löschen.
