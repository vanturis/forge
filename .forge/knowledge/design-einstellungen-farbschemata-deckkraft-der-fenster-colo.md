---
title: "Design-Einstellungen: Farbschemata, Deckkraft der Fenster (colorScheme, schemeTokens, set_window_opacity)"
summary: "Wie Farbschemata und Fenster-Deckkraft gebaut sind (Tokens zur Laufzeit, Voreinstellungen im Protokoll, Layered Window unter Windows, Hinweis nach dem Update, Schritt im Assistenten) und welche Stolperfallen es bei neuen Farben, Buttons und dem Test im echten Fenster gibt."
tags: ["ui","einstellungen","tauri","windows","sync","telefon","stolperfalle"]
updated: "2026-11-14T22:22:48.945Z"
---

# Design-Einstellungen: Farbschemata und Deckkraft

Gebaut 2026-11-14 auf Wunsch des Besitzers: Voreinstellungen (FORGE, Gruvbox, Vampire, Nord, Tokyo Night, Catppuccin, Solarized, Everforest, Rosé Pine), eigene Schemata, Deckkraft per Schieberegler, Reiter „Design“ in den Einstellungen, Hinweis nach dem Update, Schritt im Einrichtungsassistenten, Abgleich über GitHub.

## Entscheidungen des Besitzers
- **Das Logo bleibt, wie es ist.** Eine Einfärbung nach Akzentfarbe war gebaut und wurde im selben Auftrag zurückgenommen: „die Farben sollen sich nur auf die Anwendung und nicht aufs Logo anwenden“. Nicht wieder einbauen.
- **FORGE-Karten im Chat** („Im Projektwissen gelesen …“, `forge-highlight.tsx`, Ton `accent`) sind in der Akzentfarbe (`border-accent/40 bg-accent-soft`). Das ersetzt die neutrale Variante aus dem Eintrag zur Formensprache.

## Aufbau
- `packages/protocol/src/design.ts`: `SchemeColors` (sieben Farben: bg, surface, fg, accent, success, warning, danger), `CustomScheme` (id `custom-<zufall>`), `SCHEME_PRESETS`, `colorSchemes()`, `activeColorScheme()`, `WINDOW_OPACITY_MIN/MAX/CHOICES`. Im Protokoll, weil auch das Telefon Namen und Kennungen braucht.
- Einstellungen (alle synchronisiert, keine in `LOCAL_SETTINGS`): `colorScheme` (Kennung), `customSchemes`, `windowOpacity` (50 bis 100), `designAsked`. Test „design goes along“ in `sync.test.ts`.
- `apps/desktop/src/lib/design.ts`: `schemeTokens()` mischt aus den sieben Farben alle CSS-Tokens (Flächenstufen, Rahmen, gedämpfter Text) in den Verhältnissen des FORGE-Looks und setzt sie als Inline-Variablen auf `<html>`. **Das Schema FORGE setzt nichts**, dort gilt allein `styles.css`. `useDesignSync()` läuft im Hauptfenster und in Chat-Fenstern. `previewScheme()` zeigt ein Schema ohne Speichern (Editor). Das letzte Schema liegt in `localStorage` (`forge.design`) und wird in `main.tsx` vor dem ersten Rendern gemalt, damit der Startbildschirm nicht umspringt.
- Helle eigene Schemata: `data-tone="light"` auf `<html>` schaltet Code-Farben und den Schleier hinter Dialogen um. Voreinstellungen sind alle dunkel; ein helles Schema ist nicht durchgeprüft.
- Offene Terminals bekommen neue Farben über das Fenster-Ereignis `forge:design` (`terminal-registry.ts`).
- Oberfläche: `components/settings/SchemePicker.tsx` (Karten mit Mini-Vorschau, `OpacitySlider`), `DesignSettings.tsx` (Reiter, Editor, Löschen; Rechtsklick auf eine Karte: Anwenden, Bearbeiten, Kopie, Löschen), `components/setup/DesignPrompt.tsx`, Schritt 5 in `SetupWizard.tsx`, `components/ui/slider.tsx` (`.slider` in styles.css).
- Hinweis nach dem Update: `DesignPrompt` kommt, wenn `setupDone`, `syncAsked`, `usageStatsAsked` gesetzt sind und `designAsked` nicht. Jedes Schließen setzt `designAsked`. Der Assistent setzt es beim Abschluss mit, neue Installationen sehen den Hinweis also nie.
- Palette: „Farbschema: <Name>“ je Schema, „Eigenes Farbschema anlegen“ (`ui.designRequest = "new"`), Deckkraft in Stufen. Telefon: `forge_settings` mit `color_scheme` (Name, unscharf) und `window_opacity`.

## Deckkraft der Fenster
- Tauri hat keinen Aufruf dafür. `apps/desktop/src-tauri/src/opacity.rs`: Befehl `set_window_opacity` (jedes Fenster ruft ihn für sich). Windows: `WS_EX_LAYERED` + `SetLayeredWindowAttributes`; bei 100 % wird das Layered-Bit wieder entfernt, wer die Einstellung nicht nutzt, bekommt also ein unverändertes Fenster. macOS: `NSWindow.setAlphaValue` (nicht testbar gewesen, kompiliert nur in CI). Linux: nichts, `supportsWindowOpacity` blendet den Regler aus.
- Bewusst die ganze Fenster-Deckkraft (auch Text wird durchscheinend) statt eines transparenten Fensters: `transparent: true` müsste für alle Nutzer bei der Fenstererzeugung gesetzt werden, braucht auf macOS die private API und ist unter WebView2 anfällig.
- **Stolperfalle:** tao schreibt den erweiterten Fensterstil bei jeder Flag-Änderung neu (Maximieren, Dekorationen, „Im Vordergrund bleiben“) und verliert das Layered-Bit. Deshalb `opacity::reapply` bei `Resized`/`Focused` (lib.rs) und direkt nach jedem eigenen `set_always_on_top` (chat_windows.rs). Wer weitere Fenster-Flags zur Laufzeit ändert, muss danach `reapply` aufrufen.
- Der Regler wendet beim Ziehen direkt an (`applyWindowOpacity`) und speichert erst beim Loslassen, sonst entstünde pro Schritt eine Einstellung und ein Sync.

## Stolperfallen
- **tailwind-merge hält eigene Schriftgrößen (`text-body`, `text-caption` …) für Farben.** In `cn("text-accent-fg … text-body")` fällt die Farbe weg. Bei FORGE-Orange fiel das nie auf (Weiß neben Fast-Weiß); mit hellem Akzent war die Schrift auf Primär-Buttons unlesbar. Darum `text-accent-fg!` in `button.tsx`. Ghost-Buttons in Größe `md` verlieren aus demselben Grund ihr `text-muted`; das ist der gewohnte Stand und bewusst nicht angefasst.
- Text auf Akzent: Weiß ab Kontrast 2,75 (knapp unter FORGE-Orange mit 2,8, damit eine Kopie des FORGE-Schemas weiße Schrift behält), sonst ein dunkler Ton des Akzents.
- Neue feste Farben in Komponenten (z. B. `text-white` auf `bg-accent`) brechen bei hellen Akzenten: immer `text-accent-fg`.

## Prüfen
- Oberfläche: Browser-Brücke aus dem Eintrag zur Formensprache (Port 1430). `preview_screenshot` von FORGE zeigte dort nur Weiß; eigenes Headless-Chrome per CDP funktioniert (`apps/desktop/node_modules/.cache/forge-preview/design/cdp.mjs`). Achtung: Der Sidecar der Brücke nutzt die echte `gh`-Anmeldung, der Sync-Schritt des Assistenten findet das echte `forge-data`. Dort den Sync-Schalter ausschalten, bevor man weiterklickt.
- Deckkraft nur im echten Fenster: `pnpm tauri dev` in `apps/desktop` mit `FORGE_DATA_DIR`, `WEBVIEW2_USER_DATA_FOLDER` und `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9334`, dann `tauri-eval.mjs` und die PowerShell-Skripte in `forge-preview/design/` (`find.ps1` liest Layered-Zustand und Alpha, `pixel.ps1` liest Bildschirmfarben im Fenster). `PrintWindow` zeigt ein Layered-Fenster mit WebView2 nur schwarz, das ist kein Fehler. `Get-Process().MainWindowHandle` liefert bei minimiertem Fenster ein 16x16-Hilfsfenster von tao: Fenster über `EnumWindows` und den Titel suchen.
- Tests: `components/setup/DesignPrompt.test.tsx` (Hinweis, Editor, Löschen, Tokens), `palette-actions.test.tsx`, `SetupWizard.test.tsx`, `phone-call.test.ts`.
