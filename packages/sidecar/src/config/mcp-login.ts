import type { ServerEvent } from "@forge/protocol";
import type { McpLogin } from "../claude/runtime.js";

interface Deps {
  start: (cwd: string, name: string) => Promise<McpLogin>;
  emit: (e: ServerEvent) => void;
  /** the login went through: running sessions connect the server */
  connected: (name: string) => void;
}

/**
 * Sign-in at an MCP server without a terminal: `claude mcp login` refuses without one, so FORGE asks a
 * short-lived CLI process for the page. That process receives the callback, so it stays until the end.
 */
export class McpLoginService {
  private readonly active = new Map<string, McpLogin>();

  constructor(private readonly deps: Deps) {}

  async start(cwd: string, name: string): Promise<{ url: string | null }> {
    this.cancel(name);
    const login = await this.deps.start(cwd, name);
    if (!login.url) {
      login.cancel();
      this.deps.connected(name);
      this.deps.emit({ event: "mcp.login", payload: { name, state: "done", url: null } });
      return { url: null };
    }
    this.active.set(name, login);
    this.deps.emit({ event: "mcp.login", payload: { name, state: "waiting", url: login.url } });
    void login.finished.then((ok) => {
      if (this.active.get(name) !== login) return;
      this.active.delete(name);
      if (ok) this.deps.connected(name);
      this.deps.emit({ event: "mcp.login", payload: { name, state: ok ? "done" : "expired", url: null } });
    });
    return { url: login.url };
  }

  cancel(name: string) {
    const login = this.active.get(name);
    if (!login) return { ok: false };
    this.active.delete(name);
    login.cancel();
    this.deps.emit({ event: "mcp.login", payload: { name, state: "cancelled", url: null } });
    return { ok: true };
  }

  stopAll() {
    for (const l of this.active.values()) l.cancel();
    this.active.clear();
  }
}
