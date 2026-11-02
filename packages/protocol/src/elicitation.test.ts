import { describe, expect, it } from "vitest";
import { elicitationContent, elicitationFields, elicitationUrl } from "./elicitation.js";

const input = {
  schema: {
    type: "object",
    required: ["name", "plan"],
    properties: {
      name: { type: "string", title: "Name", description: "Dein Name" },
      plan: { type: "string", oneOf: [{ const: "a", title: "Klein" }, { const: "b", title: "Groß" }] },
      seats: { type: "integer" },
      ratio: { type: "number" },
      agree: { type: "boolean", default: true },
      tags: { type: "array", items: { enum: ["x", "y"] } },
    },
  },
};

describe("elicitation forms", () => {
  it("reads fields in the server's order with kinds, labels and defaults", () => {
    const f = elicitationFields(input);
    expect(f.map((x) => [x.name, x.kind])).toEqual([
      ["name", "text"],
      ["plan", "select"],
      ["seats", "integer"],
      ["ratio", "number"],
      ["agree", "boolean"],
      ["tags", "multiselect"],
    ]);
    expect(f[0]).toMatchObject({ label: "Name", description: "Dein Name", required: true });
    expect(f[1]!.options).toEqual([{ value: "a", label: "Klein" }, { value: "b", label: "Groß" }]);
    expect(f[4]!.initial).toBe("true");
  });

  it("returns no fields without a usable schema", () => {
    expect(elicitationFields({})).toEqual([]);
    expect(elicitationFields({ schema: { properties: 3 } })).toEqual([]);
  });

  it("types the answers and accepts spoken labels", () => {
    const r = elicitationContent(elicitationFields(input), { name: " Ada ", plan: "groß", seats: "3", ratio: "1,5", agree: "nein", tags: "x, y" });
    expect(r).toEqual({ content: { name: "Ada", plan: "b", seats: 3, ratio: 1.5, agree: false, tags: ["x", "y"] }, missing: [], invalid: [] });
  });

  it("names empty required fields and text that does not fit", () => {
    const r = elicitationContent(elicitationFields(input), { plan: "mittel", seats: "1.5", agree: "vielleicht", tags: "z" });
    expect(r.missing).toEqual(["Name"]);
    expect(r.invalid).toEqual(["plan", "seats", "agree", "tags"]);
  });

  it("opens only web addresses", () => {
    expect(elicitationUrl("https://example.com/a")).toBe("https://example.com/a");
    expect(elicitationUrl("file:///etc/passwd")).toBeNull();
    expect(elicitationUrl("javascript:alert(1)")).toBeNull();
    expect(elicitationUrl("kein link")).toBeNull();
    expect(elicitationUrl(undefined)).toBeNull();
  });
});
