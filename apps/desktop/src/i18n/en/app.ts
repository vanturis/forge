import type { app as De } from "../de/app";
import { byPlatform } from "@/lib/platform";

export const app: typeof De = {
  desktopOnly: "FORGE only runs as a desktop app.",
  needsSidecar: "The interface needs the local background service.",
  startWith: "Start it with",
  inProjectFolder: "in the project folder.",
  starting: "FORGE is starting …",
  sidecarDown: "The FORGE background service is not running.",
  restartInMain: "Restart it in the FORGE main window. This window then reconnects on its own.",
  restart: "Restart",
  loadingView: "Loading view",
  loadingInstallCheck: "Loading installation check",
  nodeRequired: "Requires Node.js 22.13 or later in the PATH.",
  incomplete: (missing) =>
    `FORGE is not completely installed, missing: ${missing}. Install FORGE ${byPlatform({ windows: "with the full setup.exe from the release page, not with the update zip", macos: "again with the .dmg from the release page", linux: "again with the AppImage or .deb package from the release page" })}.`,
  openReleases: "Open release page",
  claudeStartUpdate: {
    updating: "Updating Claude Code",
    versions: (installed, latest) => `Installed is ${installed}, new is ${latest}`,
    preparing: "Preparing the update",
    hint: "FORGE goes on by itself afterwards.",
    slow: "The update takes longer than usual. You can go on without it, it then finishes in the background.",
    failed: "Claude Code was not updated",
    unknownReason: "The reason is not known.",
    retry: "Try again",
    skip: "Go on without update",
    settingHint: "The update at start can be switched off in the settings under Claude Code.",
  },
};
