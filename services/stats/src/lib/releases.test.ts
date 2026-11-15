import { describe, expect, it } from "vitest";
import { changeItems, publishedReleases, toChangelog } from "./releases";

describe("releases", () => {
  it("keeps published versions only, highest first whatever the order of the list", () => {
    const list = publishedReleases([
      { tag_name: "v0.1.192-dev", prerelease: true },
      { tag_name: "v0.1.135" },
      { tag_name: "v0.1.183" },
      { tag_name: "installer", prerelease: true },
      { tag_name: "v0.1.200", draft: true },
      { tag_name: "v0.1.9" },
    ]);
    expect(list.map((r) => r.tag_name)).toEqual(["v0.1.183", "v0.1.135", "v0.1.9"]);
  });

  it("splits a line into its area and what changed", () => {
    expect(changeItems("- Chat: Suche mit Strg+F\n- MCP: Anmeldung ohne Terminal, Plugin-Einstellungen\n- Auto-Commit: Hinweis an Claude")).toEqual([
      { area: "Chat", text: "Suche mit Strg+F" },
      { area: "MCP", text: "Anmeldung ohne Terminal, Plugin-Einstellungen" },
      { area: "Auto-Commit", text: "Hinweis an Claude" },
    ]);
  });

  it("leaves a sentence with a colon whole and drops headings, blank lines and repeats", () => {
    expect(changeItems("## Changes\r\n\r\n- Fehler behoben: die Liste war leer\n- Der neue Dialog zeigt jetzt mehr: auch Details\n- Fehler behoben: die Liste war leer\nOhne Punkt davor")).toEqual([
      { area: "Fehler behoben", text: "die Liste war leer" },
      { area: null, text: "Der neue Dialog zeigt jetzt mehr: auch Details" },
      { area: null, text: "Ohne Punkt davor" },
    ]);
    expect(changeItems(null)).toEqual([]);
  });

  it("builds the changelog without versions that have no notes", () => {
    const log = toChangelog([
      { tag_name: "v0.1.183", published_at: "2026-11-12T10:35:06Z", html_url: "https://github.com/vanturis/forge/releases/tag/v0.1.183", body: "- Chat: Temporärer Chat" },
      { tag_name: "v0.1.165", body: "" },
      { tag_name: "v0.1.190-dev", prerelease: true, body: "- Dev: etwas" },
    ]);
    expect(log).toEqual([
      { version: "0.1.183", publishedAt: "2026-11-12T10:35:06Z", url: "https://github.com/vanturis/forge/releases/tag/v0.1.183", items: [{ area: "Chat", text: "Temporärer Chat" }] },
    ]);
  });
});
