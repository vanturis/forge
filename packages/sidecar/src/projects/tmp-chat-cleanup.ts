import { lstat, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { TMP_CHAT_TAG, type Project } from "@forge/protocol";
import { TMP_CHAT_DIR } from "./project-manager.js";

export const TMP_CHAT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
/** Not right at launch: the app has enough to do while it starts. */
const FIRST_RUN_MS = 60_000;
const INTERVAL_MS = 6 * 60 * 60 * 1000;

export interface TmpChatCleanupDeps {
  projects: () => Project[];
  sessions: (projectId: string) => Array<{ id: string; updatedAt: string }>;
  isLive: (sessionId: string) => boolean;
  deleteSession: (sessionId: string) => Promise<unknown>;
  changed: (projectId: string) => void;
  now?: () => number;
  log?: (message: string) => void;
}

/** Latest change inside `target`; stops looking once something is newer than `cutoff`. */
async function newestChange(target: string, cutoff: number): Promise<number> {
  const s = await lstat(target);
  // mtime alone is not enough: unpacked archives and copies keep the dates of the original.
  let newest = Math.max(s.mtimeMs, s.ctimeMs, s.birthtimeMs);
  if (newest >= cutoff || !s.isDirectory()) return newest;
  for (const name of await readdir(target)) {
    newest = Math.max(newest, await newestChange(path.join(target, name), cutoff));
    if (newest >= cutoff) break;
  }
  return newest;
}

/** Removes quick chats nobody touched for 30 days, with what they left in the tmp folder. */
export class TmpChatCleanup {
  private first: ReturnType<typeof setTimeout> | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly d: TmpChatCleanupDeps) {}

  start() {
    this.first = setTimeout(() => void this.run(), FIRST_RUN_MS);
    this.first.unref?.();
    this.timer = setInterval(() => void this.run(), INTERVAL_MS);
    this.timer.unref?.();
  }

  stop() {
    if (this.first) clearTimeout(this.first);
    if (this.timer) clearInterval(this.timer);
  }

  async run(): Promise<void> {
    const cutoff = (this.d.now?.() ?? Date.now()) - TMP_CHAT_MAX_AGE_MS;
    // The tag can be typed by hand on any project; the folder name keeps that from emptying a real one.
    for (const p of this.d.projects().filter((x) => x.tags.includes(TMP_CHAT_TAG) && x.exists && path.basename(x.path) === TMP_CHAT_DIR)) {
      try {
        await this.clean(p, cutoff);
      } catch (e) {
        this.d.log?.(`Schnelle Chats: Aufräumen fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  private async clean(p: Project, cutoff: number) {
    const sessions = this.d.sessions(p.id);
    let removed = 0;
    for (const s of sessions) {
      if (new Date(s.updatedAt).getTime() >= cutoff || this.d.isLive(s.id)) continue;
      await this.d.deleteSession(s.id);
      removed++;
    }
    if (removed) this.d.changed(p.id);
    // A running chat may be working on an old file.
    if (sessions.some((s) => this.d.isLive(s.id))) return;
    for (const name of await readdir(p.path)) {
      if (name.startsWith(".")) continue;
      const target = path.join(p.path, name);
      if ((await newestChange(target, cutoff)) < cutoff) await rm(target, { recursive: true, force: true });
    }
  }
}
