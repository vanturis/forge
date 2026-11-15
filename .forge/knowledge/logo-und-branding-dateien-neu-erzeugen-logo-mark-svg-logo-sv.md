---
title: "Logo und Branding neu erzeugen (logo.svg, Wortmarke, Icons, Banner, Social Preview, Screenshots, demo.gif)"
summary: "Wo das FORGE-Logo überall steckt und wie man alle Varianten (App-Icons, Wortmarke, Installer-Bilder, Banner, Social Preview, README-Screenshots, Landingpage-Bilder, OG-Bilder, demo.gif) aus den Quellen neu erzeugt."
tags: ["branding","release","installer","tauri","stolperfalle","preview"]
updated: "2026-11-15T09:18:43.166Z"
---

# Logo und Branding-Dateien neu erzeugen

Stand 2026-11-15. Logo seit 2026-10-19: oranger Funke oben, heller Amboss, auf dunkler Kachel mit orangem Leuchtrand; die Formen sind von Hand als Vektor nachgebaut.

## Quellen
- `apps/desktop/src/assets/logo-mark.svg`: nur die Bildmarke (ohne Kachel).
- `apps/desktop/src/assets/logo.svg`: App-Icon = Kachel + Leuchtrand + Marke (Pfade aus logo-mark.svg kopiert, `transform` skaliert). Beide zusammen ändern. Kopie: `services/stats/src/app/icon.svg`.
- `apps/desktop/src/assets/forge-logo.png`: Wortmarke (Marke + Schriftzug „FORGE“), nur als Raster vorhanden. Gleiche Datei in `apps/installer/ui/assets/`. Das Seitenverhältnis steht in `Logo.tsx` und `apps/installer/ui/index.html`.
- Website: `services/stats/src/assets/forge-wordmark.png` (944 x 184). Ändert sich forge-logo.png, neu erzeugen.

## Erzeugen
- Rendern geht mit sharp, das `next` in `services/stats` mitbringt: `createRequire(require.resolve("next/package.json"))("sharp")`, `sharp.cache(false)`. Kein PIL auf dem Rechner. ffmpeg ist per WinGet installiert (`Gyan.FFmpeg`), Chrome unter `C:/Program Files/Google/Chrome/Application/chrome.exe`.
- App-Icons: in `apps/desktop` `pnpm tauri icon src/assets/logo.svg`; danach die erzeugten Ordner für Android und iOS unter `src-tauri/icons/` löschen. Der Installer nutzt `../desktop/src-tauri/icons/icon.ico`.
- NSIS-Bilder: `powershell -File apps/desktop/src-tauri/installer/render.ps1`.
- Stats-Favicons: `icon.svg` = logo.svg, `apple-icon.png` 256x256 aus logo.svg.

## Banner und Social Preview (seit 2026-11-15 ein Bild des Besitzers)
- Der Besitzer hat am 2026-11-15 ein fertiges Pixel-Art-Banner geliefert (Schmiede wie auf der Website, Wortmarke, „A desktop app for Claude Code“, drei Chips, „a product by Vanturis“, rechts das App-Icon). Es ersetzt das frühere, aus HTML gerenderte Banner; dessen Quellen (`.github/assets/banner/*.html`, `banner.css`) und `banner.png` / `banner-en.png` sind gelöscht.
- `.github/assets/banner.webp` (1774 x 887, unverändert die gelieferte Datei): README.md **und** README.de.md nutzen dieselbe Datei. Eine deutsche Fassung gibt es nicht, der Text im Bild ist englisch.
- `.github/assets/social-preview.png`: dasselbe Bild auf 1280 x 640 (lanczos3). Die Social Preview lädt der Besitzer selbst in den Repo-Einstellungen hoch (Settings → General → Social preview, höchstens 1 MB).
- Lokales Launch-Kit (nicht im Repo): `.forge-demo/launch-kit/banner-1270x760.png`, das Bild auf 1270 x 635 mittig vor einer abgedunkelten, weichgezeichneten Kopie (das Format 5:3 würde sonst „Vanturis“ abschneiden).
- Die OG-Bilder der Website (`services/stats/src/assets/og-{de,en}.png`) sind ein eigenes Motiv aus `scripts/og-images.mjs` und wurden nicht ersetzt.
- Neues Banner vom Besitzer: Datei nach `.github/assets/banner.webp`, Social Preview und Launch-Kit daraus neu rechnen. Nichts selbst umgestalten.

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
