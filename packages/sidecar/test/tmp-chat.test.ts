import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { TMP_CHAT_TAG } from "@forge/protocol";
import { GitEngine } from "../src/git/git.js";
import { Db } from "../src/persistence/db.js";
import { ProjectManager } from "../src/projects/project-manager.js";
import { tempDir } from "./helpers.js";

let t: ReturnType<typeof tempDir>;
let db: Db;
let dir: string | null;
let pm: ProjectManager;

beforeEach(() => {
  t = tempDir();
  mkdirSync(t.dir, { recursive: true });
  db = new Db(path.join(t.dir, "..", "forge.db"));
  dir = t.dir;
  pm = new ProjectManager(db, new GitEngine(), () => "balanced", () => dir);
});
afterEach(() => {
  db.close();
  t.cleanup();
});

describe("quick chats", () => {
  it("makes a project without git and agents in the subfolder tmp", async () => {
    const p = await pm.tmpChat();
    expect(existsSync(path.join(t.dir, "tmp"))).toBe(true);
    expect(path.basename(p.path)).toBe("tmp");
    expect(p).toMatchObject({ gitEnabled: false, agentsEnabled: false, tags: [TMP_CHAT_TAG] });
  });

  it("uses the same project every time, also when asked twice at once", async () => {
    const [a, b] = await Promise.all([pm.tmpChat(), pm.tmpChat()]);
    const c = await pm.tmpChat();
    expect(a.id).toBe(b.id);
    expect(c.id).toBe(a.id);
    expect(pm.all()).toHaveLength(1);
  });

  it("leaves a project the user keeps in that folder as it is", async () => {
    mkdirSync(path.join(t.dir, "tmp"));
    const own = await pm.import(path.join(t.dir, "tmp"), null, false);
    const p = await pm.tmpChat();
    expect(p.id).toBe(own.id);
    expect(p.tags).not.toContain(TMP_CHAT_TAG);
  });

  it("asks for the folder for new projects when none is set", async () => {
    dir = null;
    await expect(pm.tmpChat()).rejects.toMatchObject({ code: "VALIDATION" });
  });
});
