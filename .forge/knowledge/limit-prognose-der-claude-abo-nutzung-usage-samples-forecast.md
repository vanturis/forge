---
title: "Limit-Prognose und Limit-Warnungen der Claude-Abo-Nutzung (usage_samples, forecastWindow, UsageForecast, limitWarnings)"
summary: "Wie FORGE aus gespeicherten Nutzungs-Messwerten pro Fenster prognostiziert, ob das Limit vor dem Reset erreicht wird, wo Prognose und Warnungen erscheinen, wie die Einstellung limitWarnings sie abschaltet und welche Stolperfallen es gibt."
tags: ["usage","sidecar","ui","telefon","forge-tools","einstellungen","stolperfalle"]
updated: "2026-10-24T16:45:14.022Z"
---

# Limit-Prognose und Limit-Warnungen der Claude-Abo-Nutzung

## Ablauf
- `RuntimeCatalog.planUsage` (`packages/sidecar/src/sessions/runtime-catalog.ts`) speichert jede echte Abfrage als Messwerte in der SQLite-Tabelle `usage_samples` (window_key, resets_at, at, utilization; Zeiten in ms) und hängt an jedes Fenster `forecast` (`UsageForecast` in `packages/protocol/src/models.ts`, optional). Auch die gecachte Antwort bekommt die Prognose. Kein eigenes RPC: `system.usage` liefert sie mit.
- Aufräumen beim Speichern: Messwerte älter als 7 Tage + 1 h oder von Fenstern, deren Reset vorbei ist.
- Gemessen wird nur, wenn jemand fragt: UI alle 5 Minuten (nur solange FORGE sichtbar ist), nach Turns, Telefon, usage_status.

## Rechnung (`packages/sidecar/src/claude/usage-forecast.ts`, rein, getestet in `test/usage-forecast.test.ts`)
- Fenster-Identität = Reset-Zeit (±2 min Toleranz). Nur Messwerte seit Fensterbeginn (Reset minus 5 h bzw. 7 Tage). Nach einem Rückgang zählt nur, was danach kam.
- Tempo = gewichteter Anstieg / gewichtete Zeit über alle Abschnitte zwischen Messwerten, Gewicht 0,5^(Alter/Halbwertszeit). Halbwertszeit 30 min (5 h) bzw. 24 h (Wochenfenster, sonst wirkt jede Nacht wie eine Pause).
- Keine Prognose bei < 3 Messwerten, Spanne < 10 min (5 h) bzw. < 2 h (Woche), keinem Anstieg, Fenster schon voll (das meldet der RateLimit-Zustand) oder Reset vorbei.
- Prozente kommen von Claude Code gerundet (ganze Zahlen); bei kurzen Spannen ist das Tempo daher grob.

## Wo sie erscheint
- Texte Sidecar: `describeUsage` (usage_status), `limitWarning` (Hinweis an start_agent und Telefon-Agentenstart, blockiert nie), `spokenForecast` (Telefon-Werkzeug `usage`).
- Desktop: `lib/usage-forecast.ts`, `components/usage/UsageWindows.tsx` (Liste, `LimitForecastWarning` im Dialog „Paralleler Agent“, `usageItems` fürs Rechtsklick-Menü), `components/settings/UsageSettings.tsx`, Sidebar-Balken (Tooltip + „Limit gegen HH:MM“), `RateLimitBadge` im Composer („Limit fast erreicht“ bei allowed_warning), Palette `usage-forecast`/`usage-refresh`.

## Einstellung limitWarnings (Standard an)
- Nutzer empfanden die ständigen „bald voll“-Hinweise als nervig, vor allem weil Claude wegen des Systemprompts („usage_status vor großem Aufwand prüfen“) von sich aus nachschaute und dann vom Arbeiten abriet.
- Aus schaltet ab: Composer-Badge im Zustand warning (reached bleibt), `LimitForecastWarning`, die Warnzeile unter den Sidebar-Balken, `limitWarning` an start_agent und beim Telefon-Agentenstart. In `forge-tools.ts` bekommen usage_status-Beschreibung und Kontextzeile die Varianten `usageStatusDescriptionQuiet`/`usageLineQuiet` (nur auf Nachfrage, nicht auf knappes Limit hinweisen). Das Werkzeug selbst bleibt.
- Nicht betroffen: erreichtes Limit (Chat-Hinweis, Telefonanruf `limitWhat`, Auto-Weitermachen) und Antworten auf ausdrückliche Fragen.
- Der Systemprompt wird beim Sessionstart gebaut: Umschalten wirkt dort erst für neue bzw. neu gestartete Claude-Prozesse.
- Schalter: Einstellungen → Claude Code → Verhalten, Palette-Toggle, Telefon `forge_settings limit_warnings`.

## Stolperfallen
- Test-Fakes von `RuntimeCatalog` brauchen `db.addUsageSamples`/`listUsageSamples` (siehe `plan-usage.test.ts`), der SessionService-Fake im Telefon-Test `planUsage`/`rateLimit`.
- `forgeSessionTools` liest `d.db.getSettings()` nur, wenn `d.usage` gesetzt ist; Test-Fakes ohne db funktionieren so weiter.
- Vitest: `beforeEach(() => mock.mockReset())` gibt den Mock zurück, Vitest ruft ihn dann als Aufräum-Funktion ohne Argumente auf. Immer mit Block-Körper schreiben.
- Desktop-Komponenten ohne Tauri ansehen geht auch ohne Brücke: Vorschauseite setzt `window.__TAURI_INTERNALS__` mit `transformCallback` und `invoke` (bei `plugin:event|listen` die Handler-ID für `sidecar://messages` merken, bei `sidecar_send` die Antwortzeile `{id, ok: true, result}` an diesen Callback geben, `sidecar_status` → true), dann `rpc.start()` und Komponenten dynamisch importieren.
