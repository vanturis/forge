import { describe, expect, it } from "vitest";
import type { SessionEvent } from "@forge/protocol";
import { latestEditedFile, lineOfEdit } from "./latest-file";

let seq = 0;
const ev = (body: unknown) => ({ seq: ++seq, ts: "", body }) as unknown as SessionEvent;
const use = (id: string, name: string, input: Record<string, unknown>) => ev({ type: "tool.use", toolUseId: id, name, input, parentToolUseId: null });
const done = (id: string, isError = false) => ev({ type: "tool.result", toolUseId: id, isError, content: { text: "", truncated: false } });

describe("latestEditedFile", () => {
  it("takes the newest edit inside the project and ignores reads and other folders", () => {
    const file = latestEditedFile([use("a", "Edit", { file_path: "/p/src/a.ts", new_string: "x" }), done("a"), use("w", "Write", { file_path: "/p/b.ts", content: "y" }), done("w"), use("r", "Read", { file_path: "/p/r.ts" }), done("r"), use("o", "Write", { file_path: "/other/c.ts" })], "/p");
    expect(file).toMatchObject({ path: "b.ts", status: "done" });
  });

  it("has no file before the first edit", () => {
    expect(latestEditedFile([use("r", "Read", { file_path: "/p/r.ts" })], "/p")).toBeNull();
  });

  it("keeps the last version while the next edit of the file runs", () => {
    const first = [use("a", "Edit", { file_path: "a.ts", new_string: "eins" }), done("a")];
    const before = latestEditedFile(first, "/p")!;
    const running = latestEditedFile([...first, use("b", "Edit", { file_path: "a.ts", new_string: "zwei" })], "/p")!;
    expect(running).toMatchObject({ status: "editing", needle: "zwei", version: before.version });
    const after = latestEditedFile([...first, use("c", "Edit", { file_path: "a.ts", new_string: "drei" }), done("c")], "/p")!;
    expect(after.version).toBeGreaterThan(before.version);
  });

  it("does not count a failed edit as a new version", () => {
    expect(latestEditedFile([use("a", "Edit", { file_path: "a.ts", new_string: "x" }), done("a", true)], "/p")).toMatchObject({ status: "failed", version: 0 });
  });

  it("takes the last change of a MultiEdit", () => {
    expect(latestEditedFile([use("m", "MultiEdit", { file_path: "a.ts", edits: [{ new_string: "eins" }, { new_string: "zwei" }] })], "/p")!.needle).toBe("zwei");
  });
});

describe("lineOfEdit", () => {
  it("finds the line of the new text", () => {
    expect(lineOfEdit("eins\nzwei\ndrei", "drei")).toBe(3);
    expect(lineOfEdit("eins", "fehlt")).toBeNull();
    expect(lineOfEdit("eins", null)).toBeNull();
  });
});
