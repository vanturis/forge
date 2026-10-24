import { afterEach, describe, expect, it } from "vitest";
import type { Project } from "@forge/protocol";
import { setLanguage } from "../src/i18n/index.js";
import { forgeSessionTools, type ForgeToolDeps } from "../src/sessions/forge-tools.js";
import type { SessionRecord } from "../src/persistence/db.js";

const project = { id: "p1", parentId: null, exists: false, gitEnabled: true, tags: ["auto-commit"], testCommand: null } as unknown as Project;
const deps = {
  agents: { parent: () => null, children: () => [] },
  projects: { get: () => project, all: () => [project] },
  finisher: { finish: async () => ({ message: "" }) },
} as unknown as ForgeToolDeps;
const rec = { id: "s1", projectId: "p1", cwd: "/tmp/web" } as SessionRecord;

describe("FORGE tools language", () => {
  afterEach(() => setLanguage("de"));

  it("writes the start context and tool descriptions in the set language", async () => {
    setLanguage("en");
    const en = forgeSessionTools(rec, deps);
    expect(en.context).toMatch(/^You are running in FORGE, a desktop interface for Claude Code/);
    expect(en.context).toContain("In this project FORGE itself commits");
    expect(en.tools.find((t) => t.name === "start_agent")?.description).toMatch(/^Starts a parallel agent/);
    expect(await en.tools.find((t) => t.name === "agent_status")!.run({})).toBe("This session has not started any agents.");

    setLanguage("de");
    const de = forgeSessionTools(rec, deps);
    expect(de.context).toMatch(/^Du läufst in FORGE, einer Desktop-Oberfläche für Claude Code/);
    expect(de.tools.find((t) => t.name === "start_agent")?.description).toMatch(/^Startet einen parallelen Agenten/);
  });

  it("stops asking Claude to check the limit when the limit warnings are off", () => {
    const withUsage = (limitWarnings: boolean) =>
      forgeSessionTools(rec, { ...deps, usage: async () => "", db: { getSettings: () => ({ limitWarnings }) } } as unknown as ForgeToolDeps);
    const on = withUsage(true);
    expect(on.context).toContain("vor großem Aufwand (mehrere Agenten, lange Läufe) prüfen");
    const off = withUsage(false);
    expect(off.context).not.toContain("vor großem Aufwand");
    expect(off.context).toContain("prüfe das Limit nicht von dir aus");
    expect(off.tools.find((t) => t.name === "usage_status")?.description).toContain("Nur aufrufen, wenn der Nutzer danach fragt");
  });
});
