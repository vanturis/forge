<img src="../../.github/assets/flags/gb.svg" height="14" alt=""> English · <a href="README.de.md"><img src="../../.github/assets/flags/de.svg" height="14" alt=""> Deutsch</a>

# FORGE statistics (services/stats)

Small service at https://forge.vanturis.de. It shows the FORGE start page (`/`), receives the anonymous usage numbers of the FORGE desktop app and shows the totals of all installations publicly at `/stats` ("Live Stats", English and German).

In the app, usage statistics are on by default. Nothing is sent before the setup assistant is through. After it and the sync question, FORGE tells once about them and offers to turn them off; users who declined earlier stay off. They can be switched on or off at any time under Settings > About FORGE > Privacy; when they are switched off, FORGE deletes the data already sent at the service (`DELETE /api/v1/report/<installId>`).

The folder is not part of the FORGE pnpm workspace. It has its own `package.json` and its own `pnpm-lock.yaml`.

Stack: Next.js (App Router), TypeScript strict, `pg`, `zod`. Plain CSS without a framework.

The page uses the design of the desktop app: the color, font and radius tokens from `apps/desktop/src/styles.css` are CSS variables in `src/app/globals.css` (dark theme only, the app has no light theme). The page layout (top bar, footer, start page, statistics) is in `src/app/pages.css`, the building blocks in `src/components/blocks.tsx`. The charts in `src/components/charts.tsx` follow those of the daily report (`apps/desktop/src/components/report/usage-charts.tsx`): columns and bars in HTML without a chart library, tooltip on hover and focus. If the app changes its tokens, update them here. The font is Inter (package `@fontsource-variable/inter`, SIL Open Font License, bundled with the CSS), icons come from `lucide-react`. The logo mark and favicon are copies of `apps/desktop/src/assets/logo-mark.svg` and `logo.svg`.

## What is stored

One row per installation in the table `installs`: random installation ID, first and last report, FORGE version, operating system, the cumulative counters as JSON, the tokens and costs per Claude model (`models`, JSON) the type of Claude subscription (`plan`) and the language of the FORGE interface (`language`). The app always sends the total since 2026-10-17 (start of the statistics, `USAGE_STATS_SINCE` in `packages/sidecar/src/persistence/db.ts`), and the service overwrites the last state. App versions before this cutoff date send the total since installation; with the update their counters drop once.

In addition, `install_days` holds the state of each installation at the end of each UTC day (one row per installation and day, each report overwrites the one for the current day). The history is derived from this: the increase for a day is the state minus the last earlier state of the same installation. On an installation's first day the earlier state is its very first report (`installs.first_counters`): a new installation reports a minute after its start, so its first day counts from there. Installations from before that column have none; their first state does not count as an increase. Nor does a counter missing from the earlier state (a new app version that sends its total since installation). Negative differences (reinstallation with an empty database, update to the cutoff date) count as 0. Active installations on a day are those with a state on that day. Turning off the statistics deletes the installation together with its daily states (`ON DELETE CASCADE`).

`activity_hours` holds, per UTC day and hour, the tokens and runs all installations added in that hour (the difference between two reports of an installation, summed; nothing per installation). `download_assets` remembers the download count of every `FORGE-Setup.exe` GitHub ever listed, `download_days` the counted downloads per day and way (see Downloads).

No IP addresses in the database or in logs. For the limit on mass-created IDs, the process keeps salted hashes of the IP addresses in memory, only for the current day.

The service creates the tables itself on first access (`CREATE TABLE IF NOT EXISTS`, new columns with `ADD COLUMN IF NOT EXISTS`). No migration is needed.

## API

| Method and path | Purpose | Responses |
| --- | --- | --- |
| `POST /api/v1/report` | Report the state of an installation | 204; 400 invalid; 413 body over 4 KB; 429 too frequent; 503 DB down |
| `DELETE /api/v1/report/<installId>` | Delete the record (statistics turned off in FORGE) | 204, even if it did not exist; 400 not a UUID v4 |
| `GET /api/v1/totals` | Totals, models, versions and history as JSON (see below), `Cache-Control: public, max-age=300` | 200; 503 |
| `GET /api/v1/live` | Installations online right now, in total and per subscription (`{ onlineInstalls, plans: [{ plan, online }], updatedAt }`); the page polls every 30 seconds, cached for at most 15 seconds | 200; 503 |
| `GET /api/v1/downloads` | Installer downloads by people, without updates (`{ downloads, windows, macos, linux, script }`, see Downloads); `downloads` is what the README badge shows | 200; 503 |
| `GET /dl/<file>` | Counted download link of the download page (`macos-arm64`, `macos-x64`, `linux-appimage`, `linux-deb`): forwards to the file of the newest release on GitHub | 302; 404 unknown file |
| `GET /install.sh` | Forwards to `scripts/install.sh` in the repository; a fetch by curl or wget counts as a download of the install command | 302 |
| `GET /api/v1/donations` | Donated so far (`{ donations: { cents, count } }`, euro cents; `donations: null` without `STRIPE_SECRET_KEY`); for the heart in the app, fetched from Stripe at most every 10 minutes | 200; 503 |
| `GET /api/health` | Health check with a DB query | 200 `ok`; 503 |
| `GET /` | Public page | 200, on DB failure with a notice instead of numbers |
| `POST /crew/v1/rooms/<room>` | Crew relay: put a sealed message `{ from, kid, iv, tag, data }` into the room | 200 `{ seq }`; 400; 404 invalid room; 413 over 256 KB; 429 too often; 503 full |
| `GET /crew/v1/rooms/<room>/stream?after=<seq>` | Crew relay: server-sent events (kept messages after `seq`, then `event: ready`, then live; `event: gap` on gaps, `: ping` every 20 s) | 200 `text/event-stream` |
| `GET /crew/health` | Crew relay: `{ ok, rooms, streams }`, no database | 200 |

Body of the report:

```json
{
  "schema": 1,
  "installId": "<uuid v4>",
  "appVersion": "0.1.80",
  "os": "Windows 10.0.26200",
  "counters": {
    "tokensInput": 0, "tokensOutput": 0, "tokensCacheRead": 0, "tokensCacheWrite": 0,
    "claudeTurns": 0, "claudeWorkMs": 0, "sessions": 0, "projectsCreated": 0,
    "agentsStarted": 0, "agentsMerged": 0, "phoneCalls": 0,
    "userTurns": 0, "costUsdCents": 0,
    "toolCalls": 0, "commits": 0, "phoneMs": 0
  },
  "models": {
    "claude-opus-4-7": { "tokens": 123, "costUsdCents": 45 }
  },
  "plan": "ultra",
  "language": "de"
}
```

`userTurns` are the runs that users started themselves, `costUsdCents` the estimated API cost of all Claude calls in US cents. `toolCalls` are Claude's tool calls in sessions, `commits` the commits FORGE itself created (auto-commit, commit dialog, phone), `phoneMs` the duration of all answered phone calls; the first two count from the app version that brought them. `models` contains, per model ID, all four token types combined and the estimated cost, cumulative since the cutoff date. `plan` is the subscription of the account logged in to Claude Code (`ultra`, `max`, `pro`, `team`, `enterprise` ...), read from `organizationType` and the rate limit tier in `.claude.json`; `null` without a claude.ai login. Older app versions send `max_20x` and `max_5x`; the totals count them as `ultra` and `max`. `language` is the language of the FORGE interface (`de`, `en`). Older app versions do not send these fields; then 0, `{}` and `null` apply.

Rules (see `src/lib/report.ts`):

- Counters are integers from 0. Unknown keys are ignored, missing ones count as 0.
- Upper limits per installation: token fields 10^12, `claudeWorkMs` and `phoneMs` 10^11, `costUsdCents` 10^10, `toolCalls` 10^9, all others 10^7. Above that: 400.
- `models`: at most 20 entries, keys 1 to 64 characters from `[A-Za-z0-9._:[]-]`, values `tokens` (integer, 0 to 4·10^12) and `costUsdCents` (integer, 0 to 10^10), both required.
- `plan`: `null` or 1 to 24 characters from `[a-z0-9_]`.
- `language`: `null` or two lowercase letters.
- `appVersion` at most 32 characters from `[0-9A-Za-z.+-]`, `os` at most 64 characters without control characters.
- The app reports every 5 minutes. At most one report per installation every 4 minutes (429). The app treats 429 as sent.
- At most 20 new installation IDs per IP address and day (429). The counter lives only in memory and starts over after a restart.

Response of `GET /api/v1/totals`:

```json
{
  "installs": 7,
  "activeInstalls30d": 7,
  "activeInstalls7d": 6,
  "activeInstalls24h": 4,
  "newInstalls30d": 2,
  "onlineInstalls": 2,
  "counters": { "tokensInput": 0, "...": 0, "userTurns": 0, "costUsdCents": 0 },
  "updatedAt": "2026-10-18T00:00:00.000Z",
  "models": { "claude-opus-4-7": { "tokens": 803400000, "costUsdCents": 315000 } },
  "versions": [{ "version": "0.1.81", "installs": 3 }],
  "plans": [{ "plan": "ultra", "installs": 4, "online": 1 }, { "plan": null, "installs": 3, "online": 1 }],
  "platforms": [{ "platform": "windows", "installs": 7 }],
  "languages": [{ "language": "de", "installs": 5 }, { "language": null, "installs": 2 }],
  "history": [{ "day": "2026-10-17", "tokens": 64420000, "claudeTurns": 55, "sessions": 12, "claudeWorkMs": 5400000, "costUsdCents": 4200, "userTurns": 50, "agentsStarted": 6, "toolCalls": 900, "commits": 12, "activeInstalls": 7, "newInstalls": 1, "totalInstalls": 7, "downloads": 2 }],
  "hours": [{ "tokens": 0, "turns": 0 }],
  "downloads": { "total": 44, "kinds": { "windows": 18, "macos": 10, "linux": 4, "script": 12 } },
  "project": { "stars": 3, "commits": 423, "latestVersion": "0.1.183", "latestAt": "2026-11-12T10:35:06Z" }
}
```

- `onlineInstalls`: installations with a report in the last 10 minutes (`ONLINE_MINUTES`, the app reports every 5).
- `models`: total per model ID across all installations, the 50 with the most tokens. The page merges `claude-opus-5-5` and `claude-opus-5-5[1m]` (the same model with 1M context) into one row.
- `plans`: active installations of the last 30 days per subscription, of which `online` are online right now; `null` means unknown (older app or without a claude.ai login).
- `platforms`: active installations of the last 30 days per operating system (`windows`, `macos`, `linux`, `other`, from the `os` of the reports), most first.
- `versions`: active installations of the last 30 days per FORGE version, most common first.
- `languages`: active installations of the last 30 days per interface language, most first; `null` means an app version that does not send it.
- `newInstalls30d`: installations whose first report was in the last 30 days.
- `history`: the last 30 UTC days including today, oldest first; `tokens` is the increase of all four token types, `claudeTurns` the increase in runs, `sessions`, `claudeWorkMs`, `costUsdCents`, `userTurns`, `agentsStarted`, `toolCalls` and `commits` likewise; `newInstalls` are the first reports of that day, `totalInstalls` all installations known at its end, `downloads` the downloads counted that day.
- `hours`: 24 entries, index = hour of the day in UTC: tokens and runs of the last 30 days in that hour. The page shifts them into the visitor's time zone.
- `downloads`: see Downloads.
- `project`: stars, commits on the default branch and the newest published version from the GitHub API, at most every 30 minutes; `null` while GitHub cannot be reached. The newest version is the highest published one, not GitHub's "latest" (that stays on the release with the full installer).
- `activeInstalls7d`, `activeInstalls24h`: installations with a report in the last 7 days and 24 hours.

The totals are recomputed from the database at most every 5 minutes (in-process cache). New reports therefore appear with a delay of up to 5 minutes.

## Downloads

A download is a person fetching an installer for a new installation (`src/lib/downloads.ts`):

| Way | What counts | Counted by |
| --- | --- | --- |
| `windows` | `FORGE-Setup.exe` of the release `installer` | GitHub (`download_count`), read at most every 30 minutes |
| `macos` | a `.dmg` from the download page | this site (`/dl/macos-arm64`, `/dl/macos-x64`) |
| `linux` | the AppImage or `.deb` from the download page | this site (`/dl/linux-appimage`, `/dl/linux-deb`) |
| `script` | the install command of macOS and Linux | this site (`/install.sh` fetched by curl or wget) |

GitHub's numbers of the other release files are not used. Installed apps fetch `FORGE_<v>_x64-setup.exe` themselves (update to another runtime, repair) and FORGE Setup fetches it once per installation; the updates of macOS and Linux are the same `.app.tar.gz` and AppImage the install command takes; and every file of a release is fetched once by a machine right after it was published. Until 2026-11-15 the badge counted `*_x64-setup.exe` across all releases (44 then, 32 of them from deleted releases), which included those updates.

A new build of FORGE Setup replaces the file and GitHub starts its count at 0. `download_assets` therefore keeps the highest count of every file by its GitHub ID; the total is their sum. A file that was older than a day when first seen brings its count into the total only; a newer one and every later increase are also booked on the day (`download_days`), which feeds the history. Reports of the app trigger the look at GitHub as well, so the count stays current when nobody opens the page.

The counted links answer crawlers and link previews without counting (user agent), `robots.txt` excludes `/dl/`, and one address counts at most 6 times a day (salted hash in memory, like the limit on new installations). Downloads straight from the release page on GitHub are not counted for macOS and Linux.

## Crew relay (/crew)

Meeting point for FORGE crews: several FORGE installations work live on the same project and exchange
presence, tasks and messages through it. FORGE encrypts everything end to end with the crew's key; the relay
only sees the room, a sender id, a key id and encrypted bytes. It runs in the same process as the website and
needs no database and no configuration of its own.

- Core without Next: `src/lib/crew-relay.ts` (`RelayCore`). Next bundles every route separately, so
  `crewRelay()` keeps the one instance on `globalThis`. `src/lib/crew-relay-node.ts` serves the same core on
  `node:http` (same paths); FORGE's sidecar tests use it.
- Limits: per room the newest 500 messages, at most 3 days old; 24 readers at a time; 240 messages per
  minute and address (salted hash, in memory only); 5000 rooms.
- Memory only: a redeploy forgets the rooms, the members then exchange their state again. The website
  therefore has to run as one instance.
- The stream sends `Cache-Control: no-transform` and `X-Accel-Buffering: no`, so Traefik (and a proxy in
  front of it) neither compresses nor buffers it.
- Background: [ADR 0015](../../docs/adr/0015-crew-live-collaboration.md).

### Crew in the browser (/crew)

The page `/crew` is a crew member without FORGE, for a phone or a computer without FORGE. FORGE's invite
link (`https://forge.vanturis.de/crew#forge-crew1.…`, also the QR code) opens it; the code after `#` never
reaches the server. The browser joins like an installation (own X25519 key, a member lets it in after
comparing the check code), keeps keys and state in `localStorage` and talks to the relay directly.

- `src/lib/crew-web/`: WebCrypto (`crypto.ts`, the same boxes as `packages/sidecar/src/crew/crypto.ts`),
  message shapes (`wire.ts`, a copy of the sidecar's, without zod so the sidecar tests can import it),
  relay link and `CrewWebClient`. FORGE's `test/crew.test.ts` runs it against a real installation.
- UI in `src/components/crew-web/`, texts in `src/lib/crew-web/messages.ts`. `noindex`.

## Environment variables

| Variable | Required | Meaning |
| --- | --- | --- |
| `DATABASE_URL` | yes | Postgres connection, e.g. `postgres://user:pass@host:5432/forge_stats` |
| `PORT` | no | Server port, `3000` in the image |
| `CLIENT_IP_HEADER` | no | Header in which a proxy in front of Coolify passes the client address, e.g. `x-client-ip` |
| `STRIPE_SECRET_KEY` | no | Stripe key for the "Bisher gespendet" (donated so far) figure. A restricted key (`rk_live_…`) with read access to *Checkout Sessions* is enough. Without it the figure is missing from the page. |
| `STRIPE_PAYMENT_LINK` | no | A different donation link (`plink_…`). The default is the link behind "Support" (`DONATE_LINK_ID` in `src/lib/donations.ts`). |

"Bisher gespendet" is the sum of all paid checkouts in euros via the donation link, before Stripe fees and without deducting refunds. The service queries Stripe at most every 10 minutes.

The service reads the client IP from the header in `CLIENT_IP_HEADER` (if set), otherwise from `CF-Connecting-Ip`, otherwise from `X-Real-Ip`, otherwise from the last entry of `X-Forwarded-For`. Traefik sets the last two.

### Behind our own HAProxy (how it is run)

HAProxy terminates TLS with its own certificate and forwards to Traefik over HTTP. Therefore:

- Domain in Coolify with **`http://`**: `http://forge.vanturis.de:3000`. With `https://`, Traefik redirects every
  request to HTTPS, HAProxy sends it again over HTTP, and the browser reports `ERR_TOO_MANY_REDIRECTS`.
- Pass the client address in the HAProxy frontend (overwrites whatever the client sends itself):
  `http-request set-header X-Client-IP %[src]`
- Set the environment variable `CLIENT_IP_HEADER=x-client-ip` in Coolify. Without both, the service sees the
  HAProxy address for every user, and the limit on new installations applies to all of them together.

Behind Cloudflare (proxy on), the SSL mode must be **Full (strict)**, for the same reason.

## Setup in Coolify (one resource with Postgres)

`docker-compose.yml` starts the service and its Postgres together. The database is only reachable on the internal network,
its data lives in the volume `stats-db`.

1. DNS: A record `forge.vanturis.de` pointing to the Coolify server.
2. In Coolify: choose a project, **+ New**, **Public Repository** (or **Private Repository (with GitHub App)**
   while the repo is private), URL `https://github.com/vanturis/forge`, branch `main`.
3. Build Pack: **Docker Compose**. Base Directory: **`/services/stats`**. Docker Compose Location:
   **`/docker-compose.yml`**. Save: Coolify reads the file and shows the services `stats` and `postgres`.
4. For the service `stats`, enter **`https://forge.vanturis.de:3000`** as the domain. The `:3000` is the port
   inside the container, not the public port. Traefik handles TLS (Let's Encrypt) and compression.
5. Enter nothing under Environment Variables: Coolify generates `SERVICE_USER_POSTGRES` and `SERVICE_PASSWORD_POSTGRES`
   itself on the first deploy. If they do not appear there, set both by hand (password only
   letters and digits, it is part of a URL).
6. **Deploy**. Then check: `https://forge.vanturis.de/api/health` returns `ok`.
7. Auto deploy: with the GitHub App, Coolify rebuilds on every push. With **Watch Paths** `services/stats/**`
   only when the service changes.

Until 2026-10-18 the service ran at `forge-stats.vanturis.de`, and FORGE up to 0.1.103 reports there. Keep that
domain as a second one on the service (Coolify: both, comma separated; HAProxy: a certificate for both) until
those versions are gone.

The image runs as user `nextjs` (not root) and starts the Next standalone output with
`node server.js`. It includes a `HEALTHCHECK` on `/api/health`.

It also works without Compose: Postgres as a separate Coolify resource, the application with Build Pack **Dockerfile**,
Base Directory `/services/stats`, port `3000`, `DATABASE_URL` set to the internal URL of the database.

The image runs as user `nextjs` (not root) and starts the Next standalone output with `node server.js`.

## Running locally

```sh
cd services/stats
pnpm install --ignore-workspace
DATABASE_URL=postgres://user:pass@127.0.0.1:5432/forge_stats pnpm dev
```

The page then runs at http://localhost:3000. A test report:

```sh
curl -i -X POST http://localhost:3000/api/v1/report \
  -H 'Content-Type: application/json' \
  -d '{"schema":1,"installId":"00000000-0000-4000-8000-000000000001","appVersion":"0.1.80","os":"Windows","counters":{"sessions":1}}'
curl http://localhost:3000/api/v1/totals
```

More commands:

```sh
pnpm test             # unit tests (vitest, without a database)
STATS_TEST_DATABASE_URL=postgres://... pnpm test   # plus the history calculation against a real Postgres
pnpm exec tsc --noEmit
pnpm build            # standalone output in .next/standalone
```

Docker locally:

```sh
docker build -t forge-stats services/stats
docker run --rm -p 3000:3000 -e DATABASE_URL=postgres://... forge-stats
```
