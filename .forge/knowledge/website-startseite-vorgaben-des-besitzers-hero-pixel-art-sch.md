---
title: "Website-Startseite: Vorgaben des Besitzers (Hero mit Schmiede-Bild, Pixel-Art, Schaublöcke, keine Eyebrows, Ultrawide)"
summary: "Was der Besitzer für die Startseite von forge.vanturis.de festgelegt und abgelehnt hat: Hero mit Pixel-Art-Schmiede rechts, Pixel-Ecken, Schaublöcke, keine Eyebrows, Hero als eigene Fläche über 1920 px. Vor jeder Änderung an landing.tsx oder am Hero-CSS lesen."
tags: ["stats","ui","konvention","stolperfalle"]
updated: "2026-11-15T10:48:30.427Z"
---

# Website-Startseite: Vorgaben des Besitzers

Ergänzt den Eintrag `statistik-dienst-services-stats-forge-stats-vanturis-de-cool` (Aufbau, Tokens, Deploy). Hier steht nur, was der Besitzer zur Startseite (`services/stats/src/components/landing.tsx`, `src/app/pages.css`) entschieden hat. Wo sich beide Einträge widersprechen, gilt dieser. **Der andere Eintrag beschreibt den Hero noch mit geneigtem App-Fenster (`.hero-inner`, `.hero-shot`, Neigung per Mauszeiger): das gibt es seit dem Abend des 2026-11-14 nicht mehr.**

## Abgelehnt (nicht wieder versuchen)
- **Eyebrows**: kleine Versal-Zeilen über Überschriften, auch mit orangem Quadrat davor. „Finde ich scheiße und sind übel KI-like, lass die weg.“ Sie sind auf der ganzen Website entfernt (Startseite und `/stats`); die Klasse `.eyebrow`, der Baustein `Eyebrow` und die Texte `landing.eyebrow`, `stats.eyebrow` gibt es nicht mehr. Auch aus Bildvorlagen nicht übernehmen.
- **Hero mit Text rechts neben dem Titel und großem flachem App-Fenster darunter** („Bühne“): „sieht extrem fehlplatziert aus“, „Bild viel zu groß“.
- **Banner/Social Preview mit App-Screenshot** statt Icon (siehe Eintrag zum Branding).
- **Auf Ultrawide: Bild und Pixel-Ecken am Fensterrand** (2026-11-15, erster Anlauf): „scheiße platziert“.
- **Auf Ultrawide: Bild und Pixel-Ecken an einem unsichtbaren, zentrierten Rahmen von 1920 px** (2026-11-15, zweiter Anlauf, war kurz live): „Das sieht so scheiße aus.“ Das Bild hing als Rechteck mit weichem rechten Rand mitten im Raum, die Pixel-Ecken standen frei auf der Linie, links blieb ein Drittel leer. Lehre: Was auf Ultrawide keinen sichtbaren Halt hat, wirkt verloren. Nicht mit Masken und Versatz nachbessern.

## Gewünscht
- Schwebende Kopfzeile als Pill bleibt.
- **Hero mit Schmiede-Bild (seit 2026-11-14 abends):** links Titel, Lead, zwei Buttons, drei Fakten-Badges. Rechts das Pixel-Art-Bild des Besitzers (dunkle Schmiede mit Amboss, Schild „Code / Build / Sync“, Banner, Esse). Umsetzung bis 1920 px: `.hero-art` in `pages.css`, absolut rechts am Fensterrand, 62vw breit, 72px nach oben hinter die Kopfzeile, per CSS-Maske nach links und nach unten ausgeblendet (keine Kante, kein Rahmen). Bis 1080px steht das Bild unter dem Text über die volle Breite. Assets `src/assets/smithy-960.webp` und `smithy-1536.webp` (Quelle 1536 x 1024). Mindesthöhe `clamp(460px, 37vw, 640px)`. Unter dem Hero eine feine Linie über die volle Fensterbreite.
- **Pixel-Art als Akzent**: Cluster oranger Quadrate in den unteren Ecken des Hero und in einer Ecke jedes Schaublocks. Baustein `components/pixels.tsx` (`Pixels`, `STEPS`, `flip`). Unter 1080px ausgeblendet. Ein grob gepixelter Amboss als eigener Baustein sah schlecht aus und wurde verworfen.
- **Überschrift über den Funktionskarten** („Alles für deinen AI-Workflow.“), linksbündig; Icons der Karten frei stehend (`.features-plain`).
- **Schaublöcke mit eigenen Grafiken** (`.showcase`, abwechselnd mit `.showcase-flip`): eine kleine nachgebaute Fläche der App (`.mock`), daneben Titel und zwei Sätze. Bisher Git und parallele Agenten. Weitere Blöcke nach demselben Muster sind erwünscht.
- Texte der Blöcke in `messages.ts` unter `landing.showcase` und `landing.featuresTitle`, Deutsch und Englisch. Nur beschreiben, was FORGE wirklich kann.
- Fußzeile: einzeilig in jeder Sprache, Links rechts.

## Breite Bildschirme (über 1920 px, seit 2026-11-15, dritter Anlauf)
Der Besitzer nutzt 3440 px. Auftrag nach zwei abgelehnten Versuchen: „passe das an, dass es einfach schöner aussieht, lass dir was einfallen“.
- **Lösung:** Ab 1921 px ist der Hero eine eigene Fläche wie die Schaublöcke (`@media (min-width: 1921px)` in `pages.css` direkt hinter `.hero-art img`): Breite Seitenspalte plus 88 px je Seite (1440 px), `--radius-card`, Rahmen, `--color-surface`, `--shadow-raised`, die warme Linie der Schaublöcke am unteren Rand, 20 px Abstand zur Kopfzeile. Das Bild füllt die rechten 60 % bis an die runde Kante und läuft nicht mehr hinter die Kopfzeile, die Pixel-Ecken sitzen in den unteren Ecken der Fläche. Der Text bleibt bündig mit Kopfzeile und Funktionskarten, weil `.container` in der Fläche zentriert ist.
- Das Bild ist dort fast unbeschnitten (864 x 620 bei 3:2). Die Maske zum Text hin ist in der Fläche gestuft statt linear: Auf der helleren Fläche zeigt ein linearer Verlauf, wo das Bild anfängt.
- **Bis 1920 px ist nichts geändert** (bytegleich geprüft bei 1920 und 1440 px). Die früheren Variablen `--hero-frame` und `--hero-inset` gibt es nicht mehr.
- Ob dem Besitzer die Fläche gefällt, ist noch nicht bestätigt (Stand 2026-11-15).

## Prüfen
1440x900, 1100 und 390 px, dazu 1920, 1921, 2560 und 3440 px, Deutsch und Englisch. `preview_screenshot` geht bis 2560px Breite und verkleinert das Bild auf 1568 px. Für 3440px und für Aufnahmen in voller Auflösung: `Start-Process chrome.exe -ArgumentList "--headless=new","--hide-scrollbars","--window-size=3440,1440","--virtual-time-budget=8000","--user-data-dir=<temp>","--screenshot=<datei.png>","http://localhost:<port>/de" -Wait` über das PowerShell-Werkzeug (aus Git Bash gestartet endet Chrome mit Code 13). Alt gegen neu vergleichen: `git stash push -- <css>`, aufnehmen, `git stash pop`, neu aufnehmen, MD5 der PNG-Dateien vergleichen (bei gleichem Bild bytegleich). Dev-Server der Website läuft ohne Datenbank, für die Startseite reicht das: `pnpm exec next dev -p <eigener Port>` in `services/stats`, Adresse `http://localhost:<port>`.
