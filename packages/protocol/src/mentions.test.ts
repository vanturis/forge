import { describe, expect, it } from "vitest";
import { findProjectMentions, matchMentionTargets, mentionable, mentionQueryAt } from "./mentions.js";

const projects = [
  { id: "c", name: "cento" },
  { id: "s", name: "Shop" },
  { id: "sa", name: "Shop Admin" },
  { id: "t", name: "types" },
];

describe("findProjectMentions", () => {
  it("finds a name after @, whatever its case", () => {
    const text = "Übernimm das Design aus @Cento.";
    const [m] = findProjectMentions(text, projects);
    expect(m).toEqual({ start: 24, end: 30, projectId: "c" });
    expect(text.slice(m!.start, m!.end)).toBe("@Cento");
  });

  it("takes the longest name", () => {
    expect(findProjectMentions("wie in @Shop Admin und @shop", projects).map((m) => m.projectId)).toEqual(["sa", "s"]);
  });

  it("leaves addresses, packages and longer words alone", () => {
    expect(findProjectMentions("mail an info@cento.de", projects)).toEqual([]);
    expect(findProjectMentions("installiere @types/node", projects)).toEqual([]);
    expect(findProjectMentions("siehe @cento-v2 und @centos", projects)).toEqual([]);
    expect(findProjectMentions("seite @cento.de", projects)).toEqual([]);
  });

  it("accepts punctuation around the mention", () => {
    expect(findProjectMentions("(@cento), „@shop“: gut", projects).map((m) => m.projectId)).toEqual(["c", "s"]);
  });

  it("finds nothing without projects or @", () => {
    expect(findProjectMentions("@cento", [])).toEqual([]);
    expect(findProjectMentions("cento", projects)).toEqual([]);
  });
});

describe("mentionQueryAt", () => {
  it("returns what is typed after the @ up to the caret", () => {
    expect(mentionQueryAt("aus @ce", 7)).toEqual({ start: 4, query: "ce" });
    expect(mentionQueryAt("@", 1)).toEqual({ start: 0, query: "" });
    expect(mentionQueryAt("aus @Shop Ad", 12)).toEqual({ start: 4, query: "Shop Ad" });
  });

  it("is null outside a mention", () => {
    expect(mentionQueryAt("aus cento", 9)).toBeNull();
    expect(mentionQueryAt("info@ce", 7)).toBeNull();
    expect(mentionQueryAt("@cento\nweiter", 13)).toBeNull();
    expect(mentionQueryAt("@ cento", 7)).toBeNull();
  });
});

describe("matchMentionTargets", () => {
  it("puts names that start with the query first", () => {
    expect(matchMentionTargets("s", projects).map((p) => p.id)).toEqual(["s", "sa", "t"]);
  });

  it("offers nothing once the name is complete", () => {
    expect(matchMentionTargets("cento", projects)).toEqual([]);
    expect(matchMentionTargets("shop a", projects).map((p) => p.id)).toEqual(["sa"]);
  });

  it("offers nothing for text that goes on after a name", () => {
    expect(matchMentionTargets("cento und", projects)).toEqual([]);
  });
});

describe("mentionable", () => {
  const base = { exists: true, tags: [] as string[] };
  const all = [
    { ...base, id: "a", parentId: null },
    { ...base, id: "a-wt", parentId: "a" },
    { ...base, id: "b", parentId: null },
    { ...base, id: "gone", parentId: null, exists: false },
    { ...base, id: "tmp", parentId: null, tags: ["tmp-chat"] },
  ];

  it("keeps other main projects with a folder", () => {
    expect(mentionable(all, { id: "a", parentId: null }).map((p) => p.id)).toEqual(["b"]);
  });

  it("leaves out the project of a worktree session", () => {
    expect(mentionable(all, { id: "a-wt", parentId: "a" }).map((p) => p.id)).toEqual(["b"]);
  });
});
