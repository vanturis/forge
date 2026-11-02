import { readFile, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

/** Files and folders whose change means Claude Code offers something else: plugins, skills, commands, agents, MCP servers. */
export function watchedPaths(dirs: Iterable<string>, configDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude")): string[] {
  const inConfig = (root: string) => ["settings.json", "settings.local.json", "skills", "commands", "agents"].map((p) => path.join(root, p));
  const out = [
    path.join(configDir, "plugins", "installed_plugins.json"),
    path.join(configDir, "plugins", "known_marketplaces.json"),
    ...inConfig(configDir),
  ];
  for (const d of dirs) out.push(path.join(d, ".mcp.json"), ...inConfig(path.join(d, ".claude")));
  return [...new Set(out)];
}

/** ~/.claude.json changes all the time; only its server lists count. */
export function mcpSection(claudeJson: string): string {
  try {
    const j = JSON.parse(claudeJson) as { mcpServers?: unknown; projects?: Record<string, { mcpServers?: unknown }> };
    const local = Object.entries(j.projects ?? {}).map(([p, v]) => [p, v?.mcpServers ?? null]);
    return JSON.stringify([j.mcpServers ?? null, local]);
  } catch {
    return "";
  }
}

const WATCH_INTERVAL_MS = 10_000;

/**
 * Notices changes made outside FORGE too (a terminal, Claude itself, another tool), so nobody has to
 * restart FORGE for them. Checks modification times only; a path seen for the first time is no change.
 */
export class ExtensionWatch {
  private readonly stamps = new Map<string, number>();
  private readonly dirs = new Set<string>();
  private claudeJsonStamp = -1;
  private servers: string | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly deps: {
      /** folders of running sessions */
      liveDirs: () => string[];
      claudeJson: () => string;
      onChange: () => void;
      configDir?: string;
    },
  ) {}

  /** A folder somebody asked about (its commands, its MCP servers) is watched from now on. */
  watch(dir: string | null | undefined) {
    if (dir) this.dirs.add(dir);
  }

  start() {
    void this.check();
    this.timer = setInterval(() => void this.check(), WATCH_INTERVAL_MS);
    this.timer.unref?.();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Tells about changes since the last look. */
  async check(): Promise<boolean> {
    const changed = await this.scan();
    if (changed) this.deps.onChange();
    return changed;
  }

  /** Takes the current state as known, for a change the caller reports itself. */
  async sync(): Promise<void> {
    await this.scan();
  }

  private async scan(): Promise<boolean> {
    const paths = watchedPaths([...this.dirs, ...this.deps.liveDirs()], this.deps.configDir);
    const seen = await Promise.all(paths.map(async (p) => [p, await stat(p).then((s) => s.mtimeMs, () => 0)] as const));
    let changed = false;
    for (const [p, stamp] of seen) {
      const old = this.stamps.get(p);
      if (old !== undefined && old !== stamp) changed = true;
      this.stamps.set(p, stamp);
    }
    if (await this.serversChanged()) changed = true;
    return changed;
  }

  private async serversChanged(): Promise<boolean> {
    const file = this.deps.claudeJson();
    const stamp = await stat(file).then((s) => s.mtimeMs, () => 0);
    if (stamp === this.claudeJsonStamp) return false;
    this.claudeJsonStamp = stamp;
    const servers = mcpSection(await readFile(file, "utf8").catch(() => ""));
    const before = this.servers;
    this.servers = servers;
    return before !== null && before !== servers;
  }
}
