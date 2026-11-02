import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { MarketplacePlugin, PluginOption } from "@forge/protocol";
import type * as RpcModuleNs from "@/lib/rpc";

const callMock = vi.fn();
const openExternal = vi.fn(async (_url: string) => {});
vi.mock("@/lib/rpc", async (orig) => ({ ...(await orig<typeof RpcModuleNs>()), rpc: { call: (...a: unknown[]) => callMock(...a), subscribe: () => () => {} } }));
vi.mock("@/lib/native", async (orig) => ({ ...(await orig<object>()), openExternal: (u: string) => openExternal(u) }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const { McpLoginButton } = await import("./McpLogin");
const { McpTab, shownName } = await import("./McpTab");
const { changedValues, PluginOptionsDialog } = await import("./PluginOptionsDialog");
const { useMcpLogin } = await import("@/stores/mcp-login");

const show = (ui: React.ReactNode) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <TooltipProvider>{ui}</TooltipProvider>
    </QueryClientProvider>,
  );

const option = (o: Partial<PluginOption>): PluginOption => ({ key: "k", title: "K", description: null, type: "string", sensitive: false, required: false, value: "", isSet: false, choices: [], ...o });

beforeEach(() => {
  callMock.mockReset();
  openExternal.mockClear();
  useMcpLogin.setState({ waiting: {} });
});
afterEach(cleanup);

describe("sign-in at an MCP server", () => {
  it("starts the sign-in, then offers the page again and a way out", async () => {
    callMock.mockResolvedValue({ url: "https://l.example.com", ok: true });
    show(<McpLoginButton name="plugin:stripe:stripe" projectId="p1" />);
    fireEvent.click(screen.getByRole("button", { name: "Anmelden" }));
    await waitFor(() => expect(callMock).toHaveBeenCalledWith("mcp.login", { name: "plugin:stripe:stripe", projectId: "p1" }));
    act(() => useMcpLogin.getState().setWaiting("plugin:stripe:stripe", "https://l.example.com"));
    fireEvent.click(screen.getByRole("button", { name: "Anmeldeseite erneut öffnen" }));
    expect(openExternal).toHaveBeenCalledWith("https://l.example.com");
    fireEvent.click(screen.getByRole("button", { name: "Anmeldung abbrechen" }));
    expect(callMock).toHaveBeenCalledWith("mcp.loginCancel", { name: "plugin:stripe:stripe" });
  });

  it("shows servers of plugins by their short name, with sign-in but without edit and remove", async () => {
    callMock.mockImplementation(async (m: string) =>
      m === "mcp.list" ? [{ name: "plugin:stripe:stripe", target: "https://mcp.stripe.com (HTTP)", status: "needs_auth", statusText: "Needs authentication", origin: "plugin", remote: true }] : null,
    );
    show(<McpTab />);
    expect(await screen.findByText("stripe")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Anmelden" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /entfernen/ })).toBeNull();
    expect(shownName({ name: "claude.ai Trello", origin: "claude.ai" })).toBe("Trello");
    expect(shownName({ name: "lokal" })).toBe("lokal");
  });
});

describe("plugin settings", () => {
  it("sends only what changed, and an empty secret keeps the stored one", () => {
    const options = [option({ key: "a", value: "1" }), option({ key: "b", value: "2" }), option({ key: "s", sensitive: true, isSet: true })];
    expect(changedValues(options, { a: "1", b: "3", s: "" })).toEqual({ b: "3" });
    expect(changedValues(options, { a: "1", b: "2", s: "neu" })).toEqual({ s: "neu" });
  });

  it("loads, edits and saves", async () => {
    const plugin = { id: "x@y", name: "x" } as MarketplacePlugin;
    callMock.mockImplementation(async (m: string) => (m === "plugins.options" || m === "plugins.configure" ? [option({ key: "python", title: "Python", value: "python3" })] : null));
    const onClose = vi.fn();
    show(<PluginOptionsDialog plugin={plugin} onClose={onClose} />);
    const input = (await screen.findByLabelText("Python")) as HTMLInputElement;
    await waitFor(() => expect(input.value).toBe("python3"));
    const save = screen.getByRole("button", { name: "Speichern" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.change(input, { target: { value: "python9" } });
    fireEvent.click(save);
    await waitFor(() => expect(callMock).toHaveBeenCalledWith("plugins.configure", { id: "x@y", values: { python: "python9" } }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
