---
title: "Live Stats: Download-Zählung ohne Updates, Stundenverlauf, GitHub-Fakten (download_assets, activity_hours)"
summary: "Wie die Website Downloads zählt (nur neue Installationen, keine Updates), woher Stunden- und Projektzahlen kommen und welche Fallen es bei GitHub-Zahlen und beim lokalen Prüfen gibt; nötig vor Änderungen an /stats, am Download-Badge oder an neuen Karten."
tags: ["stats","stolperfalle","github","tests"]
updated: "2026-11-15T08:37:46.539Z"
---

# Live Stats: Downloads, Stundenverlauf, GitHub-Fakten (Stand 2026-11-15)

Ergänzt `statistik-dienst-services-stats-forge-stats-vanturis-de-cool`. Einzelheiten zu API und Tabellen stehen in `services/stats/README.md` (Abschnitt Downloads).

## Downloads: was zählt und warum
Auslöser: Der Besitzer vermutete zu Recht, dass die Download-Zahl Updates mitzählt. Bis 2026-11-15 summierte das Badge `*_x64-setup.exe` über alle Releases plus 32 aus gelöschten Releases (zusammen 44). Den vollen Installer laden aber auch installierte Apps (Update bei Runtime-Wechsel, Reparatur) und FORGE Setup selbst.

Jetzt gilt (`src/lib/downloads.ts`): Download = ein Mensch lädt einen Installer für eine neue Installation.
- `windows`: GitHub-Zähler von `FORGE-Setup.exe` (Release `installer`). Nur Menschen laden die Datei.
- `macos`, `linux`: Klicks auf die Dateien der Download-Seite über `/dl/<key>` (zählt und leitet zu GitHub weiter).
- `script`: Abruf von `/install.sh` mit curl oder wget.

Die alte Zahl ist bewusst nicht übernommen (nicht in Erstinstallationen und Updates trennbar). Der Besitzer wurde darauf hingewiesen, dass die Zahl dadurch von 44 auf etwa 18 fällt.

## Fallen bei GitHub-Zahlen
- **Jede Release-Datei hat genau 1 Download von einer Maschine**, direkt nach der Veröffentlichung (auch jede `.dmg`, `.deb`, AppImage, auch Dev-Builds). GitHub-Zähler dieser Dateien deshalb nie als Downloads zeigen.
- **`.app.tar.gz` und AppImage sind zugleich Update-Dateien** von macOS und Linux, und `install.sh` lädt genau diese. GitHub kann Installation und Update dort nicht trennen.
- **`gh release upload --clobber` (setup.yml) ersetzt die Datei, der Zähler beginnt bei 0.** `download_assets` hält deshalb den Höchststand je GitHub-Asset-ID, die Summe ist die Gesamtzahl. Zuwächse landen zusätzlich in `download_days` (Verlauf). Eine beim ersten Blick alte Datei geht nur in die Summe ein, sonst gäbe es am Tag des Deploys einen falschen Ausschlag.
- **`releases/latest` ist nicht die neueste Version**: GitHubs „latest“ bleibt auf dem Release mit vollem Installer (am 2026-11-15: 0.1.135 statt 0.1.183). `project.ts` nimmt die höchste veröffentlichte Version aus der Release-Liste.
- Anonymes Limit der GitHub-API: 60 Anfragen pro Stunde und IP. Der Dienst braucht etwa 12 (Builds alle 15 min, Setup-Zähler und Projektfakten alle 30 min). Kein weiterer Abruf ohne Cache.

## Verlauf und Stunden
- `installs.first_counters` = allererste Meldung einer Installation. Der erste Tag zählt ab dort (vorher fehlte der ganze erste Tag jeder neuen Installation im Verlauf). Alte Installationen haben den Wert nicht, dort gilt die alte Regel.
- `activity_hours` (Tag, UTC-Stunde, Tokens, Durchläufe): `upsertReport` bildet die Differenz zur vorigen Meldung derselben Installation (`reportDelta`). Nur Summen, nichts je Installation. Die Seite verschiebt die Stunden in die Zeitzone des Besuchers (`localHours`, erst nach dem Mounten, sonst Hydration-Fehler).
- Neue App-Zähler `toolCalls`, `commits`, `phoneMs` (App-Seite im Eintrag zur anonymen Nutzungsstatistik). Bis App-Versionen sie senden, stehen sie auf 0; die Karte „Funktionen“ nennt sie „neuer Zähler“.

## Seite
9 Kacheln, 14 Diagrammkarten in `charts.tsx`: Verlauf pro Tag mit Messwert-Auswahl (`DAY_METRICS`), Installationen (aktiv oder gesamt, darunter aktiv in 24 Std./7/30 Tagen), Uhrzeit, Wochentag, Modelle, Token-Arten, Plattformen, Versionen, Abos, Sprachen, Downloads, Projekt, Funktionen, Durchschnitt. `MenuSelect` ist die allgemeine Form des früheren `RangeSelect`. `ChartsSkeleton` muss jede neue Karte in derselben Reihenfolge nachbilden. Achsen ab einer Milliarde über `compact` („40 Mrd.“), sonst läuft „40.000M“ aus der Achse.

## Lokal prüfen
- **`next dev` lädt im Vorschau-Browser in einer Schleife neu**, sobald mehrere Vorschau-Seiten offen waren (jeder Screenshot öffnet eine). Die Seite bleibt im Skeleton, die Konsole zeigt endlos „Fast Refresh rebuilding“. Dabei wird auch der Modul-Cache jedes Mal verworfen, also GitHub bei jedem Laden neu gefragt (Limit!). Abhilfe: `DATABASE_URL=… pnpm exec next build`, dann `pnpm exec next start -p 4100` (Warnung zu standalone ist harmlos) und dort prüfen. Vorher und nachher den Prozess auf Port 4100 beenden.
- Diagramme blenden per IntersectionObserver ein: `preview_interact` mit `wait .charts.in-view`, dann 2,5 s warten, Höhe 2000.
- Der Routentyp `RouteContext<"/dl/[file]">` existiert für tsc erst nach `next dev` oder `next build`.
- DB-Tests: `STATS_TEST_DATABASE_URL=<Test-DB> pnpm exec vitest run` (History, Meldung mit Stundenbuchung, Download-Ledger).
- Demodaten: `installs` (mit `first_counters`), `install_days`, `activity_hours`, `download_days`; danach wieder löschen.
- Bash-Heredocs scheitern in dieser Shell an Apostrophen im Text („unexpected EOF“): Dateien mit Write oder Edit ändern.

## Hero-Bild
Am 2026-11-15 wollte der Besitzer das Hero-Bild so unscharf wie das Bild im Schlussblock. `node scripts/hero-smithy.mjs` rendert `smithy-1536.webp` und `smithy-960.webp` aus `src/assets/smithy-source.webp` (Original, wird nicht eingebunden) mit `SIGMA = 3.8`.

## Fenster ziehen über Kopfzeilen (App)
Gleicher Tag: In der Projektleiste ließ sich Text markieren. Kopfzeilen tragen jetzt `{...windowDrag}` aus `apps/desktop/src/lib/title-bar.ts` (`data-tauri-drag-region="deep"`, ab Tauri 2.12) plus `select-none`: Ziehen verschiebt das Fenster, Buttons und Links nimmt Tauri selbst aus. Der Aktionsbereich von `Page` ist mit `data-tauri-drag-region="false"` ausgenommen. Im echten Fenster nicht getestet (nur Typen und Tests).
