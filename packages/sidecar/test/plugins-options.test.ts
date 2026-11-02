import { describe, expect, it } from "vitest";
import { parseMarketplaces, parsePluginOptions } from "../src/config/plugins.js";

describe("plugin settings", () => {
  const json = JSON.stringify({
    schema: {
      python: { type: "string", title: "Python", description: "Befehl", default: "python3" },
      guard: { type: "boolean", title: "Guard" },
      account: { type: "string", options: ["auto", "gcloud"] },
      key: { type: "string", title: "API key", sensitive: true, required: true },
    },
    inputs: { python: "python9", guard: "true", account: "auto", key: "geheim" },
    choices: { guard: ["true", "false"], account: ["auto", "gcloud"] },
    configured: ["python", "key"],
    unconfigured: ["guard", "account"],
  });

  it("reads options with choices, and never hands out a secret", () => {
    const o = parsePluginOptions(json);
    expect(o.map((x) => [x.key, x.title, x.value, x.isSet])).toEqual([
      ["python", "Python", "python9", true],
      ["guard", "Guard", "true", false],
      ["account", "account", "auto", false],
      ["key", "API key", "", true],
    ]);
    expect(o[1]!.choices).toEqual(["true", "false"]);
    expect(o[3]).toMatchObject({ sensitive: true, required: true });
    expect(JSON.stringify(o)).not.toContain("geheim");
  });

  it("copes with a plugin without settings", () => {
    expect(parsePluginOptions(JSON.stringify({ schema: {}, inputs: {} }))).toEqual([]);
    expect(() => parsePluginOptions("kein json")).toThrow();
  });

  it("names where a marketplace comes from", () => {
    expect(parseMarketplaces(JSON.stringify([{ name: "a", source: "github", repo: "o/a", installLocation: "/x" }, { name: "b", source: "directory", path: "/p" }, { source: "kaputt" }]))).toEqual([
      { name: "a", source: "github", location: "o/a" },
      { name: "b", source: "directory", location: "/p" },
    ]);
  });
});
