---
title: "Vorher/Nachher-Bilder bei UI-Änderungen (UiCompareService, ui.compare, uiCompare.*)"
summary: "Wie FORGE vor und nach einem Durchlauf Screenshots der Web-App macht, wenn Claude UI-Dateien ändert: Auslöser, wann ein Vergleich verworfen wird oder \"unchanged\" heißt, Ablage, Chat-Karte, RPCs, Telefon. Wichtig beim Ändern von Turn-Start/-Ende, Vorschau oder der Karte."
tags: ["preview","chat","sessions","telefon","stolperfalle"]
updated: "2026-11-25T13:08:37.096Z"
---

Stand: 2026-11-25

## Ablauf (packages/sidecar/src/preview/ui-compare.ts, `UiCompareService`)
- Turn-Start: `TurnAutomation.noteTurnStart` ruft `host.turnStarted` → `uiCompare.turnStarted`. Läuft der Session schon eine Beobachtung (Nachricht mitten im Durchlauf), passiert nichts. Vorher-Bild im Hintergrund (`track`, also von `drain()` abgewartet), nur wenn Einstellung `uiCompare` an, Dev-Server `running` mit Adresse und Edge/Chrome gefunden. Sonst still nichts.
- Seite: die zuletzt per Vorschau-Werkzeug in dieser Session angesehene (`PreviewService.lastViewed(sessionId)`, gesetzt in `header()` über `PreviewTarget.viewer`), sonst die Dev-Server-Adresse. Der Wert beim Turn-Start wird als `viewedAtStart` gemerkt.
- Geänderte UI-Dateien: aus `tool.use`-Events (`SessionCore.onRecord` in session-service.ts) der Werkzeuge Edit/MultiEdit/Write mit `file_path` innerhalb des Session-Ordners und Endung .tsx .jsx .vue .svelte .css .scss .sass .less .html .astro. **Änderungen per Bash (sed, Codegeneratoren) werden nicht erkannt.** Bewusst kein git-status-Vergleich.
- Turn-Ende (`turn.result`, auch gestoppt/fehlgeschlagen): Vergleich wird **verworfen** (Ordner gelöscht, keine Karte), wenn
  - keine UI-Datei geändert wurde,
  - das Vorher-Bild erst nach dem ersten UI-Edit fertig war (`doneAt > firstEditAt`; Browserstart und Next-Kompilierung dauern, das Bild könnte die Änderung schon zeigen),
  - Claude in diesem Durchlauf eine **andere Seite** angesehen hat als die des Vorher-Bilds (`lastViewed` am Ende ≠ `viewedAtStart` und nicht `samePage`). Das ist die Seite, an der Claude gearbeitet hat; das Vorher-Bild zeigt eine andere. Ein Vorher-Bild lässt sich nachträglich nicht herstellen.
- Sonst: Event `ui.compare` wird sofort nach dem Turn-Ergebnis geschrieben (feste Stelle im Chat, darum nicht erst nach der Aufnahme), dann `SETTLE_MS` (1,5 s), Seite frisch laden, Nachher-Bild. Status `capturing` → `ready` / `failed` / **`unchanged`** per `uiCompare.updated`.
- `unchanged` (gilt auch beim Neu-Aufnehmen): Nachher-Bild byte-gleich oder höchstens `SAME_PIXELS` (24) Pixel weichen deutlich ab. Gezählt von `PreviewService.changedPixels` im Vergleichs-Tab auf `about:blank` (Canvas, keine CSP der Seite blockiert data:-Bilder), Kanal-Abweichung > 32 zählt. Typischer Fall vorher: zwei identische Bilder der Startseite, weil die Änderung auf einer Unterseite, in einem Dialog oder unter dem sichtbaren Bereich liegt.
- Status `stopped`/`error` der Session oder Löschen der Session verwirft eine laufende Beobachtung (`drop`).
- Aufnahme: `PreviewService.capture` nutzt einen **eigenen Tab** (`Instance.compare`) im Projekt-Browser, in der Projekt-Warteschlange (`exclusive`). Claudes offene Seite bleibt unberührt. Immer 1280x800, nur der sichtbare Bereich.

## Ablage und Aufräumen
- `<dataDir>/ui-compare/<id>/before.jpg, after.jpg, meta.json`. id = Zeit base36 + Zufall (Regex im RPC `^[a-z0-9-]{1,64}$`).
- `prune()` beim Start (app.ts) und nach jedem Vergleich: älter als 14 Tage, mehr als 100, oder Ordner ohne meta.json älter als 6 h.
- Bilder gehen nie an Claude.

## RPC / UI
- `uiCompare.get`, `uiCompare.image`, `uiCompare.retake` (nur Nachher-Bild neu), `uiCompare.latest`.
- Desktop: `UiCompareCard.tsx`. Bei `unchanged` nur eine Zeile „Keine sichtbare Änderung auf dieser Seite“ (Grund im Tooltip) mit Knopf „Bilder zeigen“. Rechtsklick: Bild öffnen, im Finder/Explorer zeigen, neu aufnehmen, Seite im Browser öffnen, Adresse kopieren.
- Einstellung `uiCompare` (Standard an), Palette „Letzten Vorher-Nachher-Vergleich öffnen“.
- Telefon: `forge_settings` `ui_compare`, `sessions` Aktionen `ui_compare` (sagt auch `compareUnchanged` an) und `ui_compare_retake`. `uiCompare.image` steht auf `NOT_ON_PHONE`.

## Tests
- `packages/sidecar/test/ui-compare.test.ts` (Fake-Capture liefert pro Aufruf andere Bytes; `same`/`pixels` steuern unchanged), `test/preview.test.ts` „counts the pixels…“ mit echtem Browser.
