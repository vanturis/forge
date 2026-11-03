---
title: "macOS-Menüleiste (AppMenu, app-menu.ts, Tastenkürzel Seite vor Menü)"
summary: "Wie FORGEs eigene Menüleiste auf macOS aus den Aktionen der Befehlspalette entsteht, warum nur manche Einträge Tastenkürzel haben und wie WebKit Tastenkürzel zwischen Seite und Menü verteilt."
tags: ["ui","tauri","stolperfalle","konvention"]
updated: "2026-11-03T20:49:58.820Z"
---

# macOS-Menüleiste (seit 2026-11-03)

- Aufbau in `apps/desktop/src/components/layout/app-menu.ts` (`APP_MENU`), gesetzt von `AppMenu.tsx` über `@tauri-apps/api/menu` (`setAsAppMenu`). Eingehängt in `CommandPalette.tsx`, nur bei `isMac && isTauri()`. Die Rechte deckt `core:default` (enthält `core:menu:default`) schon ab.
- Ein Menüeintrag führt **den Eintrag der Befehlspalette** aus (`ids` → `buildActions`). Was die Palette gerade nicht anbietet, ist ausgegraut. `live: true` zeigt den aktuellen Text des Eintrags (ein/aus, starten/stoppen). Den Kontext liefert `useActionContext` (`action-context.ts`), denselben nutzt die Palette.
- Neue Funktion ins Menü: Eintrag in `buildActions` (für Palette und Suche ohnehin nötig), dann in `APP_MENU` mit der Kennung. Der Test „macOS menu bar“ in `palette-actions.test.tsx` schlägt fehl, wenn eine Kennung im Menü keinen Palette-Eintrag mehr hat.
- macOS-Texte: die Menüs werden in JS mit `t` gebaut, ein Sprachwechsel lädt das Fenster neu und baut das Menü neu. Bis die UI geladen ist, gilt Tauris Standardmenü (mit Bearbeiten-Menü, sonst gehen ⌘C/V nicht).
- Aktualisiert werden nur geänderte Texte und Zustände (`syncItems`), weil `buildActions` bei jeder Statusänderung einer Session neu läuft.
- Klick bei offenem Dialog: nichts passiert (wie bei den Tastenkürzeln, `dialogOpen` aus `lib/shortcuts.ts`). Bei offener Palette schließt sie sich zuerst.

## Tastenkürzel: Seite vor Menü (gemessen im echten WKWebView)
WebKit gibt ein ⌘-Kürzel zuerst an die Seite. Ruft die Seite `preventDefault()` auf, bekommt das Menü es **nicht**. Sonst löst danach der Menüeintrag aus. Gemessen 2026-11-03 mit einem kleinen Objective-C-Programm (NSMenu mit keyEquivalent, WKWebView, `[NSApp postEvent:]`): ⌘K mit preventDefault ergab nur `page-k`, ⌘J ohne ergab `page-j` und `menu-j`.

Folge: Kürzel im Menü nur für app-weite Kürzel, die `handleGlobalShortcut` schon mit preventDefault behandelt (⌘K, ⌘N, ⌘O, ⌘J, ⇧⌘E) plus ⌘, für die Einstellungen. ⌘F und ⌃R haben bewusst kein Kürzel im Menü: Terminal und Editoren behalten sie, ohne sie als behandelt zu markieren. Das Menü würde dann „Im Chat suchen“ auslösen.
