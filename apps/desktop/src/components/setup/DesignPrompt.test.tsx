import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { SCHEME_PRESETS, type Settings } from "@forge/protocol";
import type * as RpcModuleNs from "@/lib/rpc";

const callMock = vi.fn();
vi.mock("@/lib/rpc", async (orig) => ({ ...(await orig<typeof RpcModuleNs>()), rpc: { call: (...a: unknown[]) => callMock(...a), subscribe: () => () => {} } }));

const { DesignPrompt } = await import("./DesignPrompt");
const { DesignSettings } = await import("@/components/settings/DesignSettings");
const { ContextMenuHost } = await import("@/components/layout/ContextMenuHost");
const { call, keys, useSettings } = await import("@/lib/queries");
const { useUi } = await import("@/stores/ui");
const { previewScheme, schemeTokens, useDesign, useDesignSync } = await import("@/lib/design");

let settings: Partial<Settings>;
const calls = (method: string) => callMock.mock.calls.filter(([m]) => m === method).map(([, p]) => p as Record<string, unknown>);
const token = (name: string) => document.documentElement.style.getPropertyValue(name);

function Synced({ children }: { children: React.ReactNode }) {
  useDesignSync();
  return <>{children}</>;
}

function setup(children: (qc: QueryClient) => React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <TooltipProvider>
        <Synced>{children(qc)}</Synced>
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  callMock.mockReset();
  useUi.setState({ setupWizard: false, view: "home", settingsSection: "general", designRequest: null });
  useDesign.setState({ saved: SCHEME_PRESETS[0]!, preview: null, transparency: "off", transparencySupported: true });
  previewScheme(null);
  settings = { setupDone: true, syncAsked: true, usageStatsAsked: true, designAsked: false, syncEnabled: false, colorScheme: "default", customSchemes: [], transparency: "light" };
  callMock.mockImplementation(async (method: string, params: Record<string, unknown>) => {
    if (method === "settings.update") settings = { ...settings, ...params };
    return method.startsWith("settings.") ? settings : null;
  });
});
afterEach(cleanup);

describe("design notice after the update", () => {
  it("lets the user choose a scheme, paints it and does not come back once closed", async () => {
    setup(() => <DesignPrompt />);
    expect(await screen.findByText("Neu: Farbschemata und Transparenz")).toBeTruthy();
    expect(screen.getByRole("radio", { name: /FORGE/ }).getAttribute("aria-checked")).toBe("true");
    // FORGE's own look is the stylesheet: no overrides.
    expect(token("--color-accent")).toBe("");

    fireEvent.click(screen.getByRole("radio", { name: /Vampire/ }));
    await waitFor(() => expect(calls("settings.update")).toEqual([{ colorScheme: "vampire" }]));
    await waitFor(() => expect(token("--color-accent")).toBe("#bd93f9"));
    expect(token("--color-bg")).toBe("#13141d");
    expect(JSON.parse(localStorage.getItem("forge.design")!).id).toBe("vampire");

    // Transparency comes in steps, "Leicht" is the default. The backdrop between the panels turns translucent, the rest stays solid.
    expect(screen.getByRole("radio", { name: "Leicht" }).getAttribute("aria-checked")).toBe("true");
    await waitFor(() => expect(token("--color-backdrop")).toBe("#0b0c12cc"));
    fireEvent.click(screen.getByRole("radio", { name: "Stark" }));
    await waitFor(() => expect(calls("settings.update")).toContainEqual({ transparency: "strong" }));
    await waitFor(() => expect(token("--color-backdrop")).toBe("#0b0c124d"));
    expect(token("--color-shell-side")).toBe("#191a26b3");
    expect(token("--color-bg")).toBe("#13141d");

    fireEvent.click(screen.getByRole("button", { name: "Fertig" }));
    await waitFor(() => expect(calls("settings.update")).toContainEqual({ designAsked: true }));
    await waitFor(() => expect(screen.queryByText("Neu: Farbschemata und Transparenz")).toBeNull());
  });

  it("waits for the earlier questions and stays away from new installations", async () => {
    settings = { ...settings, usageStatsAsked: false };
    const first = setup(() => <DesignPrompt />);
    await waitFor(() => expect(calls("settings.get")).toHaveLength(1));
    expect(screen.queryByText("Neu: Farbschemata und Transparenz")).toBeNull();
    first.unmount();

    // The setup assistant sets designAsked when it finishes.
    settings = { ...settings, usageStatsAsked: true, designAsked: true };
    setup(() => <DesignPrompt />);
    await waitFor(() => expect(calls("settings.get")).toHaveLength(2));
    expect(screen.queryByText("Neu: Farbschemata und Transparenz")).toBeNull();
  });

  it("opens the design settings from the notice", async () => {
    setup(() => <DesignPrompt />);
    fireEvent.click(await screen.findByRole("button", { name: "Design-Einstellungen öffnen" }));
    await waitFor(() => expect(calls("settings.update")).toEqual([{ designAsked: true }]));
    expect(useUi.getState()).toMatchObject({ view: "settings", settingsSection: "design" });
  });
});

describe("design settings", () => {
  /** Like the settings view: saves through the RPC and shows what comes back. */
  function Page() {
    const qc = useQueryClient();
    const s = useSettings().data;
    if (!s) return null;
    return (
      <>
        <DesignSettings s={s} save={async (patch) => void qc.setQueryData(keys.settings, await call("settings.update", patch))} />
        <ContextMenuHost search={false} />
      </>
    );
  }

  it("previews an own scheme while it is edited and keeps it only when saved", async () => {
    setup(() => <Page />);
    fireEvent.click(await screen.findByRole("button", { name: /Eigenes Schema/ }));
    fireEvent.change(await screen.findByLabelText("Akzent"), { target: { value: "#00ff88" } });
    await waitFor(() => expect(token("--color-accent")).toBe("#00ff88"));
    // Cancelled: back to the saved scheme, nothing stored.
    fireEvent.click(screen.getByRole("button", { name: "Abbrechen" }));
    await waitFor(() => expect(token("--color-accent")).toBe(""));
    expect(calls("settings.update")).toEqual([]);

    fireEvent.click(screen.getByRole("button", { name: /Eigenes Schema/ }));
    fireEvent.change(await screen.findByLabelText("Name"), { target: { value: "Mitternacht" } });
    fireEvent.change(screen.getByLabelText("Akzent"), { target: { value: "#00ff88" } });
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));
    await waitFor(() => expect(calls("settings.update")).toHaveLength(1));
    const saved = calls("settings.update")[0] as unknown as Settings;
    expect(saved.customSchemes).toHaveLength(1);
    expect(saved.customSchemes[0]).toMatchObject({ name: "Mitternacht", colors: { accent: "#00ff88", bg: "#131314" } });
    expect(saved.colorScheme).toBe(saved.customSchemes[0]!.id);
    expect(saved.colorScheme).toMatch(/^custom-[a-z0-9]{4,24}$/);
    // Saved and chosen: the window keeps the colors, and the card is there.
    await waitFor(() => expect(screen.getByRole("radio", { name: /Mitternacht/ }).getAttribute("aria-checked")).toBe("true"));
    expect(token("--color-accent")).toBe("#00ff88");
  });

  it("deletes an own scheme from the right click and goes back to FORGE's scheme when it was chosen", async () => {
    const own = { id: "custom-abcd1234", name: "Mitternacht", colors: { ...SCHEME_PRESETS[0]!.colors, accent: "#00ff88" } };
    settings = { ...settings, customSchemes: [own], colorScheme: own.id };
    setup(() => <Page />);
    fireEvent.contextMenu(await screen.findByRole("radio", { name: /Mitternacht/ }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Löschen" }));
    expect(await screen.findByText("Farbschema „Mitternacht“ löschen?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Löschen" }));
    await waitFor(() => expect(calls("settings.update")).toEqual([{ customSchemes: [], colorScheme: "default" }]));
    await waitFor(() => expect(screen.queryByRole("radio", { name: /Mitternacht/ })).toBeNull());
    expect(token("--color-accent")).toBe("");
  });
});

describe("scheme tokens", () => {
  it("mixes the steps between the named colors and picks a readable text on the accent", () => {
    const gruvbox = SCHEME_PRESETS.find((x) => x.id === "gruvbox")!;
    const tokens = schemeTokens(gruvbox);
    expect(tokens["--color-backdrop"]).toBe("#0e0d0c");
    expect(tokens["--color-accent-soft"]).toBe("#fabd2f17");
    // Yellow is too light for white text.
    expect(tokens["--color-accent-fg"]).not.toBe("#ffffff");
    const solarized = schemeTokens(SCHEME_PRESETS.find((x) => x.id === "solarized")!);
    expect(solarized["--color-accent-fg"]).toBe("#ffffff");
    for (const v of Object.values(tokens)) expect(v).toMatch(/^#[0-9a-f]{6}([0-9a-f]{2})?$/);
  });
});
