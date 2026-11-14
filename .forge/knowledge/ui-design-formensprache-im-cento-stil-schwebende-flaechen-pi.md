---
title: "UI-Design: Formensprache im Cento-Stil (schwebende Flächen, Pills, Radien, Schatten, backdrop)"
summary: "Gestaltungsregeln seit dem Redesign vom 2026-11-14 für App, Setup und Website: Farben unverändert, Formen wie im Projekt Cento. Vor jeder neuen Oberfläche lesen, damit Radien, Pills, Schatten und Flächen einheitlich bleiben."
tags: ["ui","konvention","stats","installer","preview"]
updated: "2026-11-14T15:22:50.557Z"
---

# UI-Design: Formensprache im Cento-Stil

Am 2026-11-14 hat der Besitzer ein komplettes Redesign verlangt: „Nimm einfach das Cento-Design, aber behalte alle Farben von aktuell. Es soll erwachsener und professioneller wirken“ (rundlich, Menü links, Hauptbereich in runden Elementen). Vorlage ist `C:\Users\tjorven\Documents\Coding\cento` (`packages/ui`, `packages/brand/css/tokens.css`, `apps/marketing`). Gilt für Desktop-App, Setup (`apps/installer/ui`) und Website (`services/stats`).

## Was fest bleibt
- Alle Farb-Tokens mit ihren Werten, Schrift Geist, Logo. Orange bleibt Akzent für Primäraktionen und den aktiven Hauptnavigationspunkt.
- Auswahlzustände in Listen (Einstellungs-Navigation, Wissenseinträge, Branches, Commits) bleiben `bg-accent-soft`.
- Einziger neuer Farbwert: `--color-backdrop: #0d1014` (Fensterhintergrund hinter den schwebenden Flächen; im Setup `--backdrop`).

## Regeln (Tokens in `apps/desktop/src/styles.css`)
- Radien: `rounded` 4px (Code-Chips), `rounded-sm` 6, `rounded-md` 10 (Felder, Menüeinträge, Selects), `rounded-lg` 14 (Listenzeilen, Hinweiskästen), `rounded-xl` 18 (Karten, Menüs, Panels im Projekt), `rounded-2xl` 24 (Shell-Flächen, Dialoge, Befehlspalette, Composer), `rounded-full` (Buttons, Badges, Chips, Navigation, Reiter, Suchfeld).
- Schatten sind die Tailwind-Stufen, neu belegt: `shadow-xs` Controls, `shadow-sm` Karten und Shell-Flächen, `shadow-md` gefüllte Buttons, `shadow-lg/xl/2xl` alles Schwebende. Keine eigenen Schatten-Namen einführen: tailwind-merge in `cn()` hält unbekannte `shadow-*` für Farben (gleiche Falle wie bei den Schriftgrößen).
- Shell (`App.tsx`): Seitenleiste und Hauptbereich sind zwei Flächen mit `rounded-2xl border bg-… shadow-sm` und 10px Abstand (`gap-2.5 p-2.5`) auf `bg-backdrop`. `main` hat `overflow-hidden`. Chat-Fenster (`ChatWindowView`) genauso als eine Fläche.
- Hauptnavigation: Pills `h-10 rounded-full`, aktiv `bg-accent text-accent-fg shadow-md`.
- `Button` ist immer eine Pill; `rounded-*` nicht per className überschreiben. Primär mit `shadow-md`, Sekundär ohne Rahmen.
- `TabBar`: kein Unterstrich mehr, sondern eine neutrale Pill (`bg-surface-3`) hinter dem aktiven Reiter, die mitwandert (Breite und translateX; schließt den Schließen-Knopf `data-tab-close` ein). Aktives Icon orange. Keine `border-b`-Linie unter Reiterzeilen auf Seitenebene.
- `Dialog`: 24px, keine Linien zwischen Kopf, Inhalt und Fuß, runder Schließen-Knopf auf `bg-surface-2`.
- `Page`: Kopf ohne Linie, Titel 22px mit Laufweite -0.02em.
- Karten: `rounded-xl border border-border bg-surface shadow-sm`. Panels im Projekt (Seitenpanel rechts, unteres Panel) sind eingerückte Karten (`m…2.5 rounded-xl border shadow-sm`).
- Badges, Chips, Chip-Skeletons: `rounded-full`. Abschnittsüberschriften: `text-caption font-semibold uppercase tracking-[0.08em] text-subtle`.
- `EmptyState`: Icon in runder Fläche `h-14 w-14 rounded-full bg-surface-2`.
- Weiter gültig: keine farbigen Streifen am linken Rand, Skeletons in der Form des Inhalts.

## Desktop-UI ohne Tauri ansehen (eine Datei, nichts im Git)
Bewährt beim Redesign: eine einzige `vite.config.mjs` unter `apps/desktop/node_modules/.cache/forge-preview/` (ignoriert, landet nie im Commit). `root` ist `apps/desktop`; ein Plugin startet `packages/sidecar/dist/sidecar.mjs` mit `FORGE_DATA_DIR` auf eine Kopie von `.forge-demo/data/forge.db` im selben Cache-Ordner und liefert `/preview.html` (per `server.transformIndexHtml`, setzt `__TAURI_INTERNALS__` mit `invoke`, `transformCallback`, `metadata.currentWindow.label`, dann `import("/src/main.tsx")`), `/bridge/send`, `/bridge/events` (SSE) und `/bridge/rpc`. Stubs: `sidecar_status` true, `chat_windows` `{sessions: [], pinned: []}`, `install_check` `{release: false, missing: []}`. Start: `pnpm exec vite --config node_modules/.cache/forge-preview/vite.config.mjs` in `apps/desktop` (Port 1430), vorher `pnpm --filter @forge/sidecar build`. Dann `preview_interact` auf `http://127.0.0.1:1430/preview.html`. „Resume“ nicht klicken (startet eine echte Claude-Session).

## Stolperfallen
- Bash-Heredocs mit Apostrophen und Backslashes scheitern in dieser Shell: Edit-Skripte mit dem Write-Werkzeug als Datei anlegen.
- Massen-Ersatz per sed auf Klassenmuster kann Klassen doppeln (z. B. `shadow-sm shadow-2xl`): danach danach greppen.
