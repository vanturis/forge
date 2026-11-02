import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExtensionWatch, mcpSection, watchedPaths } from "../src/config/extension-watch.js";

let root: string;
const touch = (p: string, at: number, text = "{}") => {
  mkdirSync(path.dirname(p), { recursive: true });
  writeFileSync(p, text);
  utimesSync(p, at, at);
};

beforeEach(() => {
  root = mkdtempSync(path.join(os.tmpdir(), "forge-watch-"));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("ExtensionWatch", () => {
  const setup = () => {
    const onChange = vi.fn();
    const claudeJson = path.join(root, "claude.json");
    const project = path.join(root, "proj");
    const watch = new ExtensionWatch({ liveDirs: () => [], claudeJson: () => claudeJson, onChange, configDir: path.join(root, "cfg") });
    watch.watch(project);
    return { onChange, claudeJson, project, watch };
  };

  it("stays quiet on the first look and without changes", async () => {
    const { onChange, watch } = setup();
    await watch.check();
    await watch.check();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("notices an installed plugin, a new skill and a project's .mcp.json made outside FORGE", async () => {
    const { onChange, project, watch } = setup();
    await watch.check();
    touch(path.join(root, "cfg", "plugins", "installed_plugins.json"), 1000);
    await watch.check();
    expect(onChange).toHaveBeenCalledTimes(1);
    touch(path.join(root, "cfg", "skills", "neu", "SKILL.md"), 1000);
    await watch.check();
    expect(onChange).toHaveBeenCalledTimes(2);
    touch(path.join(project, ".mcp.json"), 1000);
    await watch.check();
    expect(onChange).toHaveBeenCalledTimes(3);
  });

  it("does not report a folder seen for the first time as a change", async () => {
    const onChange = vi.fn();
    const live = [path.join(root, "a")];
    touch(path.join(live[0]!, ".mcp.json"), 1000);
    const watch = new ExtensionWatch({ liveDirs: () => live, claudeJson: () => path.join(root, "none.json"), onChange, configDir: path.join(root, "cfg") });
    await watch.check();
    live.push(path.join(root, "b"));
    touch(path.join(live[1]!, ".mcp.json"), 1000);
    await watch.check();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("reacts to the server lists of ~/.claude.json, not to the rest of that busy file", async () => {
    const { onChange, claudeJson, watch } = setup();
    touch(claudeJson, 1000, JSON.stringify({ mcpServers: { a: {} }, numStartups: 1 }));
    await watch.check();
    touch(claudeJson, 2000, JSON.stringify({ mcpServers: { a: {} }, numStartups: 2 }));
    await watch.check();
    expect(onChange).not.toHaveBeenCalled();
    touch(claudeJson, 3000, JSON.stringify({ mcpServers: { a: {}, b: {} }, numStartups: 2 }));
    await watch.check();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("takes a change the caller reports itself as known", async () => {
    const { onChange, watch } = setup();
    await watch.check();
    touch(path.join(root, "cfg", "settings.json"), 1000);
    await watch.sync();
    await watch.check();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("lists global and project places without duplicates, and survives a broken config", () => {
    const paths = watchedPaths(["/p", "/p"], "/cfg");
    expect(paths).toContain(path.join("/p", ".mcp.json"));
    expect(paths).toContain(path.join("/cfg", "plugins", "known_marketplaces.json"));
    expect(new Set(paths).size).toBe(paths.length);
    expect(mcpSection("{kaputt")).toBe("");
  });
});
