---
title: "UI-Design: Formensprache im Cento-Stil, neutrale Grautöne, eigene Titelleiste (TitleBar, hasTitleBar, InTitleBar)"
summary: "Gestaltungsregeln seit dem Redesign vom 2026-11-14 für App, Setup und Website: neutrale Grautöne ohne Blaustich, Orange sparsam, Formen wie im Projekt Cento, eigene Titelleiste unter Windows. Vor jeder neuen Oberfläche lesen."
tags: ["ui","konvention","tauri","windows","preview"]
updated: "2026-11-14T19:47:47.070Z"
---

# UI-Design: Formensprache im Cento-Stil, neutrale Grautöne, eigene Titelleiste

Am 2026-11-14 hat der Besitzer ein komplettes Redesign verlangt: Formen wie im Projekt Cento (`C:\Users\tjorven\Documents\Coding\cento`, `packages/ui`, `packages/brand/css/tokens.css`), „erwachsener und professioneller“. Nach dem ersten Stand kam nach: „Das Blau im Hintergrund ist so verspielt, was Schwärzeres/Graueres. Viel seriöser und weniger verspielt“, alle Untermenüs im selben Stil, Erweiterungen im Layout der Einstellungen, Werkzeugleiste standardmäßig offen, eigene Leiste oben wie bei VS Code. Gilt für Desktop-App, Setup (`apps/installer/ui`) und Website (`services/stats`).

## Farben (Tokens in `apps/desktop/src/styles.css`, gleiche Werte im Setup und auf der Website)
- Neutrale Grautöne ohne Blaustich: backdrop `#0b0b0c` (Fenster hinter den Flächen), bg `#131314` (Website `#111112`), surface/sidebar `#19191a`, surface-2 `#202022`, surface-3 `#29292b`, border `#2c2c2f`, border-strong `#3f3f43`, fg `#ececee`, muted `#a3a3a8`, subtle `#73737a`. Keine blaustichigen Literale mehr einführen (auch nicht in `tauri.conf.json` `backgroundColor`, Banner, OG-Skript).
- Orange (`#f97316`) sparsam: Primäraktion, aktiver Punkt der Hauptnavigation, aktive Icons, Daten (Balken, Diagramme). `accent-soft` ist auf 9 % gesenkt und nur noch für Hinweise und gewählte Auswahlkarten (`border-accent bg-accent-soft`) da.
- Auswahl in Listen (Wissenseinträge, Branches, Commits, Docs, geteilte Ansicht in der Seitenleiste) ist neutral: `bg-surface-3`, bei Commits zusätzlich `ring-1 ring-inset ring-border-strong`.
- FORGE-Karten im Chat (`forge-highlight.tsx`, Ton `accent`) sind neutral (`border-border bg-surface`), das orange Icon in der Randspalte bleibt. Tests erkennen sie an `data-forge-highlight`, nicht an einer Farbklasse.

## Formen
- Radien: `rounded` 4px (Code-Chips), `rounded-sm` 6, `rounded-md` 10 (Felder, Menüeinträge, Selects), `rounded-lg` 14 (Listenzeilen, Hinweiskästen), `rounded-xl` 18 (Karten, Menüs, Panels im Projekt), `rounded-2xl` 24 (Shell-Flächen, Dialoge, Befehlspalette, Composer), `rounded-full` (Buttons, Badges, Chips, Navigation, Reiter, Suchfeld).
- Schatten sind die Tailwind-Stufen, neu belegt: `shadow-xs` Controls, `shadow-sm` Karten und Shell-Flächen, `shadow-md` gefüllte Buttons, `shadow-lg/xl/2xl` alles Schwebende. Keine eigenen Schatten-Namen: tailwind-merge in `cn()` hält unbekannte `shadow-*` für Farben.
- Shell (`App.tsx`): Seitenleiste und Hauptbereich sind zwei Flächen (`rounded-2xl border shadow-sm`, 10px Abstand) auf `bg-backdrop`; `main` hat `overflow-hidden`. Chat-Fenster genauso als eine Fläche.
- Navigation in zwei Ebenen: Hauptnavigation Pills `h-10`, aktiv `bg-accent text-accent-fg shadow-md`. Zweite Ebene (Reiter in `TabBar`, Menü links in `SettingsLayout`) Pills `h-9`, aktiv neutral `bg-surface-3` mit orangem Icon. `SettingsLayout` (`components/settings/layout.tsx`) ist das Muster für jede Seite mit Unterpunkten: Einstellungen, Projekt-Einstellungen, Dev-Tools und seit 2026-11-14 Erweiterungen (`wide` für Listen statt Formularzeilen; Skills hat Marketplace und Eigene Skills als Zweig). Der Hinweistext eines Abschnitts steht nur noch im Tooltip (`hint` optional).
- `Button` ist immer eine Pill (kein `rounded-*` per className). `Dialog`: 24px, keine Linien, runder Schließen-Knopf. `Page`: Kopf ohne Linie, Titel 22px. Karten: `rounded-xl border border-border bg-surface shadow-sm`. Seitenpanel rechts und unteres Panel im Projekt sind eingerückte Karten. Badges, Chips, Chip-Skeletons `rounded-full`. Abschnittsüberschriften `text-caption font-semibold uppercase tracking-[0.08em] text-subtle`. `EmptyState`: Icon in runder Fläche.
- Weiter gültig: keine farbigen Streifen am linken Rand, Skeletons in der Form des Inhalts.

## Eigene Titelleiste (nur Windows)
- `lib/title-bar.ts`: `hasTitleBar` = Windows und Tauri. macOS und Linux behalten die native Titelleiste und das Menü; dort bleibt alles in den Seitenköpfen (Wunsch des Besitzers: macOS im Zweifel lassen, auf einem Mac nicht testbar).
- Rust: Hauptfenster in `lib.rs` (setup) per `set_decorations(false)` unter `#[cfg(windows)]`, Chat-Fenster in `chat_windows.rs` mit `config.decorations = false`. Größenänderung an den Kanten und runde Ecken bleiben (tauri-runtime-wry hängt den Resize-Handler auch bei `set_decorations` zur Laufzeit an). Rechte in `capabilities/default.json`: `core:window:allow-start-dragging`, `allow-minimize`, `allow-toggle-maximize`, `allow-close`.
- `components/layout/TitleBar.tsx`: 44px (`h-11`), darunter 6px Luft bis zu den Flächen (`pt-1.5` in `App.tsx` und `ChatWindowView`; ohne die Luft wirkte der Abstand laut Besitzer „falsch“). Steht in `App.tsx` über allen Zuständen (auch „startet“ und „Hintergrunddienst läuft nicht“, sonst hätte das Fenster keine Knöpfe). Modus `main`: links das Logo, rechts die Layout-Schalter des Projekts, Sync, Telefon, Pin, Fensterknöpfe. Modus `bare` (Start, Chat-Fenster): Logo und Fensterknöpfe. Ziehen nur an Elementen mit `data-tauri-drag-region` (gilt nicht für Kinder).
- **Suchfeld und Herz bleiben in der Seitenleiste** (oben, über der Navigation). Der erste Stand hatte beide in der Titelleiste; der Besitzer wollte sie zurück. Mit Titelleiste entfällt in der Seitenleiste nur das Logo.
- `InTitleBar` schiebt Kinder per Portal in die Leiste (Layout-Schalter aus `WorkspaceHeader`, behalten so ihren Kontext wie `useSplitLayout`); ohne Titelleiste bleiben sie an Ort und Stelle. `AppButtons` (`Page.tsx`) rendert Sync, Pin und Telefon nur ohne Titelleiste.
- Geprüft im echten Fenster über `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9334` und CDP (`plugin:window|is_decorated`, `toggle_maximize`, Schließen des Chat-Fensters). Nicht prüfbar per CDP: Ziehen und Einrasten (Snap) mit der Maus.

## Werkzeugleiste
Die Reiterzeile des Projekts ist standardmäßig offen (`toolbarOpen: true` in `stores/ui.ts`). Gespeichert wird unter `toolbarShown`; das alte Feld `toolbarOpen` in `forge.ui` wird nicht mehr gelesen, weil es bei allen den früheren Standard (zu) enthält.

## Desktop-UI ohne Tauri ansehen (eine Datei, nichts im Git)
Eine `vite.config.mjs` unter `apps/desktop/node_modules/.cache/forge-preview/` (ignoriert): `root` ist `apps/desktop`; ein Plugin startet `packages/sidecar/dist/sidecar.mjs` mit `FORGE_DATA_DIR` auf eine Kopie von `.forge-demo/data/forge.db` und liefert `/preview.html` (setzt `__TAURI_INTERNALS__`, dann `import("/src/main.tsx")`), `/bridge/send`, `/bridge/events` (SSE), `/bridge/rpc`. Stubs: `sidecar_status` true, `chat_windows` `{sessions: [], pinned: []}`, `install_check` `{release: false, missing: []}`, `plugin:window|is_*` false. Start: `pnpm exec vite --config node_modules/.cache/forge-preview/vite.config.mjs` in `apps/desktop` (Port 1430), vorher `pnpm --filter @forge/sidecar build`. Der Browser meldet Windows, also erscheint dort auch die Titelleiste.
- Nach jedem Neustart von Vite bleibt der erste Seitenaufruf leer (Abhängigkeiten werden neu optimiert): einmal neu laden. Das gilt auch für das echte Dev-Fenster nach einem Wechsel zwischen Brücke und `pnpm dev`.
- Eine Session öffnet man über die Zeile in „Sessions“ oder „Fortsetzen“ auf der Startseite (öffnet nur, Claude startet erst mit einer Nachricht).
- Radix-Reiter reagieren nur auf echte Mausereignisse (CDP `Input.dispatchMouseEvent`), nicht auf `el.click()`.
- Tauri-Dev und Brücke nicht gleichzeitig auf derselben Datenkopie laufen lassen. TaskStop beendet nur die Shell: Vite (Port 1420 bzw. 1430), `target\debug\forge-desktop.exe` und den Sidecar danach gezielt beenden, nie die installierte FORGE unter `%LOCALAPPDATA%\FORGE`.

## Stolperfallen
- Bash-Heredocs mit Backslashes scheitern in dieser Shell: Edit-Skripte mit dem Write-Werkzeug als Datei anlegen.
- Massen-Ersatz per sed auf Klassenmuster kann Klassen doppeln (z. B. `shadow-sm shadow-2xl`): danach greppen.
- Ein Ordner lässt sich unter Windows nicht löschen, solange die eigene Shell darin steht (EBUSY).
