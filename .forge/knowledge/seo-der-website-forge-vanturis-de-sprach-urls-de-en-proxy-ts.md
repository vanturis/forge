---
title: "SEO der Website forge.vanturis.de (Sprach-URLs /de /en, proxy.ts, SITE_PAGES, hreflang, OG-Bilder, JSON-LD, Sitemap)"
summary: "Wie die Website in services/stats für Suchmaschinen aufgebaut ist: Sprach-URLs über proxy.ts und SITE_PAGES, Canonical und hreflang, OG-Bilder per Skript, strukturierte Daten, FAQ, robots und Sitemap; nötig vor neuen Seiten (Checkliste), Texten oder Bildern der Website."
tags: ["stats","seo","i18n","konvention","stolperfalle"]
updated: "2026-11-15T08:55:03.786Z"
---

# SEO der Website (services/stats), eingebaut 2026-10-19, Stand 2026-11-15

## Sprach-URLs
- Problem vorher: `/` und `/stats` wählen die Sprache nach Cookie `lang` bzw. Accept-Language. Google crawlt ohne beides und hätte nur Englisch gesehen.
- Jetzt gibt es jede Seite aus `SITE_PAGES` (`lib/i18n.ts`: `/`, `/stats`, `/changelog`) auch als `/de/...` und `/en/...` mit fester Sprache. `src/proxy.ts` (Next 16 heißt Middleware jetzt `proxy`, Funktion `proxy`) schreibt sie auf die Seite ohne Präfix um und setzt den Request-Header `x-forge-locale` (`LOCALE_HEADER`); bei Pfaden ohne Präfix löscht er einen mitgeschickten Header.
- Seiten ohne Präfix bleiben automatisch (Links aus der App wie `STATS_PAGE_URL` funktionieren weiter) und sind `x-default`.
- Server: `getRoute()` in `lib/locale-server.ts` liefert `{ locale, base }` (`base` = "" | "/de" | "/en"). Client: `useLocaleBase()` aus `components/locale.tsx`. Interne Links immer mit `localePath(path, base)`, sonst springt man von `/de` auf die automatische Seite.
- Sprachumschalter: auf Präfix-Seiten schickt das Formular ein verstecktes Feld `page` (`sitePage(pathname)`), `setLocale` setzt das Cookie und leitet auf dieselbe Seite in der anderen Sprache um. Ohne Präfix nur Cookie und neu rendern.
- `/download`, `/crew`, `/dl/...` haben keine Sprach-URL.

## Neue Seite: Checkliste
1. `SITE_PAGES` in `lib/i18n.ts` (damit kennen sie `localePath`, der Sprachumschalter und `setLocale`).
2. `proxy.ts`: die Regex und der `matcher` (muss eine wörtliche Liste bleiben, Next liest sie beim Build).
3. `PAGES` in `app/sitemap.ts`.
4. `pageMetadata` in `lib/seo.ts`: Titel und Beschreibung aus `messages.ts` (`meta`, `statsMeta`, `changelogMeta`); JSON-LD über `subPageJsonLd`.
5. `app/<seite>/page.tsx` und `loading.tsx` (Skeleton in der Form der Seite), Texte Deutsch und Englisch.
6. Links: Kopfzeile (`components/nav.tsx`) und Fußzeile (`app/layout.tsx`).

## Seite „Was ist neu“ (/changelog, seit 2026-11-15)
- Wunsch des Besitzers. `components/changelog.tsx`: eine Karte je veröffentlichter Version, darin die Zeilen der Release-Notizen als Bereich und Text.
- Quelle: `lib/releases.ts`. `getReleases()` holt die Release-Liste von GitHub einmal (15 Minuten Cache) für diese Seite, die Download-Seite (`latestBuilds`) und die Projektfakten der Statistik; vorher fragte jede Stelle selbst. `toChangelog` nimmt nur veröffentlichte Versionen (keine Dev-Builds, nicht das Release `installer`), höchste zuerst.
- Die Notizen schreibt der Release-Workflow als Zeilen „- Bereich: Text“ auf Deutsch. `changeItems` trennt am ersten Doppelpunkt, wenn davor höchstens zwei Wörter stehen, und lässt doppelte Zeilen weg. Die englische Seite zeigt deshalb den Hinweis „The notes are written in German.“
- Gelöschte Releases fehlen (alles bis 0.1.108 wurde am 2026-10-20 gelöscht).

## Metadaten (`lib/seo.ts`)
- `siteMetadata(locale)` im Layout: `metadataBase`, Keywords, Herausgeber Vanturis UG, robots mit `max-image-preview: large`.
- `pageMetadata(path, locale, base)` je Seite: Canonical = eigene URL, `alternates.languages` en/de/x-default, Open Graph und Twitter-Karte mit Bild.
- JSON-LD als `<script type="application/ld+json">`: Start = Organization, WebSite, SoftwareApplication (kostenlos, AGPL, Download-URL), FAQPage aus `landing.faq.items`; Unterseiten = WebPage + BreadcrumbList. `jsonLdScript` maskiert `<`. Keine Bewertungen oder Downloadzahlen erfinden.

## Inhalte
- FAQ-Abschnitt auf der Landingpage (`landing.faq` in `messages.ts`, `<details>`, Stile `.landing-faq`/`.faq-item` in `pages.css`). Antworten nur mit belegten Fakten aus README.de.md; Textregeln des Besitzers: keine Gedankenstriche, keine Metaphern.
- Aufbau der Landingpage und Vorgaben des Besitzers stehen im Eintrag `website-startseite-vorgaben-des-besitzers-hero-pixel-art-sch`.

## OG-Bilder
`node scripts/og-images.mjs` in services/stats erzeugt `src/assets/og-{de,en}.png` (1200x630). sharp kommt über `next` (keine eigene Abhängigkeit), Schrift sind die Systemschriften (Segoe UI unter Windows). Nach neuen Screenshots oder Texten neu erzeugen. sharp nimmt nur Overlays, die ins Bild passen: das Skript schneidet sie mit `fit()` zu.

## Weitere Dateien
`app/robots.ts` (alles erlaubt außer `/api/` und `/dl/`, Sitemap-Verweis), `app/sitemap.ts` (alle Sprachvarianten mit hreflang), `app/manifest.ts`.

## Lokal ansehen
services/stats liegt außerhalb des pnpm-Workspace: Abhängigkeiten mit `pnpm install --ignore-workspace --frozen-lockfile` im Ordner. Die Startseite braucht keine Datenbank. Zum Prüfen im Vorschau-Browser den Produktions-Build nehmen (siehe Eintrag `live-stats-download-zaehlung-ohne-updates-stundenverlauf-git`, Abschnitt „Lokal prüfen“).

## Nach dem Deploy (Besitzer)
Sitemap `https://forge.vanturis.de/sitemap.xml` in der Google Search Console und bei Bing einreichen. Prüfen: Rich-Results-Test für die Startseite.
