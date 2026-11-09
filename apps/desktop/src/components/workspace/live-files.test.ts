import { describe, expect, it } from "vitest";
import type { SessionEvent } from "@forge/protocol";
import { lineOfEdit, liveFiles } from "./live-files";

let seq = 0;
const ev = (body: unknown) => ({ seq: ++seq, ts: "", body }) as unknown as SessionEvent;
const use = (id: string, name: string, input: Record<string, unknown>) => ev({ type: "tool.use", toolUseId: id, name, input, parentToolUseId: null });
const done = (id: string, isError = false) => ev({ type: "tool.result", toolUseId: id, isError, content: { text: "", truncated: false } });

describe("liveFiles", () => {
  it("lists edited files inside the project, newest edit first", () => {
    const list = liveFiles(
      [use("a", "Edit", { file_path: "/p/src/a.ts", new_string: "x" }), done("a"), use("r", "Read", { file_path: "/p/src/r.ts" }), done("r"), use("w", "Write", { file_path: "/p/b.ts", content: "y" }), use("o", "Write", { file_path: "/other/c.ts" })],
      "/p",
    );
    expect(list.map((f) => [f.path, f.status])).toEqual([
      ["b.ts", "editing"],
      ["src/a.ts", "done"],
    ]);
  });

  it("gets a new version per finished edit and keeps it while the next one runs", () => {
    const first = [use("a", "Edit", { file_path: "a.ts", new_string: "eins" }), done("a")];
    const before = liveFiles(first, "/p")[0]!;
    const running = liveFiles([...first, use("b", "Edit", { file_path: "a.ts", new_string: "zwei" })], "/p")[0]!;
    expect(running.status).toBe("editing");
    expect(running.needle).toBe("zwei");
    expect(running.version).toBe(before.version);
    const after = liveFiles([...first, use("c", "Edit", { file_path: "a.ts", new_string: "drei" }), done("c")], "/p")[0]!;
    expect(after.version).toBeGreaterThan(before.version);
  });

  it("does not count a failed edit as a new version", () => {
    const list = liveFiles([use("a", "Edit", { file_path: "a.ts", new_string: "x" }), done("a", true)], "/p");
    expect(list[0]).toMatchObject({ status: "failed", version: 0 });
  });

  it("takes the last change of a MultiEdit", () => {
    const list = liveFiles([use("m", "MultiEdit", { file_path: "a.ts", edits: [{ new_string: "eins" }, { new_string: "zwei" }] })], "/p");
    expect(list[0]!.needle).toBe("zwei");
  });
});

describe("lineOfEdit", () => {
  it("finds the line of the new text", () => {
    expect(lineOfEdit("eins\nzwei\ndrei", "drei")).toBe(3);
    expect(lineOfEdit("eins", "fehlt")).toBeNull();
    expect(lineOfEdit("eins", null)).toBeNull();
  });
});
