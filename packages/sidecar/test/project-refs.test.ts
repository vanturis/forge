import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import type { Project, SessionEventBody } from "@forge/protocol";
import { setLanguage } from "../src/i18n/index.js";
import type { KnowledgeStore } from "../src/knowledge/knowledge.js";
import { readsInside } from "../src/policy/guard.js";
import { listProjectsTool, mentionedDirs, mentionNote } from "../src/sessions/project-refs.js";

const root = mkdtempSync(path.join(os.tmpdir(), "forge-refs-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));

const dir = (name: string) => path.join(root, name);
const project = (id: string, name: string, over: Partial<Project> = {}): Project =>
  ({ id, name, path: dir(id), parentId: null, exists: true, tags: [], technologies: [], group: null, ...over }) as Project;

const web = project("web", "web");
const cento = project("cento", "cento", { technologies: ["Next.js", "TypeScript"], group: "Kunden" });
const shop = project("shop", "Shop Admin");
const worktree = project("web-wt", "web · agent/x", { parentId: "web" });
const gone = project("gone", "alt", { exists: false });
mkdirSync(path.join(cento.path, ".forge", "knowledge"), { recursive: true });

const projectsOf = (list: Project[]) => ({
  all: () => list,
  get: (id: string) => {
    const p = list.find((x) => x.id === id);
    if (!p) throw new Error("unknown project");
    return p;
  },
});
const projects = projectsOf([web, cento, shop, worktree, gone]);

describe("mentionNote", () => {
  afterEach(() => setLanguage("de"));

  it("names folder, stack and knowledge of a mentioned project", () => {
    const note = mentionNote(projects, "web", "Übernimm das Design aus @cento.")!;
    expect(note).toMatch(/^\[FORGE-Hinweis, nicht vom Nutzer geschrieben\]/);
    expect(note).toContain(`- @cento: Ordner ${cento.path}, Technik: Next.js, TypeScript, Projektwissen in ${path.join(cento.path, ".forge", "knowledge")}`);
    expect(note).toContain("Ändere in diesen Projekten nichts");
  });

  it("is written in the set language", () => {
    setLanguage("en");
    expect(mentionNote(projects, "web", "like @Shop Admin")).toMatch(/^\[FORGE note, not written by the user\][\s\S]*- @Shop Admin: folder /);
  });

  it("is null without a mention of another project", () => {
    expect(mentionNote(projects, "web", "wie im Projekt cento")).toBeNull();
    expect(mentionNote(projects, "web", "siehe @web und @alt und info@cento.de")).toBeNull();
    // A worktree session does not refer to its own main project.
    expect(mentionNote(projects, "web-wt", "siehe @web")).toBeNull();
  });

  it("says that the folders stay closed in a project confined to its files", () => {
    const confined = projectsOf([{ ...web, tags: ["project-files-only"] }, cento]);
    const note = mentionNote(confined, "web", "aus @cento")!;
    expect(note).toContain("project-files-only");
    expect(note).not.toContain(cento.path);
  });
});

describe("mentionedDirs", () => {
  const db = (messages: Array<Partial<Extract<SessionEventBody, { type: "user.message" }>>>) => ({
    getSession: (id: string) => (id === "s1" ? ({ id, projectId: "web" } as never) : null),
    listRecentUserMessages: () => messages.map((m) => ({ type: "user.message" as const, text: "", ...m })) as never,
  });

  it("returns the folders of the projects the user mentioned", () => {
    expect(mentionedDirs(db([{ text: "weiter" }, { text: "wie in @cento und @Shop Admin" }]), projects, "s1")).toEqual([cento.path, shop.path]);
  });

  it("ignores automatic messages and answers of agents", () => {
    expect(mentionedDirs(db([{ text: "@cento", source: "auto" }, { text: "@cento", agents: [] }]), projects, "s1")).toEqual([]);
  });

  it("is empty for an unknown session", () => {
    expect(mentionedDirs(db([{ text: "@cento" }]), projects, "nope")).toEqual([]);
  });
});

describe("readsInside", () => {
  const dirs = [cento.path];

  it("accepts reads and searches rooted in the folder", () => {
    expect(readsInside("Read", { file_path: path.join(cento.path, "src", "app.css") }, web.path, dirs)).toBe(true);
    expect(readsInside("Grep", { pattern: "color", path: cento.path, glob: "**/*.css" }, web.path, dirs)).toBe(true);
    expect(readsInside("Glob", { pattern: "**/*.tsx", path: path.join(cento.path, "src") }, web.path, dirs)).toBe(true);
  });

  it("refuses other folders, writes and globs that leave the root", () => {
    expect(readsInside("Read", { file_path: path.join(shop.path, "a.ts") }, web.path, dirs)).toBe(false);
    expect(readsInside("Read", { file_path: path.join(cento.path, "..", "shop", "a.ts") }, web.path, dirs)).toBe(false);
    expect(readsInside("Write", { file_path: path.join(cento.path, "a.ts"), content: "" }, web.path, dirs)).toBe(false);
    expect(readsInside("Glob", { pattern: path.join(shop.path, "**"), path: cento.path }, web.path, dirs)).toBe(false);
    expect(readsInside("Glob", { pattern: "../shop/**", path: cento.path }, web.path, dirs)).toBe(false);
    expect(readsInside("Grep", { pattern: "x" }, web.path, dirs)).toBe(false);
    expect(readsInside("Read", { file_path: path.join(cento.path, "a.ts") }, web.path, [])).toBe(false);
  });
});

describe("list_projects", () => {
  const knowledge = { index: () => ({ lines: ["- design-tokens: Design-Tokens [ui]"], total: 1, summaries: false }) } as unknown as KnowledgeStore;
  const tool = listProjectsTool(projects, "web", knowledge);

  it("lists the other main projects with their folders", async () => {
    const text = (await tool.run({})) as string;
    expect(text).toMatch(/^2 andere Projekte in FORGE:/);
    expect(text).toContain(`- cento (Gruppe Kunden): ${cento.path}, Next.js, TypeScript`);
    expect(text).toContain(`- Shop Admin: ${shop.path}`);
    expect(text).not.toContain("agent/x");
    expect(text).not.toContain(gone.path);
  });

  it("gives folder and knowledge index of one project, found by an approximate name", async () => {
    const text = (await tool.run({ name: "@Cento" })) as string;
    expect(text).toContain(`Projekt cento (Gruppe Kunden)\nOrdner: ${cento.path}`);
    expect(text).toContain("- design-tokens: Design-Tokens [ui]");
    expect(await tool.run({ name: "shopadmin" })).toContain(`Ordner: ${shop.path}`);
  });

  it("names what exists when nothing matches", async () => {
    expect(await tool.run({ name: "nimbus" })).toBe("Kein Projekt „nimbus“ gefunden. Vorhanden: cento, Shop Admin.");
  });

  it("says so when there is no other project", async () => {
    expect(await listProjectsTool(projectsOf([web]), "web", null).run({})).toBe("In FORGE gibt es keine anderen Projekte.");
  });
});
