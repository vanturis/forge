---
title: "Logo und Branding neu erzeugen (logo.svg, Wortmarke, Icons, Banner, Social Preview, Screenshots, demo.gif)"
summary: "Wo das FORGE-Logo überall steckt und wie man alle Varianten (App-Icons, Wortmarke, Installer-Bilder, Banner, Social Preview, README-Screenshots, Landingpage-Bilder, OG-Bilder, demo.gif) aus den Quellen neu erzeugt."
tags: ["branding","release","installer","tauri","stolperfalle","preview"]
updated: "2026-11-14T18:40:37.700Z"
---

# Logo und Branding-Dateien neu erzeugen

Stand 2026-11-14 (nach dem Redesign: neutrale Grautöne, eigene Titelleiste). Logo seit 2026-10-19: oranger Funke oben, heller Amboss, auf dunkler Kachel mit orangem Leuchtrand; die Formen sind von Hand als Vektor nachgebaut.

## Quellen
- `apps/desktop/src/assets/logo-mark.svg`: nur die Bildmarke (ohne Kachel).
- `apps/desktop/src/assets/logo.svg`: App-Icon = Kachel + Leuchtrand + Marke (Pfade aus logo-mark.svg kopiert, `transform` skaliert). Beide zusammen ändern. Kopie: `services/stats/src/app/icon.svg`.
- `apps/desktop/src/assets/forge-logo.png`: Wortmarke (Marke + Schriftzug „FORGE“), nur als Raster vorhanden. Gleiche Datei in `apps/installer/ui/assets/`. Das Seitenverhältnis steht in `Logo.tsx` und `apps/installer/ui/index.html`.
- Website: `services/stats/src/assets/forge-wordmark.png` (944 x 184). Ändert sich forge-logo.png, neu erzeugen.

## Erzeugen
- Rendern geht mit sharp aus `services/stats/node_modules/.pnpm/sharp@*/node_modules/sharp` (Einstieg `dist/index.cjs`, `sharp.cache(false)`). Kein PIL auf dem Rechner. ffmpeg ist per WinGet installiert (`Gyan.FFmpeg`), Chrome unter `C:/Program Files/Google/Chrome/Application/chrome.exe`.
- App-Icons: in `apps/desktop` `pnpm tauri icon src/assets/logo.svg`; danach die erzeugten Ordner für Android und iOS unter `src-tauri/icons/` löschen. Der Installer nutzt `../desktop/src-tauri/icons/icon.ico`.
- NSIS-Bilder: `powershell -File apps/desktop/src-tauri/installer/render.ps1`.
- Stats-Favicons: `icon.svg` = logo.svg, `apple-icon.png` 256x256 aus logo.svg.

## Banner und Social Preview
- Quellen: `.github/assets/banner/banner.{de,en}.html` + `banner.css`. Aufbau fest (Wunsch des Besitzers): links Wortmarke, Titel mit „Claude Code“ in Orange, Lead, unten drei Chips mit orangen Stichwörtern, rechts unten „ein Produkt von Vanturis“, rechts das leicht gedrehte App-Icon `logo.svg` mit dezentem warmem Licht dahinter. Farben neutral (Hintergrund `#161617` nach `#0b0b0c`, Chips `#19191a` mit Rahmen `#2c2c2f`), kein Blau.
- **Nicht umbauen:** Ein Versuch am 2026-11-14 mit App-Screenshot statt Icon wurde vom Besitzer klar abgelehnt („soll so aussehen wie die alte, nur mit der neuen Farbe und dem Design“).
- Rendern mit Chrome: `--headless=new --window-size=1280,640 --force-device-scale-factor=2 --virtual-time-budget=5000 --screenshot=…` → `banner.png` (deutsch) und `banner-en.png`. `social-preview.png` ist das **englische** Banner bei Faktor 1 (1280x640). Die Social Preview muss in den GitHub-Repo-Einstellungen von Hand hochgeladen werden (Settings → General → Social preview).

## Screenshots der App
Aufnahme über die Browser-Brücke aus dem Eintrag zur Formensprache (Port 1430) mit Chrome headless per CDP bei Pixeldichte 2 (`Emulation.setDeviceMetricsOverride`, `Page.captureScreenshot`):
- README: `.github/assets/screenshots/start.png`, `projekte.png`, `en/start.png`, `en/projects.png`, je 2880x1800 (1440x900).
- Landingpage: Chat-Ansicht mit leerer Session und Text im Composer, 2400x1680 (1200x840), als `services/stats/src/assets/app-{de,en}-2400.webp` und mit lanczos3 verkleinert auf 1600, 1200, 800 (`webp({quality: 84, smartSubsample: true})`). Danach OG-Bilder: in `services/stats` `node scripts/og-images.mjs` (nimmt `app-{lang}-1600.webp`).
- Vor der Aufnahme per RPC: `settings.update` mit `language` und `limitWarnings: false` (sonst steht „Limit gegen …“ in der Claude-Karte), danach `system.usage` mit `refresh: true` (sonst bleiben die Fensternamen in der alten Sprache), dann `about:blank` und mit `?lang=` laden. Toasts vor dem Bild entfernen. Testsessions und der Ordner „Temporäre Chats“ aus der Datenkopie löschen (`sessions.delete`, `projects.remove`).

## demo.gif
README, 1100x700, ca. 24 s, unter 1 MB: ein Rundgang aus Einzelbildern statt eines Videos. Ein Skript klickt sich per CDP durch die Brücke (englische Oberfläche): Start, Projekte, Sessions, die Session „Landing page testimonials and FAQ“ in sieben Scrollschritten, Git, Dateien, Befehlspalette mit „git“, Erweiterungen, Einstellungen, Start. Jedes Bild bekommt eine Standzeit; zusammengesetzt mit `ffmpeg -f concat -safe 0 -i list.txt -fps_mode vfr -vf "split[a][b];[a]palettegen=max_colors=160:stats_mode=full[p];[b][p]paletteuse=dither=bayer:bayer_scale=4" -loop 0 demo.gif` (`list.txt`: `file`/`duration`, letztes Bild doppelt). Alt-Text und Unterzeile stehen in README.md und README.de.md und müssen zum Inhalt passen. Das frühere GIF war eine Bildschirmaufnahme des Besitzers mit echten Claude-Läufen.

## Stolperfallen
- Write/Edit außerhalb des Projekts ist im Autonomous-Profil gesperrt; Hilfsdateien unter `apps/desktop/node_modules/.cache/` ablegen (ignoriert).
- Reiter in schmalen Fenstern zeigen nur Icons: per `aria-label` suchen, nicht per Text.
