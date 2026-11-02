---
title: "Claude-Abos Ultra, Max, Pro: Namen und Fenster in FORGE (planName, rateLimitTier, readPlanOrAuth, kein five_hour)"
summary: "Claude Code meldet Ultra weiterhin als max mit Tier default_claude_max_20x; FORGE leitet den Namen über planName ab, muss ohne 5-Stunden-Fenster auskommen und holt das Abo notfalls aus claude auth status. Nötig bei Änderungen an Abo-Anzeige, Nutzung oder Statistik."
tags: ["usage","sidecar","stats","telefon","stolperfalle"]
updated: "2026-11-02T14:32:23.749Z"
---

# Claude-Abos in FORGE

Stand 2026-11-02, geprüft an Claude Code 2.1.316 und den Support-Artikeln von Anthropic.

## Was Anthropic geändert hat (30.10.2026)
- Max 20x heißt jetzt **Ultra** (200 USD), Max 5x nur noch **Max** (100 USD).
- Verifizierte Ultra-Konten haben kein 5-Stunden-Limit. Nicht verifizierte haben vorübergehend eines. Die Verifizierung läuft automatisch über Konto- und Zahlungshistorie und lässt sich nicht beantragen. Kein Balken „Current session“ unter Settings > Usage heißt: verifiziert.
- Das Wochenlimit (10x Pro) und das separate Fable-Wochenlimit bleiben.

## Stolperfalle: die CLI kennt den Namen Ultra nicht
- `claude auth status` und `/usage` liefern weiter `subscriptionType: "max"`, in `.claude.json` steht `organizationType: "claude_max"` und `default_claude_max_20x`. Die CLI vergleicht intern selbst `max` plus diesen Tier.
- Darum entsteht der Name nur in `planName(subscriptionType, rateLimitTier)` in `packages/protocol/src/models.ts`. Genutzt von `planLabel` (Desktop), `describeUsage` (usage_status), Telefon-Diagnose und der Statistik. Nicht nach `subscriptionType === "ultra"` abfragen. Meldet die CLI später `ultra`, funktioniert das ohne Änderung.
- `PlanUsage.rateLimitTier` setzt `ClaudeRuntime.planUsage` aus `.claude.json`, weil `/usage` den Tier nicht liefert.

## Stolperfalle: „Unbekannt“ in der Statistik
`oauthAccount.organizationType` in `.claude.json` setzt die CLI erst nach dem Abruf des Profils, ohne Profil steht dort null. Solche Installationen meldeten bis 2026-11-02 `plan: null`, die Stats-Seite zeigte „Unbekannt“. Seitdem fragt `readPlanOrAuth` in dem Fall `claude auth status`, das `subscriptionType` aus der Anmeldung kennt. Dafür braucht der Dienst keine Änderung. Bestehende Zeilen korrigieren sich, sobald die Installation mit neuer Version meldet (`plan = EXCLUDED.plan`). Installationen ohne claude.ai-Anmeldung und alte App-Versionen bleiben „Unbekannt“.

## Fenster
- `five_hour` kann fehlen oder null sein. Fensterlisten dürfen nicht annehmen, dass es da ist oder an erster Stelle steht. `SessionUsageMeter` nimmt `windows[0]`, die Karte von usage_status (`forge-tool.ts`) fällt auf die Wochenzeile zurück.
- Ungeprüft: Wie `/usage` das Fenster bei einem verifizierten Konto genau weglässt, ist noch nicht an einem echten Konto gesehen. Das Konto des Besitzers meldete am 31.10. noch `five_hour`.

## Statistik
Neue App-Versionen melden `ultra` und `max`, ältere weiter `max_20x` und `max_5x`. `CURRENT_PLAN` in `services/stats/src/lib/db.ts` fasst sie beim Lesen zusammen. In Postgres gewinnt bei `GROUP BY plan` die Spalte vor dem Alias, deshalb steht dort `GROUP BY 1`. Der Dienst wird nicht automatisch deployt.
