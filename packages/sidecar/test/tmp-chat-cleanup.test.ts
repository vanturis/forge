import { existsSync, mkdirSync, utimesSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TMP_CHAT_TAG, type Project } from "@forge/protocol";
import { TMP_CHAT_MAX_AGE_MS, TmpChatCleanup } from "../src/projects/tmp-chat-cleanup.js";
import { tempDir } from "./helpers.js";

const DAY = 24 * 60 * 60 * 1000;
let t: ReturnType<typeof tempDir>;
let tmp: string;
let live: Set<string>;
const later = () => Date.now() + TMP_CHAT_MAX_AGE_MS + DAY;
const fresh = (file: string) => utimesSync(file, new Date(later()), new Date(later()));
const iso = (ms: number) => new Date(ms).toISOString();

function cleanup(sessions: Array<{ id: string; updatedAt: string }>, project: Partial<Project> = {}) {
  const deleteSession = vi.fn(async () => undefined);
  const job = new TmpChatCleanup({
    projects: () => [{ id: "p", path: tmp, exists: true, tags: [TMP_CHAT_TAG], ...project } as Project],
    sessions: () => sessions,
    isLive: (id) => live.has(id),
    deleteSession,
    changed: () => {},
    now: later,
  });
  return { job, deleteSession };
}

beforeEach(() => {
  t = tempDir();
  tmp = path.join(t.dir, "tmp");
  mkdirSync(tmp, { recursive: true });
  live = new Set();
});
afterEach(() => t.cleanup());

describe("quick chat cleanup", () => {
  it("deletes sessions older than 30 days and keeps newer and running ones", async () => {
    const { job, deleteSession } = cleanup([
      { id: "old", updatedAt: iso(Date.now() - DAY) },
      { id: "new", updatedAt: iso(later() - DAY) },
      { id: "running", updatedAt: iso(Date.now() - DAY) },
    ]);
    live.add("running");
    await job.run();
    expect(deleteSession.mock.calls).toEqual([["old"]]);
  });

  it("removes old entries of the folder, keeps recent ones and dot folders", async () => {
    writeFileSync(path.join(tmp, "old.txt"), "x");
    writeFileSync(path.join(tmp, "new.txt"), "x");
    fresh(path.join(tmp, "new.txt"));
    mkdirSync(path.join(tmp, "dir"));
    writeFileSync(path.join(tmp, "dir", "new.txt"), "x");
    fresh(path.join(tmp, "dir", "new.txt"));
    mkdirSync(path.join(tmp, ".forge"));
    await cleanup([]).job.run();
    expect(existsSync(path.join(tmp, "old.txt"))).toBe(false);
    expect(existsSync(path.join(tmp, "new.txt"))).toBe(true);
    expect(existsSync(path.join(tmp, "dir", "new.txt"))).toBe(true);
    expect(existsSync(path.join(tmp, ".forge"))).toBe(true);
  });

  it("leaves the folder alone while a chat runs", async () => {
    writeFileSync(path.join(tmp, "old.txt"), "x");
    live.add("running");
    await cleanup([{ id: "running", updatedAt: iso(later()) }]).job.run();
    expect(existsSync(path.join(tmp, "old.txt"))).toBe(true);
  });

  it("does not touch a project that only carries the tag", async () => {
    const own = path.join(t.dir, "shop");
    mkdirSync(own);
    writeFileSync(path.join(own, "old.txt"), "x");
    await cleanup([], { path: own }).job.run();
    expect(existsSync(path.join(own, "old.txt"))).toBe(true);
  });
});
