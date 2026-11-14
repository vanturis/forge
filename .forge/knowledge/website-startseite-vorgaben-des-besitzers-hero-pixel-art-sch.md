---
title: "Website-Startseite: Vorgaben des Besitzers (Hero, Pixel-Art, Schaublöcke, keine Eyebrows)"
summary: "Was der Besitzer am 2026-11-14 für die Startseite von forge.vanturis.de festgelegt und abgelehnt hat: Hero-Anordnung, Pixel-Art, Schaublöcke mit Grafiken, keine Eyebrows. Vor jeder Änderung an landing.tsx lesen."
tags: ["stats","ui","konvention","stolperfalle"]
updated: "2026-11-14T20:01:03.399Z"
---

# Website-Startseite: Vorgaben des Besitzers

Ergänzt den Eintrag `statistik-dienst-services-stats-forge-stats-vanturis-de-cool` (Aufbau, Tokens, Deploy). Hier steht nur, was der Besitzer am 2026-11-14 zur Startseite (`services/stats/src/components/landing.tsx`, `pages.css`) entschieden hat. Wo sich beide Einträge widersprechen, gilt dieser.

## Abgelehnt (nicht wieder versuchen)
- **Eyebrows**: kleine Versal-Zeilen über Überschriften, auch mit orangem Quadrat davor. „Finde ich scheiße und sind übel KI-like, lass die weg.“ Sie sind auf der ganzen Website entfernt (Startseite und `/stats`); die Klasse `.eyebrow`, der Baustein `Eyebrow` und die Texte `landing.eyebrow`, `stats.eyebrow` gibt es nicht mehr. Auch aus Bildvorlagen nicht übernehmen.
- **Hero mit Text rechts neben dem Titel und großem flachem App-Fenster darunter** („Bühne“): „sieht extrem fehlplatziert aus“, „Bild viel zu groß“.
- **Banner/Social Preview mit App-Screenshot** statt Icon (siehe Eintrag zum Branding).

## Gewünscht
- Schwebende Kopfzeile als Pill bleibt.
- **Hero zweispaltig:** links Titel, Lead, zwei Buttons, drei Fakten-Badges; rechts das App-Fenster, geneigt und dem Mauszeiger folgend (`tilt.tsx`). Unter dem Hero eine feine Linie.
- **Pixel-Art als Akzent** (Beispielbild des Besitzers): Cluster oranger Quadrate in den unteren Ecken des Hero und in einer Ecke jedes Schaublocks. Baustein `components/pixels.tsx`: `Pixels` zeichnet ein SVG aus Zeilen von Ziffern (1 bis 4 = schwach bis volles Orange), `STEPS` ist die Treppe, `flip` spiegelt sie. Unter 1080px ausgeblendet. Ein grob gepixelter Amboss sah schlecht aus und wurde verworfen; wenn ein Logo in Pixeln gewünscht ist, sauber aus der Bildmarke ableiten.
- **Überschrift über den Funktionskarten** („Alles für deinen AI-Workflow.“), linksbündig; Icons der Karten frei stehend und größer (`.features-plain`), ohne runden Icon-Kreis.
- **Schaublöcke mit eigenen Grafiken** (`.showcase`, abwechselnd Grafik links/rechts mit `.showcase-flip`): eine kleine nachgebaute Fläche der App (`.mock`), die unten aus der Karte läuft, daneben Titel und zwei Sätze. Bisher: Git (Commit-Liste mit farbigen Punkten) und parallele Agenten (Branches mit Zustand als Punkt und Text). Weitere Blöcke nach demselben Muster sind erwünscht („mehr Grafiken“).
- Texte der Blöcke in `messages.ts` unter `landing.showcase` und `landing.featuresTitle`, Deutsch und Englisch. Nur beschreiben, was FORGE wirklich kann.
- Fußzeile: einzeilig in jeder Sprache, Links rechts (die längeren englischen Links brachen sonst um und standen links).

## Prüfen
1440x900, 1100 und 375 px, Deutsch und Englisch. „Entwicklungszentrale“ ist ein Wort und darf das App-Fenster nicht berühren.
