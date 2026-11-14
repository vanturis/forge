---
title: "Website und Statistik-Dienst services/stats (forge.vanturis.de: Landingpage auf /, Live Stats auf /stats, Coolify)"
summary: "Next.js-Website in services/stats: Formensprache im Cento-Stil, seit 2026-11-14 neutrale Grautöne und sparsames Orange (seriöser Auftritt), Landingpage, Live Stats, Spenden-Dialog, Englisch/Deutsch, mobile Ansicht, Coolify, Stolperfallen."
tags: ["stats","coolify","release","stolperfalle","i18n","ui"]
updated: "2026-11-14T17:00:14.095Z"
---

# Website und Statistik-Dienst services/stats

## Was es ist
`services/stats` ist ein eigenständiges Next.js-Projekt (App Router, pg, zod) für https://forge.vanturis.de. Es nimmt die Meldungen von `packages/sidecar/src/stats/usage-stats.ts` an (`USAGE_STATS_URL` in `packages/protocol/src/`) und zeigt die Summen. API, Payload und Coolify stehen in `services/stats/README.md`. Deploy in Coolify geschieht nicht automatisch beim Push; „die Website soll so bleiben“ heißt: nicht in Coolify ausrollen. Der Release-Workflow der App ignoriert `services/`.

Seit 2026-10-22 läuft im selben Prozess auch der **Crew-Relay** unter `/crew` (Routen `src/app/crew/...`, Kern `src/lib/crew-relay.ts`, ohne Datenbank, nur im Speicher). Details im Eintrag zur Crew-Live-Zusammenarbeit. Die FORGE-App erreicht Crews erst, wenn diese Version der Website in Coolify ausgerollt ist.

## Gestaltung
Zwei Schritte am 2026-11-14, beide auf Wunsch des Besitzers:
1. **Formen im Cento-Stil** (rundlich, große runde Flächen, Pill-Navigation). Das ersetzt die frühere Arbeitsweise „GENAU nach Bildvorlage 1536 x 1024“.
2. **Seriöser Auftritt.** Rückmeldung nach Schritt 1: „Das Blau im Hintergrund ist so verspielt. Es soll viel seriöser und weniger verspielt aussehen.“ Die Formen blieben, geändert wurden Farbe und Auftreten.

### Farben: neutrale Grautöne (dieselben Werte wie in der App)
Tokens in `src/app/globals.css`: `--color-bg #111112`, `--color-backdrop #0b0b0c` (nur `/crew`), `--color-surface #19191a`, `-surface-2 #202022`, `-surface-3 #29292b`, `--color-border #2c2c2f`, `-border-strong #3f3f43`, `--color-fg #ececee`, `-fg-soft #adadb2`, `--color-muted #a3a3a8`, `--color-subtle #73737a`. Orange, Rot und Grün unverändert. Das frühere blaustichige Anthrazit (`#111418`, `#1a1e25`, `#e5e7eb` usw.) darf nirgends mehr auftauchen; `themeColor` in `layout.tsx`, `manifest.ts` und `scripts/og-images.mjs` tragen die Werte als Literal und müssen bei einer Änderung mitgezogen werden.

### Orange sparsam
Orange nur für: die Primäraktion (Download, `.btn-primary`), das eine Akzentwort im Titel, kleine Icons und Daten (Sparklines, Diagramme, Balken). Keine orangefarbenen Flächen, Verläufe oder Glows als Dekoration.
- `.icon-tile`: neutraler Kreis (`--color-surface-2` mit feinem Rahmen), Icon orange.
- Aktiver Punkt der Kopfzeile, Tabs der Download-Seite und Tabs in `/crew`: neutrale Pill (`--color-surface-3`), nur das Icon orange. So bleibt Download der einzige gefüllte orange Button der Kopfzeile. Die Crew-Liste in der Seitenleiste von `/crew` ist weiter eine gefüllte orange Pill (wie die Hauptnavigation der App).
- Badge „neueste“, Beitrittsanfrage in `/crew`, Betrag im Spenden-Dialog: neutral.
- `.btn-primary:disabled` ist eine neutrale Fläche. Abgeblendetes Orange wird auf dem dunklen Grund braun.
- Badges unter dem Hero: feiner Rahmen, keine Füllung.

### Hintergrundbild
- Hinter der Seite liegt **kein Bild mehr**: flache Fläche `--color-bg` (das frühere `body::before` mit Blur ist entfernt).
- `src/assets/background.webp` ist die Vorlage des Besitzers (blaustichig) und wird von der Seite nicht mehr geladen. Daraus erzeugt `node scripts/background-neutral.mjs` die Datei `background-neutral.webp`: Blaustich herausgerechnet (Pixel mit Rot deutlich über Blau behalten ihre Farbe, alles andere wird grau), volle Auflösung 2752 x 1536, WebP Qualität 95.
- Das graue Bild liegt nur in der Bühne der Startseite (`.hero-stage`) und im Schlussblock (`.closing`), abgeblendet über `--stage-dim` an `.landing` (62 % `--color-bg`, im Schlussblock 70 % außen und 92 % in der Mitte). Es soll wie eine ruhige Textur wirken; heller stellen macht es wieder zum Wallpaper.
- Das App-Fenster ist nur der Screenshot in einem feinen Rahmen. Die Titelleiste mit drei Punkten ist entfernt.
- `scripts/og-images.mjs` nutzt das graue Bild ohne Blur mit dunklem Verlauf (94 % links bis 62 % rechts), kein oranger Schein hinter dem Screenshot, Adresse in Grau. Nach neuen Screenshots ausführen (überschreibt `og-{de,en}.png`).

### Bausteine und Typografie
- Gemeinsame Formensprache mit der Desktop-App (Tokens in `globals.css`): Radien 4/6/10/14/18/24/9999 px, `--shadow-solid` (gefüllte Buttons), `--shadow-raised` (Karten), `--shadow-overlay` (Dialog, Menü, Kopfzeile), Bewegung 120/200/300 ms, nur opacity und transform.
- `.btn` sind Pills (`-primary`, `-secondary`, `-outline`, `-sm`, `-lg`). `.eyebrow` klein, versal, 0.08em, gedämpft.
- Titel kräftig, aber nicht übergroß: Hero `clamp(40px, 4.4vw, 58px)`, Live Stats `clamp(36px, 4.2vw, 52px)`, Schlussblock `clamp(28px, 3.2vw, 40px)`, Download `clamp(32px, 3.8vw, 44px)`, Laufweite -0.03em.
- Kopfzeile: schwebende Pill, sticky mit 12px Abstand. Bis 900px zeigen Live Stats, GitHub und Unterstützen nur Icons, bis 560px auch Download. Fußzeile: runde Fläche mit Sprachumschalter.

## Landingpage (`landing.tsx`, `pages.css`)
- Hero: Titel links, rechts Lead, zwei Buttons und drei Fakten als Badges. Das Spaltenverhältnis 1.3fr/0.9fr ist an „Entwicklungszentrale“ gemessen (ein Wort, bricht nicht um): bei Textänderung bei 1100 und 1440 px prüfen. Unter 1080px einspaltig; bis 560px ist der Titel `clamp(28px, 9vw, 42px)`, damit das Wort bei 360px noch passt.
- Screenshot in vier Breiten (`app-{de,en}-{800,1200,1600,2400}.webp`, aufgenommen 2400x1680, mit sharp lanczos3 verkleinert), `sizes="(max-width: 1264px) 90vw, 1072px"`. Neue Screenshots: alle vier Breiten und danach die OG-Bilder neu erzeugen.
- Danach vier Funktionskarten (`Feature`), FAQ einspaltig (`.faq-item`, details/summary) und der Schlussblock mit Download und Live Stats (nutzt `download.title`, `download.lead`).

## Mobile Ansicht (bis 560px)
Breakpoints: 1320, 1080, 900, 560 px. Bis 560px: Hero-Buttons gleich breit untereinander; Funktionskarten kompakt mit Icon links; Statistik-Karten einspaltig (lange Zahlen laufen sonst über); Zeitraum-Auswahl unter dem Diagrammtitel; Anteile (`.share`) mit Name und Prozent in einer Zeile und Balken darunter.
- **Stolperfalle:** Der Spenden-Dialog (`SupportButton`) liegt im DOM innerhalb von `.topbar-nav`. Regeln wie `.topbar-nav .btn` treffen auch seine Buttons; deshalb `.topbar-nav > .btn`.
- Prüfen bei 360, 375, 390 px, Englisch und Deutsch, Dialog offen. Die Diagramme blenden per IntersectionObserver ein: für fullPage-Screenshots Höhe 2000 setzen. preview_screenshot rendert mit Pixeldichte 1.

## Spenden-Dialog (`components/donations.tsx`, Styles in `globals.css`)
Herz im Icon-Kreis + Titel, ein Satz, Fläche „Bisher gespendet“, Buttons „Beitrag über Stripe“ (primär) und „Idee oder Fehler melden“ (sekundär), eine Zeile Hinweis. Betrag aus Stripe (`STRIPE_SECRET_KEY` nur auf dem Live-Server); `next dev` ohne Schlüssel holt ihn von `https://forge.vanturis.de/api/v1/donations`.

## Live Stats (/stats)
`stats-page.tsx`, `live-stats.tsx`, `charts.tsx`, `tiles.ts`.
- Sechs Karten im 3er-Raster (Tokens, Sessions, Durchläufe, Arbeitszeit, Kosten, Gerade online), rechts 7 Mini-Balken (`Spark`).
- Acht Diagrammkarten im 2er-Raster: Tokens pro Tag, Aktive Installationen (je `RangeSelect`, kein `<select>`), Top Modelle, Plattformen (Ring), Versionen (Marke „neueste“ über `newestVersion`), Claude-Abos (`planName`, null = „Unbekannt“ als letzte Zeile), Sprachen (`Intl.DisplayNames`), Funktionen. Gemeinsame Bausteine: `ShareList`, `topRows`, `withUnknown`.
- Skeletons: `StatsPage` mit `state: loading` nutzt dieselben Bausteine, dadurch gleiche Höhen. Platzhalter-Balken brauchen `.col-bar.skeleton-bar`/`.share-fill.skeleton-bar`, sonst gewinnt das Orange der Balken.
- Daten: `history` (30 Tage); `versions`, `plans`, `platforms`, `languages` über aktive Installationen der letzten 30 Tage.

## Crew im Browser (/crew), Gestaltung
App-Ansicht statt Website: `crew.css` blendet per `body:has(.crew-page)` Kopf- und Fußzeile aus und setzt `--color-backdrop`. `components/crew-web/app.tsx` rendert `Shell`: Seitenleiste und Hauptfläche als zwei runde Flächen mit 10px Abstand. Unter 900px liegt die Seitenleiste oben. Leute, Chat und Aufgaben stehen ab 1280px nebeneinander, darunter Tabs. Die `.fc-*`-Regeln sind ein Nachbau des FORGE-Chats: nach einem Umbau des App-Chats dort nachziehen. Eigene Farbwerte in `crew.css` sind nur Claude-Orange, Warnung und Diff-Töne, kein Grau.
- Zum Ansehen ohne zweite FORGE-Installation: eine temporäre Client-Seite (z. B. `src/app/crew-demo/page.tsx`), die einen `WebCrewRecord` in `localStorage` schreibt (`forge.crew.web` = Liste der IDs, `forge.crew.web.<id>` = Datensatz mit `membership: "member"`, Mitgliedern mit `presence`, `feed`, `tasks`, `requests`; `lastSeen` in der Zukunft hält Mitglieder online; Schlüssel dürfen Platzhalter sein) und nach `/crew` weiterleitet. Danach löschen.

## Erfasste Felder
Meldung: Installations-ID, `appVersion`, `os`, Zähler (`COUNTER_KEYS` in `src/lib/report.ts`), `models`, `plan`, `language` (`^[a-z]{2}$`). Der Besitzer will alles Sinnvolle sehen, aber nichts, was Nutzer ausspäht (keine Inhalte, Namen, Pfade). Neues Feld: Checkliste im Eintrag zur anonymen Nutzungsstatistik. Ein alter Dienst ignoriert unbekannte Felder (zod strippt).

## Domain, Intervalle, Verlauf
- `forge.vanturis.de`, vorher `forge-stats.vanturis.de`. Apps bis 0.1.103 melden an die alte Domain: beide Domains am Dienst lassen. Prüfen: `curl https://forge.vanturis.de/api/health` liefert `ok`.
- App meldet alle 5 Minuten, Sperre pro installId 4 Minuten (`REPORT_INTERVAL_MINUTES` in `src/lib/db.ts`), „Gerade online“ = 10 Minuten (`ONLINE_MINUTES`).
- Jede angenommene Meldung schreibt `installs` und den UTC-Tag in `install_days` (FK mit CASCADE). Zuwachs pro Tag rechnet SQL (`historySql()`, LAG); der erste Stand einer Installation zählt nicht als Zuwachs. Test: `STATS_TEST_DATABASE_URL=... pnpm test`.

## Sprachen der Seite
Sprach-URLs `/de` und `/en` (siehe Eintrag zur SEO der Website); `/download` und `/crew` haben keine Sprach-URL (`/de/download` ist 404). `LanguageSwitch` in der Fußzeile und in der Seitenleiste von `/crew`. Texte in `src/lib/messages.ts` (`de` ist Quelle des Typs: Funktionen mit Literal-Rückgabe brauchen `: string`, sonst passt `en` nicht).

## Stolperfallen
- **Nicht im pnpm-Workspace**: `pnpm install --ignore-workspace --frozen-lockfile`, eigenes Lockfile (in einem frischen Agenten-Worktree fehlt `node_modules` der Website, FORGE installiert nur den Root-Workspace). ESLint ignoriert `services/`; Typprüfung mit `pnpm exec tsc --noEmit -p .` im Ordner. Vor dem ersten `next dev` oder `next build` meldet tsc fehlende Typen für Bild-Importe und `RouteContext`.
- **Kein `public/`-Ordner**: Bilder statisch importieren oder per relativer `url()` in globalem CSS.
- Dev-Server: `DATABASE_URL=<Test-DB aus dev_environment> pnpm exec next dev -p 4100` im Hintergrund (der FORGE-Dev-Server des Projekts ist die Desktop-App, nicht diese Seite; die Test-DB vorher mit dev_control starten, ihr Port wechselt beim Start). Summen sind 5 Minuten im Prozess gecacht: nach SQL-Testdaten neu starten. Das Beenden der Shell beendet den Next-Prozess nicht; er hält Port 4100 weiter (Prozess mit `Get-NetTCPConnection -LocalPort 4100` finden und beenden, auch vor `pnpm build`).
- **Vorschau-Browser: `http://localhost:4100`, nicht `127.0.0.1`.** Mit `127.0.0.1` hydriert die Seite im Dev-Modus nicht und `/crew` bleibt im Skeleton hängen.
- `/download` leitet Windows-Besucher direkt zur Setup-Datei auf GitHub um; die Vorschau lehnt das ab. Zum Ansehen `/download?os=windows` (oder `macos`, `linux`).
- Lokale Demodaten: per Node-Skript mit `pg` **im Ordner services/stats** (Schreiben außerhalb des Projekts sperrt die FORGE-Policy; Skript danach löschen) in `installs` (mit `models`, `plan`, `language`; `os` als `windows…`, `darwin…`, `linux…`) + `install_days` (Zähler aus `COUNTER_KEYS`, steigend über 30 Tage, ein Tag pro Zeile, damit „Tokens pro Tag“ Balken zeigt), IDs `00000000-0000-4000-8000-0000000000cN`; löschen mit `DELETE FROM installs WHERE install_id::text LIKE '00000000-0000-4000-8000-0000000000c%'`. Die Tabellen entstehen erst beim ersten Aufruf von `/stats`.
- Bash-Heredocs verlieren Backslashes; Edit-Skripte, die Text mit `\n` suchen, scheitern an CRLF-Arbeitskopien (`core.autocrlf=true`): vorher `\r\n` normalisieren oder das Edit-Werkzeug nehmen.
