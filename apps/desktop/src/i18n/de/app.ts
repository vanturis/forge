import { byPlatform } from "@/lib/platform";

/** German texts (app). Source of the keys: the English file is typed against this one. */
export const app = {
  desktopOnly: "FORGE läuft nur als Desktop-App.",
  needsSidecar: "Die Oberfläche braucht den lokalen Hintergrunddienst.",
  startWith: "Starte sie mit",
  inProjectFolder: "im Projektordner.",
  starting: "FORGE startet …",
  sidecarDown: "Der FORGE-Hintergrunddienst läuft nicht.",
  restartInMain: "Starte ihn im FORGE-Hauptfenster neu. Dieses Fenster verbindet sich danach von selbst.",
  restart: "Neu starten",
  loadingView: "Lädt Ansicht",
  loadingInstallCheck: "Lädt Installationsprüfung",
  nodeRequired: "Voraussetzung ist Node.js ab Version 22.13 im PATH.",
  incomplete: (missing: string) =>
    `FORGE ist nicht vollständig installiert, es fehlt: ${missing}. Installiere FORGE ${byPlatform({ windows: "mit der vollständigen setup.exe von der Release-Seite, nicht mit dem Update-Zip", macos: "neu mit der .dmg von der Release-Seite", linux: "neu mit dem AppImage oder .deb-Paket von der Release-Seite" })}.`,
  openReleases: "Release-Seite öffnen",
  claudeStartUpdate: {
    updating: "Claude Code wird aktualisiert",
    versions: (installed: string, latest: string) => `Installiert ist ${installed}, neu ist ${latest}`,
    preparing: "Update wird vorbereitet",
    hint: "Danach geht es von selbst weiter.",
    slow: "Das Update dauert länger als üblich. Du kannst ohne es weitermachen, es läuft dann im Hintergrund zu Ende.",
    failed: "Claude Code wurde nicht aktualisiert",
    unknownReason: "Der Grund ist nicht bekannt.",
    retry: "Erneut versuchen",
    skip: "Ohne Update weiter",
    settingHint: "Das Update beim Start lässt sich in den Einstellungen unter Claude Code abschalten.",
  },
};
