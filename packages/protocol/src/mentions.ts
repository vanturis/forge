/** References to other FORGE projects in a message: "@Name", written by hand or picked in the composer. */
import { TMP_CHAT_TAG } from "./models.js";

export interface MentionTarget {
  id: string;
  name: string;
}

export interface ProjectMention {
  /** position of the "@" */
  start: number;
  /** position after the name */
  end: number;
  projectId: string;
}

/** A mention starts a word: "a@b.de" is an address, not a project. */
const BEFORE = /[\s([{<"'„“‚‘«»,;:]/;
/** What may not follow a name: "@types/node" and "@app-v2" are not the projects "types" and "app". */
const NAME_GOES_ON = /[\p{L}\p{N}_\-/\\]/u;
const WORD = /[\p{L}\p{N}]/u;

/** Projects that can be referred to: main projects with a folder, without the temporary chats. */
export function mentionable<T extends { id: string; parentId: string | null; exists: boolean; tags?: readonly string[] }>(projects: readonly T[], current: { id: string; parentId?: string | null } | null): T[] {
  const own = current ? (current.parentId ?? current.id) : null;
  return projects.filter((p) => !p.parentId && p.exists && p.id !== own && !p.tags?.includes(TMP_CHAT_TAG));
}

export function mentionText(name: string): string {
  return `@${name.trim()}`;
}

/**
 * The project names after an "@" in the text, without regard to case. Names may contain spaces, so the
 * longest name wins ("@Shop Admin" before "@Shop").
 */
export function findProjectMentions(text: string, projects: readonly MentionTarget[]): ProjectMention[] {
  if (!text.includes("@")) return [];
  const byLength = projects
    .map((p) => ({ id: p.id, name: p.name.trim().toLowerCase() }))
    .filter((p) => p.name)
    .sort((a, b) => b.name.length - a.name.length);
  if (!byLength.length) return [];
  const lower = text.toLowerCase();
  const out: ProjectMention[] = [];
  for (let at = text.indexOf("@"); at !== -1; at = text.indexOf("@", at + 1)) {
    if (at > 0 && !BEFORE.test(text[at - 1]!)) continue;
    const hit = byLength.find((p) => {
      if (!lower.startsWith(p.name, at + 1)) return false;
      const end = at + 1 + p.name.length;
      const next = text[end];
      if (next === undefined) return true;
      if (NAME_GOES_ON.test(next)) return false;
      // "@cento." ends a sentence, "@cento.de" is something else.
      return !(next === "." && WORD.test(text[end + 1] ?? ""));
    });
    if (!hit) continue;
    const end = at + 1 + hit.name.length;
    out.push({ start: at, end, projectId: hit.id });
    at = end - 1;
  }
  return out;
}

const QUERY_MAX = 60;

/** The "@…" the caret stands in while it is typed: where it starts and what follows the "@" up to the caret. */
export function mentionQueryAt(text: string, caret: number): { start: number; query: string } | null {
  const upTo = text.slice(0, caret);
  const line = upTo.lastIndexOf("\n") + 1;
  const at = upTo.lastIndexOf("@");
  if (at < line || caret - at - 1 > QUERY_MAX) return null;
  if (at > 0 && !BEFORE.test(text[at - 1]!)) return null;
  const query = upTo.slice(at + 1);
  return /^\s/.test(query) ? null : { start: at, query };
}

/**
 * Projects for the typed query: names that start with it first, then those that contain it. A query
 * that already is a project's name offers nothing, so Enter sends the message instead of picking again.
 */
export function matchMentionTargets<T extends MentionTarget>(query: string, projects: readonly T[], max = 8): T[] {
  const q = query.toLowerCase();
  const named = projects.map((p) => ({ p, name: p.name.trim().toLowerCase() }));
  if (named.some((n) => n.name === q)) return [];
  const starts = named.filter((n) => n.name.startsWith(q));
  const contains = named.filter((n) => !n.name.startsWith(q) && n.name.includes(q));
  return [...starts, ...contains].slice(0, max).map((n) => n.p);
}
