---
title: "Website und Statistik-Dienst services/stats (forge.vanturis.de: Landingpage auf /, Live Stats auf /stats, Coolify)"
summary: "Next.js-Website in services/stats: Formensprache im Cento-Stil, neutrale Grautöne, sparsames Orange, Hero mit geneigtem App-Fenster (Vorgabe des Besitzers), Live Stats, Spenden-Dialog, Englisch/Deutsch, mobile Ansicht, Coolify, Stolperfallen."
tags: ["stats","coolify","release","stolperfalle","i18n","ui"]
updated: "2026-11-14T19:47:06.023Z"
---

# Website und Statistik-Dienst services/stats

## Was es ist
`services/stats` ist ein eigenständiges Next.js-Projekt (App Router, pg, zod) für https://forge.vanturis.de. Es nimmt die Meldungen von `packages/sidecar/src/stats/usage-stats.ts` an (`USAGE_STATS_URL` in `packages/protocol/src/`) und zeigt die Summen. API, Payload und Coolify stehen in `services/stats/README.md`. Der Release-Workflow der App ignoriert `services/`.

Seit 2026-10-22 läuft im selben Prozess auch der **Crew-Relay** unter `/crew` (Routen `src/app/crew/...`, Kern `src/lib/crew-relay.ts`, ohne Datenbank, nur im Speicher). Details im Eintrag zur Crew-Live-Zusammenarbeit.

## Deploy (Coolify)
- Anwendung `forge` im Projekt `int/vanturis` (UUID `6rjkhd4z2psnitxmcc7h1yyl`), Build aus `vanturis/forge`, Branch **`dev`**, Basisordner `/services/stats`, Docker Compose. Kein automatisches Deploy beim Push.
- Ablauf: `dev` pushen (Auto-Commit von FORGE pusht nicht immer: `git status -sb` prüfen), dann `mcp__coolify__deploy` mit der UUID, Dauer etwa eine Minute. Prüfen: `get_deployment` und `curl https://forge.vanturis.de/api/health`.
- Nur auf ausdrücklichen Wunsch ausrollen. Ein Neustart trennt laufende Crews (Relay im Speicher).

## Gestaltung
Drei Schritte am 2026-11-14, alle auf Wunsch des Besitzers:
1. **Formen im Cento-Stil** (rundlich, runde Flächen, Pill-Navigation). Das ersetzt die frühere Arbeitsweise „GENAU nach Bildvorlage 1536 x 1024“.
2. **Seriöser Auftritt:** „Das Blau im Hintergrund ist so verspielt. Es soll viel seriöser und weniger verspielt aussehen.“ Neutrale Grautöne, Orange sparsam, kein Bild hinter der Seite.
3. **Hero zurück in die alte Anordnung.** Der Zwischenstand (Titel links, Text und Buttons rechts daneben, darunter ein großes flaches App-Fenster auf einer „Bühne“) wurde klar abgelehnt: „Der Text über dem Download-Button sieht extrem fehlplatziert aus, mach die Platzierung wieder so ähnlich wie vorher, aber belass oben die Leiste. Das Bild ist viel zu groß, das soll auch wieder so ähnlich wie vorher und Parallaxe.“ Die schwebende Kopfzeile bleibt.

### Farben: neutrale Grautöne (dieselben Werte wie in der App)
Tokens in `src/app/globals.css`: `--color-bg #111112`, `--color-backdrop #0b0b0c` (nur `/crew`), `--color-surface #19191a`, `-surface-2 #202022`, `-surface-3 #29292b`, `--color-border #2c2c2f`, `-border-strong #3f3f43`, `--color-fg #ececee`, `-fg-soft #adadb2`, `--color-muted #a3a3a8`, `--color-subtle #73737a`. Orange, Rot und Grün unverändert. Das frühere blaustichige Anthrazit (`#111418`, `#1a1e25`, `#e5e7eb` usw.) darf nirgends mehr auftauchen; `themeColor` in `layout.tsx`, `manifest.ts` und `scripts/og-images.mjs` tragen die Werte als Literal.

### Orange sparsam
Orange nur für: die Primäraktion (Download, `.btn-primary`), das eine Akzentwort im Titel, kleine Icons und Daten (Sparklines, Diagramme, Balken). Keine orangefarbenen Flächen, Verläufe oder Glows als Dekoration.
- `.icon-tile`: neutraler Kreis (`--color-surface-2` mit feinem Rahmen), Icon orange.
- Aktiver Punkt der Kopfzeile, Tabs der Download-Seite und Tabs in `/crew`: neutrale Pill (`--color-surface-3`), nur das Icon orange. Die Crew-Liste in der Seitenleiste von `/crew` ist eine gefüllte orange Pill (wie die Hauptnavigation der App).
- Badge „neueste“, Beitrittsanfrage und Zuständigen-Auswahl in `/crew`, Betrag im Spenden-Dialog: neutral. `.fc-forge-accent` (FORGE-Karten im Chat-Nachbau) neutral wie in der App.
- `.btn-primary:disabled` ist eine neutrale Fläche. Badges unter dem Hero: feiner Rahmen, keine Füllung.

### Hintergrundbild
- Hinter der Seite liegt **kein Bild**: flache Fläche `--color-bg`.
- `src/assets/background.webp` ist die Vorlage des Besitzers (blaustichig) und wird nicht mehr geladen. `node scripts/background-neutral.mjs` erzeugt daraus `background-neutral.webp` (Blaustich herausgerechnet, orange Kanten erhalten).
- Das graue Bild liegt nur noch im Schlussblock (`.closing`), stark abgeblendet. Heller stellen macht es wieder zum Wallpaper.
- `scripts/og-images.mjs` nutzt das graue Bild mit dunklem Verlauf. Nach neuen Screenshots ausführen (überschreibt `og-{de,en}.png`).

### Bausteine und Typografie
- Gemeinsame Formensprache mit der Desktop-App (Tokens in `globals.css`): Radien 4/6/10/14/18/24/9999 px, `--shadow-solid`, `--shadow-raised`, `--shadow-overlay`, Bewegung 120/200/300 ms, nur opacity und transform.
- `.btn` sind Pills (`-primary`, `-secondary`, `-outline`, `-sm`, `-lg`). `.eyebrow` klein, versal, 0.08em, gedämpft.
- Titel: Hero `clamp(36px, 3.6vw, 50px)`, Live Stats `clamp(36px, 4.2vw, 52px)`, Schlussblock `clamp(28px, 3.2vw, 40px)`, Download `clamp(32px, 3.8vw, 44px)`, Laufweite -0.03em.
- Kopfzeile: schwebende Pill, sticky mit 12px Abstand. Bis 900px zeigen Live Stats, GitHub und Unterstützen nur Icons, bis 560px auch Download. Fußzeile: runde Fläche mit Sprachumschalter.

## Landingpage (`landing.tsx`, `pages.css`)
- **Hero zweispaltig** (`.hero-inner`, 0.88fr/1.12fr, vertikal mittig): links `.hero-text` mit Titel, Lead (max. 29rem), zwei Buttons und drei Fakten-Badges; rechts `.hero-shot` mit dem App-Fenster. Die Spalten sind an „Entwicklungszentrale“ gemessen (ein Wort, bricht nicht um): bei Textänderung bei 1100 und 1440 px prüfen. Bei 1440x900 sollen die Funktionskarten im ersten Bildschirm anfangen.
- **App-Fenster:** nur der Screenshot im feinen Rahmen (er zeigt die eigene Titelleiste der App, deshalb keine nachgebaute Fensterleiste), geneigt mit `perspective(2000px) rotateY(-10deg) rotateX(2deg)` und folgt dem Mauszeiger um ±5°/±4° (`components/tilt.tsx` setzt `--tilt-x/-y`, nur `pointer: fine`, nicht bei reduced motion). Dahinter ein kaum sichtbares neutrales Licht (`.hero-shot::before`). Keine Bühne, kein Bild dahinter.
- Unter 1080px einspaltig, Fenster unter dem Text und flach (`transform: none`); bis 560px Titel `clamp(28px, 9vw, 42px)`.
- Screenshot in vier Breiten (`app-{de,en}-{800,1200,1600,2400}.webp`), `sizes="(max-width: 1080px) 92vw, 660px"`. Neue Screenshots: alle vier Breiten und danach die OG-Bilder neu erzeugen (siehe Eintrag zum Branding).
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
App-Ansicht statt Website: `crew.css` blendet per `body:has(.crew-page)` Kopf- und Fußzeile aus und setzt `--color-backdrop`. `components/crew-web/app.tsx` rendert `Shell`: Seitenleiste und Hauptfläche als zwei runde Flächen mit 10px Abstand. Unter 900px liegt die Seitenleiste oben. Leute, Chat und Aufgaben stehen ab 1280px nebeneinander, darunter Tabs. Die `.fc-*`-Regeln sind ein Nachbau des FORGE-Chats: nach einem Umbau des App-Chats dort nachziehen.
- Zum Ansehen ohne zweite FORGE-Installation: eine temporäre Client-Seite, die einen `WebCrewRecord` in `localStorage` schreibt (`forge.crew.web` = Liste der IDs, `forge.crew.web.<id>` = Datensatz mit `membership: "member"`, Mitgliedern mit `presence`, `feed`, `tasks`, `requests`; `lastSeen` in der Zukunft hält Mitglieder online; Schlüssel dürfen Platzhalter sein) und nach `/crew` weiterleitet. Danach löschen.

## Erfasste Felder
Meldung: Installations-ID, `appVersion`, `os`, Zähler (`COUNTER_KEYS` in `src/lib/report.ts`), `models`, `plan`, `language` (`^[a-z]{2}$`). Der Besitzer will alles Sinnvolle sehen, aber nichts, was Nutzer ausspäht (keine Inhalte, Namen, Pfade). Neues Feld: Checkliste im Eintrag zur anonymen Nutzungsstatistik. Ein alter Dienst ignoriert unbekannte Felder (zod strippt).

## Domain, Intervalle, Verlauf
- `forge.vanturis.de`, vorher `forge-stats.vanturis.de`. Apps bis 0.1.103 melden an die alte Domain: beide Domains am Dienst lassen.
- App meldet alle 5 Minuten, Sperre pro installId 4 Minuten (`REPORT_INTERVAL_MINUTES` in `src/lib/db.ts`), „Gerade online“ = 10 Minuten (`ONLINE_MINUTES`).
- Jede angenommene Meldung schreibt `installs` und den UTC-Tag in `install_days` (FK mit CASCADE). Zuwachs pro Tag rechnet SQL (`historySql()`, LAG); der erste Stand einer Installation zählt nicht als Zuwachs. Test: `STATS_TEST_DATABASE_URL=... pnpm test`.

## Sprachen der Seite
Sprach-URLs `/de` und `/en` (siehe Eintrag zur SEO der Website); `/download` und `/crew` haben keine Sprach-URL (`/de/download` ist 404). `LanguageSwitch` in der Fußzeile und in der Seitenleiste von `/crew`. Texte in `src/lib/messages.ts` (`de` ist Quelle des Typs: Funktionen mit Literal-Rückgabe brauchen `: string`, sonst passt `en` nicht).

## Stolperfallen
- **Nicht im pnpm-Workspace**: `pnpm install --ignore-workspace --frozen-lockfile`, eigenes Lockfile (in einem frischen Agenten-Worktree fehlt `node_modules` der Website). ESLint ignoriert `services/`; Typprüfung mit `pnpm exec tsc --noEmit -p .` im Ordner. Vor dem ersten `next dev` oder `next build` meldet tsc fehlende Typen für Bild-Importe und `RouteContext`.
- **Kein `public/`-Ordner**: Bilder statisch importieren oder per relativer `url()` in globalem CSS.
- Dev-Server: `DATABASE_URL=<Test-DB aus dev_environment> pnpm exec next dev -p 4100` im Hintergrund (die Test-DB vorher mit dev_control starten). Summen sind 5 Minuten im Prozess gecacht. Das Beenden der Shell beendet den Next-Prozess nicht; er hält Port 4100 weiter (Prozess mit `Get-NetTCPConnection -LocalPort 4100` finden und beenden, auch vor `pnpm build`).
- **Vorschau-Browser: `http://localhost:4100`, nicht `127.0.0.1`.** Mit `127.0.0.1` hydriert die Seite im Dev-Modus nicht und `/crew` bleibt im Skeleton hängen.
- `/download` leitet Windows-Besucher direkt zur Setup-Datei auf GitHub um; die Vorschau lehnt das ab. Zum Ansehen `/download?os=windows` (oder `macos`, `linux`).
- Lokale Demodaten: per Node-Skript mit `pg` **im Ordner services/stats** (Skript danach löschen) in `installs` (mit `models`, `plan`, `language`; `os` als `windows…`, `darwin…`, `linux…`) + `install_days` (Zähler aus `COUNTER_KEYS`, steigend über 30 Tage, ein Tag pro Zeile), IDs `00000000-0000-4000-8000-0000000000cN`; löschen mit `DELETE FROM installs WHERE install_id::text LIKE '00000000-0000-4000-8000-0000000000c%'`. Die Tabellen entstehen erst beim ersten Aufruf von `/stats`.
- Bash-Heredocs verlieren Backslashes; Edit-Skripte, die Text mit `\n` suchen, scheitern an CRLF-Arbeitskopien: vorher normalisieren oder das Edit-Werkzeug nehmen.
