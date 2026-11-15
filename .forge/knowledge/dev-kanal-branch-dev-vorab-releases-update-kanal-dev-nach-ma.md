---
title: "Entwicklungsversion (Branch dev): Version 2.0.N-dev, Kanalwechsel, Dev nach Main (DevChannelService, versionChannel)"
summary: "Neue Arbeit immer auf dev, nie direkt auf main; Versionsschema 2.0.<n> (seit 2026-11-15, vorher 0.1.<run>), Dev-Releases mit -dev, jeder Kanal nimmt nur eigene Builds, Kanalwechsel, Rechteprüfung, Dev nach Main, Stolperfallen im Release-Workflow."
tags: ["release","update","github-actions","konvention","stolperfalle"]
updated: "2026-11-15T09:11:34.014Z"
---

# Entwicklungsversion (Branch dev)

## Arbeitsweise (Regel des Besitzers, 2026-10-22)
- **Neue Features und größere Änderungen entstehen auf `dev`, nie direkt auf `main`.** Vor Beginn den Branch prüfen; steht die Session auf main: `git switch dev` (fehlt der lokale Branch: `git switch -c dev --track origin/dev`). Nicht committete Änderungen kommen beim Wechsel mit.
- Commits und Pushes gehen nach `origin/dev`. main bekommt die Arbeit nur über „Dev nach Main übernehmen“ (oder, wenn der Besitzer es in einer Session verlangt, per Fast-Forward `git push origin dev:main`).
- Dev-Läufe machen kein Lint und keinen Typecheck: beides vor dem Push selbst ausführen.

Gebaut 2026-10-20 (Wunsch des Besitzers: auf dev pushen, Apps auf dev aktualisieren sich daraus, später nach main übernehmen; dev schnell und ohne Zertifikat; nur Repo-Mitglieder dürfen umschalten; Dev muss in der App klar sichtbar sein). Versionsschema und Kanalwechsel neu seit 2026-10-22, Version 2.0 seit 2026-11-15.

## Versionsschema
- **Seit 2026-11-15 (Entscheidung des Besitzers: „es wird die 2.0, neue Major-Version mit Redesign“):** main `2.0.<n>`, dev `2.0.<n>-dev`. `n` = Laufnummer des Workflows minus 194 (Schritt „Plan“ in `release.yml`), die Zählung begann also neu bei `2.0.0`. Lauf 193 war der letzte mit `0.1.<run>`. Ein Lauf mit kleinerer Nummer bricht ab.
- Dev und main teilen sich weiter die Laufnummern, Versionen kollidieren nie. Folge: Welche Nummer ein main-Build bekommt, hängt davon ab, wie viele Dev-Builds vorher liefen.
- Eine nächste Major- oder Minor-Version: im Schritt „Plan“ den Präfix und die Zahl ändern, von der abgezogen wird (= Nummer des nächsten Laufs, `gh run list --workflow release.yml --limit 1`). Ein Commit mit `[skip ci]` im Betreff löst beim Push keinen Lauf aus und verbraucht keine Nummer.
- Die festen Versionen im Repo (`package.json`, `tauri.conf.json`, `Cargo.toml`) bleiben `0.1.0`: lokale Builds sehen damit jedes Release als neuer.
- **Warum -dev (2026-10-22):** Vorher hatten beide Kanäle dieselbe Form und der Dev-Kanal nahm einfach die höchste Nummer aus beiden. Ein nächtlicher main-Build, der kurz nach einem Dev-Build fertig wurde, hat Dev-Nutzer auf den älteren main-Stand gebracht.
- `versionChannel()` und `DEV_VERSION_SUFFIX` in `packages/protocol/src/models.ts`, `releaseChannel()` / `channelReleases()` in `packages/sidecar/src/update/app-update.ts`. Dev-Builds bis 0.1.130 (plain Version, Pre-release) gehören zu keinem Kanal und werden ignoriert; ein installiertes 0.1.127–0.1.130 zählt als stable.
- Versionsvergleiche sind überall numerisch (`compareVersions` in TypeScript, `version_of` in `apps/installer/src/releases.rs`): 2.0.0 ist neuer als 0.1.193. Nirgends hängt Logik an „0.1“.
- Windows-Patch: `update.json` hat `version` (nur Ziffern/Punkte, weil der Apply-Schritt bis 0.1.131 nichts anderes nimmt) und `fullVersion` mit Suffix; `read_version` in `apps/desktop/src-tauri/src/update.rs` liest `fullVersion` zuerst.
- Pre-release-Flag bleibt für Dev-Builds: FORGE Setup (`releases.rs`), Download-Zähler, `scripts/install.sh`, Download-Seite und die Seite „Was ist neu“ überspringen Pre-releases.

## Kanäle in der App (AppUpdateService.check)
- Jeder Kanal sieht nur seine eigenen Builds. Ausnahme Windows: der Dev-Kanal nimmt volle Installer auch von main (`pickRelease(..., installers)`), main nie einen Dev-Installer (ohne Authenticode).
- **Kanalwechsel:** passt `versionChannel(currentVersion)` nicht zum Kanal, wird der neueste Build des gewählten Kanals angeboten, auch mit niedrigerer Nummer (`latest.channelSwitch`, Range nur dieser Build, `switchRange`). Dev nach Stabil: Dialog „Zurück zur stabilen Version“ mit Hinweis statt Notizen, kein Claude-Changelog.
- Kein Wechsel, wenn dev gewählt ist, aber der Zugriff gerade nicht bestätigt werden konnte (`chosenChannel` aus den Einstellungen ≠ effektiver Kanal), sonst würde ein GitHub-Aussetzer zurück auf main führen.

## Rechte (Entscheidung des Besitzers 2026-10-20: „Option 1“, wie Firefox Nightly)
- Dev-Code und Dev-Releases sind öffentlich. Lesen darf jeder, handeln nur Mitglieder.
- Pushen auf dev und „Dev nach Main übernehmen“ prüft GitHub selbst (gh-Token des Nutzers). Die Prüfung in FORGE ist nur Bedienkomfort.
- Rulesets „main schützen“ und „dev schützen“: kein Force-Push, kein Löschen. Würde main später PRs verlangen, müsste `promote()` auf PR anlegen + mergen umgestellt werden.
- **Stolperfalle:** Commits, die `.github/workflows/*` ändern, lehnt GitHub ohne Token-Scope `workflow` ab. Einmal `gh auth refresh -h github.com -s workflow`; das Token des Besitzers hat ihn seit 2026-10-21.

## Release-Seite (.github/workflows/release.yml)
- Push auf `dev` startet den Workflow (paths-ignore wie der Nacht-Check, u. a. `**.md`, `.forge/**`, `services/**`). **Stolperfalle:** Das Anlegen von dev als Kopie von main löst nichts aus; dann `gh workflow run release.yml -R vanturis/forge --ref dev`. Ein Dev-Lauf nutzt die `release.yml` des Branches dev.
- Main baut nur nachts (03:00 UTC, wenn main sich geändert hat) oder per `gh workflow run release.yml -R vanturis/forge --ref main`. Main-Läufe machen Lint und Typecheck, Dev-Läufe nicht: Lint-Fehler auf dev fallen erst beim main-Release auf, vor dem Übernehmen `pnpm lint` und `pnpm typecheck` laufen lassen.
- Kanal aus `github.ref_name` (Job `changes`, Output `channel`); Plan-Schritt gibt `version` (mit -dev) und `core` (ohne) aus.
- Dev schneller: kein Lint/Typecheck, keine Authenticode-Signatur, keine Alt-Signaturen, kein Linux-Job. macOS-Job läuft auch für dev (Besitzer nutzt die Entwicklungsversion auf dem Mac). Ed25519-Update-Signatur bleibt Pflicht.
- Voller Installer im Dev-Lauf nur, wenn es für den Laufzeit-Schlüssel in keinem Release (auch main) einen gibt.
- Release-Notes seit dem letzten Release desselben Kanals (per API: dev = Tags `^v[0-9].*-dev$`).
- Aufräumen im Dev-Lauf: die 3 neuesten `-dev`-Releases plus das neueste mit setup.exe bleiben, Rest mit `--cleanup-tag` gelöscht.
- concurrency-Gruppe je Branch (`release-<ref>`).

## App-Seite
- Einstellung `updateChannel` ("stable" | "dev") in `LOCAL_SETTINGS` von sync.ts.
- `packages/sidecar/src/update/dev-channel.ts` (`DevChannelService`): Zugriff = `gh api repos/vanturis/forge --jq .permissions.push` == true; nur erlaubter Zustand 10 Min. gecacht; `forget()` bei GitHub-Login/-Logout.
- `settings.update` mit `updateChannel: "dev"` ruft `requireAccess()`; Kanalwechsel startet sofort eine Update-Prüfung, die den Wechsel anbietet.
- Übernehmen (`app.promoteDev`): Fast-Forward über `PATCH git/refs/heads/main` (force=false), sonst Merge-Commit über `POST /merges` (409 = Konflikt). Optional danach `workflow_dispatch` auf main.

## UI (Wünsche des Besitzers)
- Schalter heißt **„Entwicklungsversion“** (EN „Development build“); intern `updateChannel`/`devChannel`. Gilt auch für Palette, Suche, Telefon.
- Einstellungen > Über FORGE > Updates (`DevChannelSettings.tsx`): Switch, nur sichtbar mit bestätigtem Push-Recht, kein „Erneut prüfen“-Knopf. Ausnahme: Kanal schon dev und Zugriff weg, dann bleibt die Zeile zum Ausschalten.
- „Dev nach Main übernehmen“ nur mit Zugriff und eingeschalteter Entwicklungsversion; ebenso Palette und Telefon `dev_promote`.
- Kennzeichnung `DevChannelBadge.tsx`: Karte unten links unter der Claude-Code-Karte, `FlaskConical`, Tokens `--color-dev*` (dunkles Blutrot). Klick: Einstellungen, Rechtsklick: ausschalten.
- Telefon: `forge_settings update_channel`, `forge_system dev_status` / `dev_promote`; Update-Text nennt Dev-Build bzw. Wechsel zurück (`stableSwitch`).
