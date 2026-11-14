---
title: "Website-Startseite: Vorgaben des Besitzers (Hero mit Schmiede-Bild, Pixel-Art, Schaublöcke, keine Eyebrows)"
summary: "Was der Besitzer am 2026-11-14 für die Startseite von forge.vanturis.de festgelegt und abgelehnt hat: Hero mit Pixel-Art-Schmiede als Hintergrund rechts, Pixel-Art, Schaublöcke mit Grafiken, keine Eyebrows. Vor jeder Änderung an landing.tsx lesen."
tags: ["stats","ui","konvention","stolperfalle"]
updated: "2026-11-14T22:22:23.856Z"
---

# Website-Startseite: Vorgaben des Besitzers

Ergänzt den Eintrag `statistik-dienst-services-stats-forge-stats-vanturis-de-cool` (Aufbau, Tokens, Deploy). Hier steht nur, was der Besitzer am 2026-11-14 zur Startseite (`services/stats/src/components/landing.tsx`, `pages.css`) entschieden hat. Wo sich beide Einträge widersprechen, gilt dieser. **Der andere Eintrag beschreibt den Hero noch mit geneigtem App-Fenster (`.hero-inner`, `.hero-shot`, `tilt.tsx`): das gibt es seit dem Abend des 2026-11-14 nicht mehr.**

## Abgelehnt (nicht wieder versuchen)
- **Eyebrows**: kleine Versal-Zeilen über Überschriften, auch mit orangem Quadrat davor. „Finde ich scheiße und sind übel KI-like, lass die weg.“ Sie sind auf der ganzen Website entfernt (Startseite und `/stats`); die Klasse `.eyebrow`, der Baustein `Eyebrow` und die Texte `landing.eyebrow`, `stats.eyebrow` gibt es nicht mehr. Auch aus Bildvorlagen nicht übernehmen (die Skizze zum Schmiede-Hero zeigte wieder eine, sie wurde bewusst weggelassen).
- **Hero mit Text rechts neben dem Titel und großem flachem App-Fenster darunter** („Bühne“): „sieht extrem fehlplatziert aus“, „Bild viel zu groß“.
- **Banner/Social Preview mit App-Screenshot** statt Icon (siehe Eintrag zum Branding).

## Gewünscht
- Schwebende Kopfzeile als Pill bleibt.
- **Hero mit Schmiede-Bild (seit 2026-11-14 abends):** links Titel, Lead, zwei Buttons, drei Fakten-Badges. Rechts kein App-Screenshot mehr, sondern das Pixel-Art-Bild des Besitzers (dunkle Schmiede mit Amboss, Schild „Code / Build / Sync“, Banner, Esse) als Hintergrund der rechten Hälfte. Vorlage war eine Skizze des Besitzers. Umsetzung: `.hero-art` in `pages.css`, absolut rechts, bis an den rechten Fensterrand und 72px nach oben hinter die Kopfzeile, per CSS-Maske nach links und nach unten ausgeblendet (keine Kante, kein Rahmen, keine Karte), Breite `min(62vw, 1240px)`. Bis 1080px steht das Bild unter dem Text über die volle Breite, oben und unten ausgeblendet. Assets `src/assets/smithy-960.webp` und `smithy-1536.webp` (Quelle 1536 x 1024), `<img>` mit `srcSet` und `fetchPriority="high"`, `alt=""` und `aria-hidden`. Der Hero hat eine Mindesthöhe (`clamp(460px, 37vw, 640px)`). Unter dem Hero eine feine Linie.
- Die `app-{de,en}-*.webp` braucht die Startseite nicht mehr; `app-{de,en}-1600` nutzen weiter `src/lib/seo.ts` und `scripts/og-images.mjs`.
- **Pixel-Art als Akzent** (Beispielbild des Besitzers): Cluster oranger Quadrate in den unteren Ecken des Hero und in einer Ecke jedes Schaublocks. Baustein `components/pixels.tsx`: `Pixels` zeichnet ein SVG aus Zeilen von Ziffern (1 bis 4 = schwach bis volles Orange), `STEPS` ist die Treppe, `flip` spiegelt sie. Unter 1080px ausgeblendet. Der rechte Cluster liegt jetzt auf dem auslaufenden Boden des Schmiede-Bilds; ob er bleiben soll, ist nicht entschieden. Ein grob gepixelter Amboss als eigener Baustein sah schlecht aus und wurde verworfen.
- **Überschrift über den Funktionskarten** („Alles für deinen AI-Workflow.“), linksbündig; Icons der Karten frei stehend und größer (`.features-plain`), ohne runden Icon-Kreis.
- **Schaublöcke mit eigenen Grafiken** (`.showcase`, abwechselnd Grafik links/rechts mit `.showcase-flip`): eine kleine nachgebaute Fläche der App (`.mock`), die unten aus der Karte läuft, daneben Titel und zwei Sätze. Bisher: Git (Commit-Liste mit farbigen Punkten) und parallele Agenten (Branches mit Zustand als Punkt und Text). Weitere Blöcke nach demselben Muster sind erwünscht („mehr Grafiken“).
- Texte der Blöcke in `messages.ts` unter `landing.showcase` und `landing.featuresTitle`, Deutsch und Englisch. Nur beschreiben, was FORGE wirklich kann.
- Fußzeile: einzeilig in jeder Sprache, Links rechts (die längeren englischen Links brachen sonst um und standen links).

## Prüfen
1440x900, 1100 und 390 px, Deutsch und Englisch. Headless-Chrome legt Fenster unter etwa 500px nicht schmaler aus: schmale Ansichten über ein iframe in der gewünschten Breite aufnehmen. Dev-Server der Website läuft ohne Datenbank, für die Startseite reicht das.
