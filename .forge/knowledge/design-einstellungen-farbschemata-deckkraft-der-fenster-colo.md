---
title: "Design-Einstellungen: Farbschemata, Transparenz (Acrylic), Farbwähler (colorScheme, schemeTokens, transparency)"
summary: "Wie Farbschemata, Transparenz-Stufen (Acrylic hinter dem Fenster) und der eigene Farbwähler gebaut sind und welche Stolperfallen es bei Farben, Buttons, Radix-Versionen, transparenten Fenstern und dem Test im echten Fenster gibt."
tags: ["ui","einstellungen","tauri","windows","sync","telefon","stolperfalle"]
updated: "2026-11-14T23:06:39.537Z"
---

# Design-Einstellungen: Farbschemata, Transparenz, Farbwähler

Gebaut 2026-11-14/15 auf Wunsch des Besitzers: Voreinstellungen (FORGE, Gruvbox, Vampire, Nord, Tokyo Night, Catppuccin, Solarized, Everforest, Rosé Pine), eigene Schemata, Transparenz des Fensterhintergrunds, Reiter „Design“ in den Einstellungen, Hinweis nach dem Update, Schritt im Einrichtungsassistenten, Abgleich über GitHub.

## Entscheidungen des Besitzers
- **Das Logo bleibt, wie es ist.** Eine Einfärbung nach Akzentfarbe war gebaut und wurde zurückgenommen: „die Farben sollen sich nur auf die Anwendung und nicht aufs Logo anwenden“. Nicht wieder einbauen.
- **FORGE-Karten im Chat** („Im Projektwissen gelesen …“, `forge-highlight.tsx`, Ton `accent`) sind in der Akzentfarbe (`border-accent/40 bg-accent-soft`). Das ersetzt die neutrale Variante aus dem Eintrag zur Formensprache.
- **Schemata dunkel wie FORGE.** Mit den Original-Hintergründen der Paletten (Nord `#2e3440`, Gruvbox `#282828` …) fand der Besitzer die Schemata „blass und mit zu wenig Kontrast“. Die Voreinstellungen behalten Farbton, Text, Akzent und Signalfarben ihrer Palette, die Hintergründe liegen aber auf der Helligkeit von FORGE (Backdrop um `#0b…`, Hauptfläche um `#13…`, Flächen um `#19…`). Neue Voreinstellungen genauso anlegen.
- **Transparenz: Blur hinter dem Fenster, Inhalt deckend.** Drei Anläufe: erst ein Regler für die Deckkraft des ganzen Fensters (Layered Window, auch Text wurde durchscheinend), dann Stufen davon, dann die Vorgabe: „leichter Blur hinter dem Fenster (Acrylic-/Mica-artig), vollständig deckende Texte und UI-Elemente“, Stufen Aus, Leicht, Mittel, Stark, **Standard Leicht** („wirklich kaum transparent, wie 99 %“). Die Deckkraft des ganzen Fensters nicht wieder einbauen.
- **Farbwähler im FORGE-Stil**, nicht der des Systems (`<input type="color">` wurde abgelehnt).

## Aufbau
- `packages/protocol/src/design.ts`: `SchemeColors` (sieben Farben: bg, surface, fg, accent, success, warning, danger), `CustomScheme` (id `custom-<zufall>`), `SCHEME_PRESETS`, `colorSchemes()`, `activeColorScheme()`, `Transparency` (`off`, `light`, `medium`, `strong`).
- Einstellungen (alle synchronisiert, keine in `LOCAL_SETTINGS`): `colorScheme` (Kennung), `customSchemes`, `transparency` (Standard `light`), `designAsked`. Test „design goes along“ in `sync.test.ts`. Das frühere `windowOpacity` gibt es nicht mehr.
- `apps/desktop/src/lib/design.ts`: `schemeTokens()` mischt aus den sieben Farben alle CSS-Tokens und setzt sie als Inline-Variablen auf `<html>`. **Das Schema FORGE setzt nichts**, dort gilt allein `styles.css`. `useDesignSync()` läuft im Hauptfenster und in Chat-Fenstern. `previewScheme()` zeigt ein Schema ohne Speichern (Editor). Schema und Transparenz-Stufe liegen in `localStorage` (`forge.design`, `forge.transparency`) und werden in `main.tsx` vor dem ersten Rendern gemalt. `hexToHsv`/`hsvToHex` für den Farbwähler.
- Helle eigene Schemata: `data-tone="light"` auf `<html>` schaltet Code-Farben und den Schleier hinter Dialogen um. Voreinstellungen sind alle dunkel; ein helles Schema ist nicht durchgeprüft.
- Offene Terminals bekommen neue Farben über das Fenster-Ereignis `forge:design` (`terminal-registry.ts`).
- Oberfläche: `components/settings/SchemePicker.tsx` (Karten mit Mini-Vorschau, `TransparencyChoice` als `RadioGroup`), `DesignSettings.tsx` (Reiter, Editor, Löschen; Rechtsklick auf eine Karte: Anwenden, Bearbeiten, Kopie, Löschen), `components/ui/color-picker.tsx` (Popover mit Feld für Sättigung/Helligkeit und Farbton-Leiste, Maus und Pfeiltasten), `components/setup/DesignPrompt.tsx`, Schritt 5 in `SetupWizard.tsx`.
- Hinweis nach dem Update: `DesignPrompt` kommt, wenn `setupDone`, `syncAsked`, `usageStatsAsked` gesetzt sind und `designAsked` nicht. Jedes Schließen setzt `designAsked`. Der Assistent setzt es beim Abschluss mit.
- Palette: „Farbschema: <Name>“ je Schema, „Eigenes Farbschema anlegen“ (`ui.designRequest = "new"`), „Transparenz des Fensterhintergrunds: <Stufe>“. Telefon: `forge_settings` mit `color_scheme` (Name, unscharf) und `window_transparency`.

## Transparenz (Technik)
- **Fenster:** unter Windows sind Haupt- und Chat-Fenster transparent angelegt (`apps/desktop/src-tauri/tauri.windows.conf.json`, `transparent: true`, ohne `backgroundColor`). Die Datei ersetzt das ganze Array `app.windows` der Basis-Konfiguration (JSON Merge Patch): **Änderungen an den Fenstern in `tauri.conf.json` dort nachziehen.** macOS und Linux bleiben deckend (macOS bräuchte die private API).
- **Blur:** `src-tauri/src/transparency.rs`: `set_window_transparency` schaltet Acrylic über `set_effects` (window-vibrancy, ab Build 22523 `DWMWA_SYSTEMBACKDROP_TYPE`), `transparency_supported` meldet Windows 11 22H2 oder neuer (Build 22621). Darunter ruckelt Acrylic beim Verschieben und Ändern der Größe, dort bleibt alles deckend und die Oberfläche bietet die Einstellung nicht an (`useTransparencySupported`).
- **Start:** Ein transparentes Fenster ist durchsichtig, bis die Seite etwas gemalt hat. `transparency::prepare` (Hauptfenster in setup, jedes neue Chat-Fenster) schaltet deshalb auf unterstützten Systemen den Blur sofort ein (dunkles Material statt Loch); die Seite schaltet ihn wieder aus, wenn die Einstellung „Aus“ ist. Wo es keinen Blur gibt (Windows 10), bekommt das Fenster stattdessen eine feste Hintergrundfarbe. Auf Windows 10 ist das nicht getestet.
- **Was durchscheint, entscheidet CSS:** `paint()` setzt je Stufe (`TRANSPARENCY_LOOK`) `--color-backdrop` mit Alpha (Leicht 0,8, Mittel 0,55, Stark 0,3) und ab Mittel `--color-shell-side` für die Seitenleiste (0,9 bzw. 0,7; Klasse `bg-shell-side` nur am Wurzelelement der `Sidebar`). Die Hauptfläche (`bg-bg`) bleibt immer deckend: darin gibt es viele eigene `bg-bg`-Elemente (klebende Köpfe), die sonst als Flecken auffielen.
- Der Blur von Windows ist sehr stark und dunkel getönt; mit einer bunten Seite dahinter sieht man bei „Stark“ weiche Farbflächen, bei „Leicht“ fast nichts. Windows zeigt den Effekt nur am aktiven Fenster.

## Titelleiste (Wünsche des Besitzers)
- Die Marken der Fensterknöpfe sind eigene 10px-SVGs (`Glyph` in `TitleBar.tsx`) mit 1px-Linien auf Pixelmitten. Mit Lucide-Icons lagen die geraden Linien von Minimieren und Maximieren auf zwei Pixelreihen und wirkten dunkler als das X.
- Zwischen den Knöpfen der App (Layout-Schalter, Remote, Sync, Telefon, Pin) und den drei Fensterknöpfen steht ein Trennstrich.
- Das Remote-Control-Icon liegt per `InTitleBar` in der Titelleiste (`RemoteControlButton compact`), nicht mehr in der Projektleiste. Ohne Titelleiste (macOS, Linux) bleibt es mit Beschriftung im Projektkopf.

## Stolperfallen
- **Radix-Pakete müssen dieselbe `@radix-ui/react-dismissable-layer` nutzen.** `@radix-ui/react-popover` in der neuesten Version brachte eine zweite Version mit: Das Popover lag sichtbar über dem Dialog, bekam aber keine Mausklicks (die gingen an die Dialog-Knöpfe darunter), und Escape schloss den ganzen Dialog. Deshalb ist Popover fest auf `1.2.0` gesetzt (gleiche Unterpakete wie Dialog 1.2.0, Select 2.3.8, Dropdown 2.1.25). Bei Updates alle Radix-Pakete zusammen anheben und in `pnpm-lock.yaml` prüfen, dass es `react-dismissable-layer` nur einmal gibt. Danach den Vite-Dev-Server mit `--force` neu starten.
- **tailwind-merge hält eigene Schriftgrößen (`text-body`, `text-caption` …) für Farben.** In `cn("text-accent-fg … text-body")` fällt die Farbe weg. Mit hellem Akzent war die Schrift auf Primär-Buttons unlesbar. Darum `text-accent-fg!` in `button.tsx`. Ghost-Buttons in Größe `md` verlieren aus demselben Grund ihr `text-muted`; das ist der gewohnte Stand und bewusst nicht angefasst.
- Text auf Akzent: Weiß ab Kontrast 2,75 (knapp unter FORGE-Orange mit 2,8), sonst ein dunkler Ton des Akzents. Neue feste Farben (z. B. `text-white` auf `bg-accent`) brechen bei hellen Akzenten: immer `text-accent-fg`.
- Lange Listen in den Einstellungen (Backups, Versionen auf GitHub, „Nur auf diesem PC“) zeigen drei Einträge und den Rest auf Klick: `useShown()` in `components/settings/show-more.tsx`.

## Prüfen
- Oberfläche: Browser-Brücke aus dem Eintrag zur Formensprache (Port 1430). `preview_screenshot` von FORGE zeigte dort nur Weiß; eigenes Headless-Chrome per CDP funktioniert (`apps/desktop/node_modules/.cache/forge-preview/design/cdp.mjs`, Skripte `s*.mjs`). Achtung: Der Sidecar der Brücke nutzt die echte `gh`-Anmeldung, der Sync-Schritt des Assistenten findet das echte `forge-data`. Dort den Sync-Schalter ausschalten, bevor man weiterklickt.
- Transparenz nur im echten Fenster: `pnpm tauri dev` in `apps/desktop` mit `FORGE_DATA_DIR`, `WEBVIEW2_USER_DATA_FOLDER` und `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9334`, dann `tauri-eval.mjs`. `design/backdrop.ps1` liest den Zustand ohne Bildschirmfoto (`DWMWA_SYSTEMBACKDROP_TYPE`: 1 aus, 3 Acrylic). Nach dem ersten Laden einmal neu laden; ein `Page.reload` direkt beim Start landete einmal auf `about:blank` (`design/nav.mjs` navigiert zurück).
- **Keine Bildschirmfotos vom Desktop des Besitzers.** `design/stage.ps1` legt eine eigene Testseite hinter das Dev-Fenster und nimmt nur dessen Rechteck auf. Das ging einmal schief (der Besitzer arbeitete nebenher, das Foto zeigte seinen Explorer) und stiehlt den Fokus. Nur nutzen, wenn es sein muss, sonst über `backdrop.ps1` und die CSS-Werte prüfen. `Get-Process().MainWindowHandle` liefert bei minimiertem Fenster ein 16x16-Hilfsfenster von tao: Fenster über `EnumWindows` und den Titel suchen.
- Bash-Heredocs scheitern an Texten mit Anführungszeichen, Backticks und Backslashes: Edit-Skripte mit dem Write-Werkzeug unter `apps/desktop/node_modules/.cache/edits/` anlegen (`edit-lib.mjs` ersetzt Textstellen und kommt mit CRLF zurecht).
- Tests: `components/setup/DesignPrompt.test.tsx` (Hinweis, Editor, Löschen, Tokens, Stufen), `palette-actions.test.tsx`, `SetupWizard.test.tsx`, `phone-call.test.ts`.
