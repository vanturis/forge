import type { SessionEvent } from "@forge/protocol";
import { pathInside } from "@/lib/platform";

const EDIT_TOOLS = new Set(["Write", "Edit", "MultiEdit", "NotebookEdit"]);

export interface LatestFile {
  /** relative to the project, with forward slashes */
  path: string;
  /** state of the latest edit */
  status: "editing" | "done" | "failed";
  /** seq of the latest successful edit, 0 before the first: the file on disk changed when this does */
  version: number;
  /** text the latest edit put in, to find its place in the file; null for a whole file */
  needle: string | null;
}

function projectPath(raw: string, root: string): string | null {
  const absolute = /^([a-z]:[\\/]|[\\/])/i.test(raw);
  const rel = absolute ? pathInside(raw, root) : raw.replace(/\\/g, "/").replace(/^\.\//, "");
  return rel && !rel.startsWith("../") ? rel : null;
}

function needleOf(input: Record<string, unknown>): string | null {
  const edits = input.edits;
  const last = Array.isArray(edits) ? (edits[edits.length - 1] as { new_string?: unknown } | undefined)?.new_string : input.new_string;
  return typeof last === "string" && last ? last : null;
}

/** The file Claude edited last in this session; files outside the project cannot be read through it and are skipped. */
export function latestEditedFile(events: readonly SessionEvent[], root: string): LatestFile | null {
  let file: LatestFile | null = null;
  // Going backwards, a call's result comes before the call.
  const results = new Map<string, { isError: boolean; seq: number }>();
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i]!;
    const b = e.body;
    if (b.type === "tool.result") {
      results.set(b.toolUseId, { isError: b.isError, seq: e.seq });
      continue;
    }
    if (b.type !== "tool.use" || !EDIT_TOOLS.has(b.name)) continue;
    const raw = b.input.file_path ?? b.input.notebook_path;
    const path = typeof raw === "string" ? projectPath(raw, root) : null;
    if (!path || (file && file.path !== path)) continue;
    const result = results.get(b.toolUseId);
    const version = result && !result.isError ? result.seq : 0;
    if (!file) file = { path, status: !result ? "editing" : result.isError ? "failed" : "done", version, needle: needleOf(b.input) };
    else file.version = version;
    if (file.version) break;
  }
  return file;
}

/** 1-based line where the edit's text starts, null if there is no such text. */
export function lineOfEdit(content: string, needle: string | null): number | null {
  if (!needle) return null;
  const at = content.indexOf(needle);
  return at < 0 ? null : content.slice(0, at).split("\n").length;
}
