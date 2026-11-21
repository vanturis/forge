import { existsSync } from "node:fs";
import path from "node:path";
import { findProjectMentions, mentionable, type Project } from "@forge/protocol";
import { z } from "zod";
import type { SessionTool } from "../claude/runtime.js";
import { KNOWLEDGE_DIR, type KnowledgeStore } from "../knowledge/knowledge.js";
import type { Db } from "../persistence/db.js";
import { PROJECT_FILES_ONLY_TAG } from "../policy/profiles.js";
import type { ProjectManager } from "../projects/project-manager.js";
import { tr } from "../i18n/index.js";

/** How far back the messages of a session are read for mentions; older ones no longer open a folder. */
const MENTION_HISTORY = 300;

type Projects = Pick<ProjectManager, "all" | "get">;

/** Other projects of the user a session in `projectId` can refer to. */
export function otherProjects(projects: Projects, projectId: string): Project[] {
  return mentionable(projects.all(), projects.get(projectId));
}

/** The projects a text mentions with "@Name", each once, in the order they appear. */
export function mentionedProjects(text: string, candidates: Project[]): Project[] {
  const ids = [...new Set(findProjectMentions(text, candidates).map((m) => m.projectId))];
  return ids.flatMap((id) => candidates.find((p) => p.id === id) ?? []);
}

function knowledgeDir(p: Project): string | null {
  const dir = path.join(p.path, KNOWLEDGE_DIR);
  return existsSync(dir) ? dir : null;
}

/**
 * What Claude reads before a message that mentions other projects: where they lie. null without a
 * mention. In a project confined to its own files the note says that the folders stay closed.
 */
export function mentionNote(projects: Projects, projectId: string, text: string): string | null {
  if (!text.includes("@")) return null;
  const hits = mentionedProjects(text, otherProjects(projects, projectId));
  if (!hits.length) return null;
  const m = tr().core.forgeTools;
  if (projects.get(projectId).tags.includes(PROJECT_FILES_ONLY_TAG)) return m.mentionNoteConfined(hits.map((p) => p.name).join(", "));
  return m.mentionNote(hits.map((p) => m.mentionLine(p.name, p.path, p.technologies.join(", "), knowledgeDir(p))).join("\n"));
}

/**
 * Folders of the projects the user mentioned in this session. Reading there needs no approval: the
 * mention is the user's go-ahead. Taken from the stored messages, so it holds after a restart too.
 */
export function mentionedDirs(db: Pick<Db, "getSession" | "listRecentUserMessages">, projects: Projects, sessionId: string): string[] {
  const rec = db.getSession(sessionId);
  if (!rec) return [];
  let candidates: Project[];
  try {
    candidates = otherProjects(projects, rec.projectId);
  } catch {
    return [];
  }
  if (!candidates.length) return [];
  const text = db
    .listRecentUserMessages(sessionId, MENTION_HISTORY)
    // Only what the user wrote: an agent's answer or an automatic message opens no folder.
    .filter((b) => b.source !== "auto" && !b.task && !b.agents)
    .map((b) => b.text)
    .filter((t) => t.includes("@"))
    .join("\n");
  return mentionedProjects(text, candidates).map((p) => p.path);
}

/** Finds a project by the name Claude or the user gave: exact first, then as part of the name. */
function byName(candidates: Project[], name: string): Project[] {
  const q = name.trim().replace(/^@/, "").toLowerCase();
  const exact = candidates.filter((p) => p.name.trim().toLowerCase() === q);
  if (exact.length) return exact;
  const squash = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  return candidates.filter((p) => p.name.toLowerCase().includes(q) || (squash(q) && squash(p.name).includes(squash(q))));
}

/** list_projects: the user's other projects in FORGE, so "like in project cento" leads to a folder. */
export function listProjectsTool(projects: Projects, projectId: string, knowledge: KnowledgeStore | null): SessionTool {
  const m = tr().core.forgeTools;
  const line = (p: Project) => m.projectLine(p.name, p.group, p.path, p.technologies.join(", "));
  return {
    name: "list_projects",
    description: m.listProjectsDescription,
    shape: { name: z.string().max(120).optional().describe(m.listProjectsName) },
    autoAllow: true,
    run: async (a) => {
      const all = otherProjects(projects, projectId);
      if (!all.length) return m.noOtherProjects;
      const name = typeof a.name === "string" && a.name.trim() ? a.name : null;
      if (!name) return m.projectList(all.length, all.map(line).join("\n"));
      const hits = byName(all, name);
      if (!hits.length) return m.projectNotFound(name.trim(), all.map((p) => p.name).join(", "));
      if (hits.length > 1) return m.projectAmbiguous(name.trim(), hits.map(line).join("\n"));
      const p = hits[0]!;
      const dir = knowledgeDir(p);
      let index: { lines: string[]; total: number } = { lines: [], total: 0 };
      try {
        if (dir && knowledge) index = knowledge.index(p.id);
      } catch {
        // The folder and stack are still worth having when the knowledge cannot be read.
      }
      return [
        m.projectDetails(p.name, p.group, p.path, p.technologies.join(", ")),
        dir && index.lines.length ? m.projectKnowledge(dir, index.total, index.lines.join("\n")) : "",
        m.projectReadHint,
      ]
        .filter(Boolean)
        .join("\n");
    },
  };
}
