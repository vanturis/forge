import { describe, expect, it, vi } from "vitest";
import type { ServerEvent } from "@forge/protocol";
import type { McpLogin } from "../src/claude/runtime.js";
import { McpLoginService } from "../src/config/mcp-login.js";

function setup(url: string | null = "https://login.example.com/a") {
  const events: ServerEvent[] = [];
  const connected = vi.fn();
  let done: (ok: boolean) => void = () => {};
  const logins: Array<McpLogin & { cancel: ReturnType<typeof vi.fn> }> = [];
  const start = vi.fn(async () => {
    const login = { url, finished: new Promise<boolean>((r) => (done = r)), cancel: vi.fn() };
    logins.push(login);
    return login;
  });
  const service = new McpLoginService({ start, emit: (e) => events.push(e), connected });
  const states = () => events.flatMap((e) => (e.event === "mcp.login" ? [e.payload.state] : []));
  return { service, connected, states, logins, finish: (ok: boolean) => done(ok), events };
}

describe("McpLoginService", () => {
  it("hands the page out, and connects running sessions once the browser is through", async () => {
    const t = setup();
    expect(await t.service.start("/p", "crm")).toEqual({ url: "https://login.example.com/a" });
    expect(t.states()).toEqual(["waiting"]);
    t.finish(true);
    await vi.waitFor(() => expect(t.states()).toEqual(["waiting", "done"]));
    expect(t.connected).toHaveBeenCalledWith("crm");
  });

  it("reports when the time ran out", async () => {
    const t = setup();
    await t.service.start("/p", "crm");
    t.finish(false);
    await vi.waitFor(() => expect(t.states()).toEqual(["waiting", "expired"]));
    expect(t.connected).not.toHaveBeenCalled();
  });

  it("needs no page for a connected server", async () => {
    const t = setup(null);
    expect(await t.service.start("/p", "crm")).toEqual({ url: null });
    expect(t.states()).toEqual(["done"]);
  });

  it("cancels, and a new try replaces the waiting one", async () => {
    const t = setup();
    await t.service.start("/p", "crm");
    await t.service.start("/p", "crm");
    expect(t.logins[0]!.cancel).toHaveBeenCalled();
    expect(t.states()).toEqual(["waiting", "cancelled", "waiting"]);
    expect(t.service.cancel("crm")).toEqual({ ok: true });
    expect(t.service.cancel("crm")).toEqual({ ok: false });
  });

  it("leaves the failure to the caller", async () => {
    const service = new McpLoginService({ start: async () => { throw new Error("abgelehnt"); }, emit: () => {}, connected: () => {} });
    await expect(service.start("/p", "crm")).rejects.toThrow("abgelehnt");
  });
});
