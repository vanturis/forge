---
title: "MCP und Plugins verwalten: Scopes, OAuth-Login ohne Terminal, Einstellungen, ohne Neustart (mcp.login, ExtensionWatch)"
summary: "Wie FORGE MCP-Server über die CLI verwaltet, sich ohne Terminal anmeldet (mcpAuthenticate), Plugin-Einstellungen und Marketplaces abbildet und Änderungen auch von außen ohne Neustart erkennt."
tags: ["sidecar","ui","telefon","stolperfalle","einstellungen"]
updated: "2026-11-02T14:32:45.405Z"
---

Stand 2026-11-02. Code: `packages/sidecar/src/config/` (mcp.ts, mcp-login.ts, plugins.ts, extension-watch.ts), Desktop `apps/desktop/src/components/extensions/` (McpTab, McpLogin, McpServerDialog, PluginOptionsDialog, MarketplacesDialog, SkillMarketplace), Telefon-Werkzeug `extensions`.

## Grundsatz
FORGE schreibt MCP-Server nicht selbst in Dateien, sondern ruft `claude mcp add/remove/add-json` (ohne Shell). Gelesen wird direkt aus den Dateien, weil `claude mcp list` den Bereich nicht nennt.

## Bereich (Scope) je Server
- user: `mcpServers` oben in `~/.claude.json` (bzw. `$CLAUDE_CONFIG_DIR/.claude.json`, `claudeJsonPath()`).
- local: `projects[<Ordner>].mcpServers` in `~/.claude.json`. Claude schreibt den Ordner mit Vorwärts-Slashes (`C:/Users/...`), Vergleich darum über `pathKey()`.
- project: `<Ordner>/.mcp.json`.
- Vorrang wie Claude Code: local vor project vor user (`configuredServers`).
- Server aus Plugins oder claude.ai haben keinen Bereich und das Feld `origin`: FORGE meldet dort an, bearbeitet und entfernt sie aber nicht.
- Ohne offenes Projekt (cwd = Home) wählt der Dialog für project/local ein Projekt aus `projects.list` (nur Hauptprojekte).

## Stolperfallen der CLI (claude 2.1.x)
- `claude mcp list` nennt auch Namen mit Leerzeichen und Doppelpunkt (`plugin:stripe:stripe`, `claude.ai Trello`). Der Name endet am ersten `: `. Ein engerer Regex ließ solche Server früher still verschwinden. RPCs für Anmelden und Abmelden nehmen darum `mcpAnyName`, nicht `mcpName`.
- `-e` und `-H` sind variadisch: Sie fressen auch den Namen, wenn der danach kommt. Darum Reihenfolge `mcp add <name> --scope … -e … -H "K: V" --client-id … -- <url|cmd> args`.
- `--client-secret` ist ein Schalter: ohne Wert fragt die CLI interaktiv (hängt bis Timeout). FORGE setzt den Schalter nur mit Secret und gibt den Wert über die Umgebungsvariable `MCP_CLIENT_SECRET`, nie auf der Kommandozeile. Das Secret landet im System-Schlüsselbund, in der Datei steht nur `oauth: { clientId, callbackPort }`.
- Server aus `.mcp.json` zeigt `claude mcp list` als `Pending approval`, bis sie freigegeben sind. FORGE: Status `pending`, Knopf „Freigeben“ = `mcp.approve` schreibt den Namen in `enabledMcpjsonServers` der `.claude/settings.local.json` (`updateSettings` in claude-config.ts). Beim Anlegen mit Bereich project gibt FORGE gleich frei. In einem Ordner ohne bestätigtes Vertrauen bleibt `claude mcp list` trotzdem bei pending, und `claude mcp logout` lehnt dort ab.
- Es gibt kein `mcp edit`. `mcp.add` mit `replaces: {name, scope}` entfernt den alten Eintrag und legt neu an; scheitert das, stellt `claude mcp add-json` den alten Roheintrag wieder her. Ein OAuth-Client-Secret geht dabei verloren (UI-Hinweis: neu eingeben).

## Anmelden ohne Terminal (mcp.login)
- `claude mcp login` bricht ohne TTY ab („stdin isn't a terminal“), auch mit `BROWSER`. Darum startet `AgentSdkRuntime.mcpLogin` einen kurzen CLI-Prozess ohne Prompt (kostet keine Tokens) und ruft `mcpAuthenticate(name)`. Die Methode steht nicht in den SDK-Typen, wird aber zur Laufzeit geprüft.
- Antwort: `authUrl` mit lokalem Rückruf (`redirect_uri=http://localhost:<port>/callback`). Den Rückruf nimmt genau dieser Prozess an. Darum läuft er weiter, bis `mcpServerStatus` `connected` meldet (höchstens 5 Minuten). Wird er vorher beendet, scheitert die Anmeldung im Browser.
- Ablauf: Ereignis `mcp.login` mit `state` `waiting`/`done`/`expired`/`cancelled`. Das Hauptfenster öffnet die Seite, Chat-Fenster nicht. Danach `reconnectMcpServer` in laufenden Sessions.
- Geprüft mit einem eigenen lokalen OAuth-MCP-Server (DCR, Authorize, Token, Bearer), nicht an echten Diensten. Testzugang danach mit `mcpClearAuth` löschen.

## Plugin-Einstellungen und Marketplaces
- `claude plugin configure --json <id>` liefert `schema`, `inputs`, `choices`, `configured`, `unconfigured`. Boolesche Felder haben die Choices `true`/`false`. Speichern mit `--values-stdin` als JSON aus einzeiligen Strings; ausgelassene behalten ihren Wert.
- Werte von `sensitive`-Feldern verwirft `parsePluginOptions`, damit sie nie die UI erreichen. Das Telefon setzt sie nicht, sonst stünden sie im Gesprächsprotokoll.
- Neue Befehle in einem eigenen Konfigurationsordner testen: `CLAUDE_CONFIG_DIR=/tmp/x claude plugin …`.

## Erkennen ohne Neustart
- `ExtensionWatch` prüft alle 10 Sekunden Änderungszeiten: `installed_plugins.json`, `known_marketplaces.json`, `settings*.json`, `skills`, `commands`, `agents`, `.mcp.json`, jeweils global und je beobachtetem Projekt. Von `~/.claude.json` zählen nur die Serverlisten, weil die CLI die Datei ständig umschreibt.
- Das Ereignis `extensions.changed` macht die Queries `mcp`, `plugins`, `docs`, `hooks`, `commands` und `runtimeInfo` ungültig. `RuntimeCatalog.extensionsChanged` leert den Befehls-Cache.
- `reloadPlugins` lädt auch neu eingetragene MCP-Server in eine laufende Session (geprüft). Eigene Aktionen in FORGE wenden es immer an. Von außen bemerkte Änderungen laufen mit `holdOnCacheImpact`: Greift das, kommt die Änderung erst beim nächsten Start der Session, dafür wird kein Prompt-Cache ungültig.

## Geheimnisse
- `mcp.list` liefert nur Namen (`headerNames`, `envNames`, `oauthClientId`), Werte nur `mcp.get` für den Bearbeiten-Dialog. Das Telefon sagt bei read nur Namen an.
- Bereich project: Token und Header landen in `.mcp.json` im Repo. Dialog warnt und empfiehlt `${VARIABLE}` (Claude Code expandiert das in .mcp.json).
- Dialog-Prefill: `Authorization: Bearer …` wird zum Token-Feld, alle anderen Header kommen ins Feld „Weitere Header“.
