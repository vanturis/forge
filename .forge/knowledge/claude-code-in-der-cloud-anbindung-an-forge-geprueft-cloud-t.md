---
title: "Claude Code in der Cloud: Anbindung an FORGE geprüft (--cloud, --teleport, Guthaben, Grenzen)"
summary: "Ergebnis der Prüfung vom 2.11.2026: was CLI und SDK für Cloud-Sessions hergeben, warum ein Guthaben-Wächter sich nicht lohnt und wo die Grenzen liegen. Vor jeder Arbeit an Cloud-Sessions lesen."
tags: ["sdk","sessions","usage","agenten","stolperfalle"]
updated: "2026-11-02T14:23:03.481Z"
---

Geprüft am 2026-11-02 an Claude Code 2.1.304, Agent SDK 0.3.316 und https://code.claude.com/docs/en/claude-code-on-the-web. Noch nichts davon ist in FORGE gebaut.

## Abrechnung
- Cloud-Sessions zählen auf dieselben Abo-Limits wie lokale, die VM kostet nichts extra (Doku). Sie helfen also nicht, wenn ein Limit erreicht ist.
- Das Aktionsguthaben (Pro 100 USD, Max 250 USD) läuft laut Presse am 4.11.2026 ab; Einlösen ging bis 7.10. Primärquelle von Anthropic nicht gefunden. Danach gibt es kein Cloud-Guthaben mehr, das man überwachen könnte. Ist es leer, laufen Sessions laut Presse auf den Abo-Limits weiter.
- Bezahlte Usage Credits sind etwas anderes und greifen erst nach dem Limit. Stand steht in `/usage` unter `rate_limits.spend` und `rate_limits.extra_usage`.

## Guthaben maschinell lesen
- `usage_EXPERIMENTAL_MAY_CHANGE_DO_NOT_RELY_ON_THIS_API_YET` liefert am Konto des Besitzers `rate_limits.iguana_necktie` = `{limit_dollars: 250, used_dollars, remaining_dollars, resets_at: 2026-11-05T07:59Z}`. Betrag und Ablauf passen zum Aktionsguthaben, belegt ist die Bedeutung aber nicht: der Schlüssel ist ein Codename, nicht in `sdk.d.ts`, nicht im Binary 2.1.304. `rate_limits.promo_credits` war null.
- `toPlanUsage` ignoriert Codename-Schlüssel mit Absicht. Das so lassen.
- `/api/oauth/*` und `/v1/sessions` direkt aufrufen geht nicht: dafür müsste FORGE OAuth-Tokens lesen, siehe [[anthropic-bedingungen-claude-abo-login-in-forge-agent-sdk-un]].

## Was geht
- Starten: `claude --cloud "<Auftrag>"` klont den Branch vom GitHub-Remote, also vorher pushen. Ohne Remote oder ohne GitHub-App: Bundle-Upload (unter 100 MB, ohne untracked Dateien).
- Nachricht schicken: `claude -p "<Text>" --cloud <session-id> --output-format json`. Reiht nur ein und wartet nicht auf die Antwort.
- Zurückholen: `claude --teleport <id>`. Braucht sauberen Arbeitsbaum, denselben Checkout, gepushten Branch, dasselbe Konto. Komprimierte Teile des Verlaufs kommen nicht mit. Danach eigene Kopie, die Cloud-Session läuft getrennt weiter.
- Limit-Auslagerung ist sinnlos, siehe oben. Sinnvoller Nutzen: Arbeit läuft weiter, wenn der Rechner aus ist.

## Was nicht geht
- Bestehende Session aus der CLI in die Cloud schieben: laut Doku nur in der Desktop-App von Anthropic („Open in > Cloud“), und auch dort nur als Zusammenfassung. FORGE könnte es nachbauen: `sessions.handoff`-Prinzip (Fork + /compact), pushen, `claude --cloud` mit der Zusammenfassung. Siehe [[lange-sessions-hinweis-und-uebergabe-in-neue-session-session]].
- Live mitlesen oder Rückfragen in FORGE beantworten: Das SDK bietet dafür nichts, `--cloud <id>` ohne `-p` meldet „Attaching … is not enabled for your account“. FORGE kann nur auf claude.ai/code verlinken. Darum kann auch das Telefon keinen Fortschritt vorlesen.
- In der Cloud fehlen: FORGE-Werkzeuge (Wissen schreiben, Vorschau, Dev-Umgebung), Auto-Commit, globale CLAUDE.md, lokale MCP-Server, `.env`. Die VM ist Ubuntu x86_64 mit Docker, PostgreSQL und Redis, also keine macOS- oder Windows-Builds. Netz standardmäßig nur auf Allowlist.

## Ungeprüft
Es wurde keine echte Cloud-Session gestartet. Offen: ob `claude --cloud` ohne Terminal sauber die Session-ID ausgibt, ob `--teleport` ohne TTY läuft, ob eine teleportierte Session per SDK-`resume` in FORGE weiterläuft. Vor dem Bau zuerst an einem Wegwerf-Repo testen.
