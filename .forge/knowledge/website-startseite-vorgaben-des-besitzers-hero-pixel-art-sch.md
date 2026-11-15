---
title: "Website-Startseite: Vorgaben des Besitzers (Hero mit Schmiede-Bild, Pixel-Art, Schaublöcke, keine Eyebrows, Ultrawide)"
summary: "Was der Besitzer für die Startseite von forge.vanturis.de festgelegt und abgelehnt hat: Hero mit Pixel-Art-Schmiede rechts, Pixel-Ecken, Schaublöcke, keine Eyebrows, Hero-Rahmen auf Ultrawide. Vor jeder Änderung an landing.tsx oder am Hero-CSS lesen."
tags: ["stats","ui","konvention","stolperfalle"]
updated: "2026-11-15T09:45:48.432Z"
---

# Website-Startseite: Vorgaben des Besitzers

Ergänzt den Eintrag `statistik-dienst-services-stats-forge-stats-vanturis-de-cool` (Aufbau, Tokens, Deploy). Hier steht nur, was der Besitzer zur Startseite (`services/stats/src/components/landing.tsx`, `src/app/pages.css`) entschieden hat. Wo sich beide Einträge widersprechen, gilt dieser. **Der andere Eintrag beschreibt den Hero noch mit geneigtem App-Fenster (`.hero-inner`, `.hero-shot`, Neigung per Mauszeiger): das gibt es seit dem Abend des 2026-11-14 nicht mehr.**

## Abgelehnt (nicht wieder versuchen)
- **Eyebrows**: kleine Versal-Zeilen über Überschriften, auch mit orangem Quadrat davor. „Finde ich scheiße und sind übel KI-like, lass die weg.“ Sie sind auf der ganzen Website entfernt (Startseite und `/stats`); die Klasse `.eyebrow`, der Baustein `Eyebrow` und die Texte `landing.eyebrow`, `stats.eyebrow` gibt es nicht mehr. Auch aus Bildvorlagen nicht übernehmen (die Skizze zum Schmiede-Hero zeigte wieder eine, sie wurde bewusst weggelassen).
- **Hero mit Text rechts neben dem Titel und großem flachem App-Fenster darunter** („Bühne“): „sieht extrem fehlplatziert aus“, „Bild viel zu groß“.
- **Banner/Social Preview mit App-Screenshot** statt Icon (siehe Eintrag zum Branding).
- **Bild und Pixel-Ecken am Fensterrand auf Ultrawide** (2026-11-15): „Auf Ultrawide sieht oben der Bereich scheiße aus, weil das Bild und dieses Pixelding in der Ecke scheiße platziert ist.“ Siehe Abschnitt „Breite Bildschirme“.

## Gewünscht
- Schwebende Kopfzeile als Pill bleibt.
- **Hero mit Schmiede-Bild (seit 2026-11-14 abends):** links Titel, Lead, zwei Buttons, drei Fakten-Badges. Rechts das Pixel-Art-Bild des Besitzers (dunkle Schmiede mit Amboss, Schild „Code / Build / Sync“, Banner, Esse) als Hintergrund der rechten Hälfte. Vorlage war eine Skizze des Besitzers. Umsetzung: `.hero-art` in `pages.css`, absolut rechts, 72px nach oben hinter die Kopfzeile, per CSS-Maske nach links und nach unten ausgeblendet (keine Kante, kein Rahmen, keine Karte). Bis 1080px steht das Bild unter dem Text über die volle Breite, oben und unten ausgeblendet. Assets `src/assets/smithy-960.webp` und `smithy-1536.webp` (Quelle 1536 x 1024), `<img>` mit `srcSet` und `fetchPriority="high"`, `alt=""` und `aria-hidden`. Der Hero hat eine Mindesthöhe (`clamp(460px, 37vw, 640px)`). Unter dem Hero eine feine Linie über die volle Fensterbreite.
- Die `app-{de,en}-*.webp` braucht die Startseite nicht mehr; `app-{de,en}-1600` nutzen weiter `src/lib/seo.ts` und `scripts/og-images.mjs`.
- **Pixel-Art als Akzent** (Beispielbild des Besitzers): Cluster oranger Quadrate in den unteren Ecken des Hero und in einer Ecke jedes Schaublocks. Baustein `components/pixels.tsx`: `Pixels` zeichnet ein SVG aus Zeilen von Ziffern (1 bis 4 = schwach bis volles Orange), `STEPS` ist die Treppe, `flip` spiegelt sie. Unter 1080px ausgeblendet. Der rechte Cluster liegt auf dem auslaufenden Boden des Schmiede-Bilds; ob er bleiben soll, ist nicht entschieden. Ein grob gepixelter Amboss als eigener Baustein sah schlecht aus und wurde verworfen.
- **Überschrift über den Funktionskarten** („Alles für deinen AI-Workflow.“), linksbündig; Icons der Karten frei stehend und größer (`.features-plain`), ohne runden Icon-Kreis.
- **Schaublöcke mit eigenen Grafiken** (`.showcase`, abwechselnd Grafik links/rechts mit `.showcase-flip`): eine kleine nachgebaute Fläche der App (`.mock`), die unten aus der Karte läuft, daneben Titel und zwei Sätze. Bisher: Git (Commit-Liste mit farbigen Punkten) und parallele Agenten (Branches mit Zustand als Punkt und Text). Weitere Blöcke nach demselben Muster sind erwünscht („mehr Grafiken“).
- Texte der Blöcke in `messages.ts` unter `landing.showcase` und `landing.featuresTitle`, Deutsch und Englisch. Nur beschreiben, was FORGE wirklich kann.
- Fußzeile: einzeilig in jeder Sprache, Links rechts (die längeren englischen Links brachen sonst um und standen links).

## Breite Bildschirme (Ultrawide, seit 2026-11-15)
Regel: **Im Hero richtet sich nichts am Fensterrand aus, sobald das Fenster breiter ist als der Hero-Rahmen.** Nur die Linie unter dem Hero geht über die volle Breite.
- `.hero` definiert `--hero-frame` (`--page-width` + 720px = 1920px) und `--hero-inset` (`max(0px, (100% - Rahmen) / 2)`). Bild (`right`) und beide Pixel-Ecken (`left`/`right`) nutzen `--hero-inset`: bis 1920px ist das 0, also der Fensterrand; darüber steht der Rahmen mittig um die Textspalte.
- Bildbreite `min(62vw, 62 % des Rahmens)` (höchstens 1190px). Über 1920px blendet eine dritte Masken-Ebene das Bild nach rechts aus; die Länge wächst mit dem Fenster (`clamp(0px, 100vw - Rahmen, 280px)`), dadurch gibt es keinen Sprung an der Schwelle.
- Bewusst 1920 und nicht schmaler: bei 1920px sah die alte Anordnung gut aus und bleibt pixelgleich. Wer den Rahmen ändert, ändert das Bild auf dem häufigsten Desktop-Format.
- Neue Hero-Elemente mit `position: absolute` ebenfalls über `--hero-inset` setzen, nicht mit `0`.
- Schaublöcke, Schlussblock, `/stats` und `/changelog` liegen im `.container` und sind nicht betroffen (dort gibt es weder Bild noch Hero-Pixel).

## Prüfen
1440x900, 1100 und 390 px, dazu 1920, 2560 und 3440 px, Deutsch und Englisch. `preview_screenshot` geht bis 2560px Breite und legt 390px richtig aus. Für 3440px: `chrome.exe --headless=new --hide-scrollbars --window-size=3440,1440 --virtual-time-budget=8000 --user-data-dir=<temp> --screenshot=<datei.png> http://localhost:<port>/de` über das PowerShell-Werkzeug (aus Git Bash gestartet endet Chrome mit Code 13). Alt gegen neu vergleichen: dieselbe Aufnahme mit altem und neuem CSS, die PNG-Dateien sind bei gleichem Bild bytegleich (MD5). Dev-Server der Website läuft ohne Datenbank, für die Startseite reicht das; in einem Agenten-Worktree vorher `pnpm install --ignore-workspace --frozen-lockfile` in `services/stats` und `pnpm exec next dev -p <eigener Port>`.
