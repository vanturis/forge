import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ClaudeSetupState, ClaudeStartUpdate } from "@forge/protocol";
import type * as RpcModuleNs from "@/lib/rpc";

const callMock = vi.fn();
vi.mock("@/lib/rpc", async (orig) => ({ ...(await orig<typeof RpcModuleNs>()), rpc: { call: (...a: unknown[]) => callMock(...a), subscribe: () => () => {} } }));

const { ClaudeStartUpdateGate } = await import("./ClaudeStartUpdateGate");
const { keys } = await import("@/lib/queries");

const state = (patch: Partial<ClaudeStartUpdate>): ClaudeStartUpdate => ({ phase: "idle", installed: "2.1.100", latest: "2.1.105", message: null, skippable: false, ...patch });
const SETUP: ClaudeSetupState = { task: "update", phase: "running", url: null, log: ["Checking for updates", "Downloading 2.1.105"], message: null };

let startUpdate: ClaudeStartUpdate | Error;
let resolveResult: (action: string) => ClaudeStartUpdate;
let qc: QueryClient;

function setup() {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ClaudeStartUpdateGate starting={<div>FORGE startet</div>}>
        <div>Die App</div>
      </ClaudeStartUpdateGate>
    </QueryClientProvider>,
  );
}
const resolved = () => callMock.mock.calls.filter(([m]) => m === "claude.resolveStartUpdate").map(([, p]) => (p as { action: string }).action);

beforeEach(() => {
  callMock.mockReset();
  resolveResult = (action) => state({ phase: action === "retry" ? "updating" : "skipped" });
  callMock.mockImplementation(async (method: string, params: { action: string }) => {
    if (method === "claude.startUpdateState") {
      if (startUpdate instanceof Error) throw startUpdate;
      return startUpdate;
    }
    if (method === "claude.setupState") return SETUP;
    if (method === "claude.resolveStartUpdate") return resolveResult(params.action);
    throw new Error(`${method} ist im Test nicht vorgesehen`);
  });
});
afterEach(cleanup);

describe("ClaudeStartUpdateGate", () => {
  it.each(["idle", "done", "skipped"] as const)("opens the app when the start update is %s", async (phase) => {
    startUpdate = state({ phase });
    setup();
    expect(await screen.findByText("Die App")).toBeTruthy();
    expect(screen.queryByText("Claude Code wird aktualisiert")).toBeNull();
  });

  it("keeps showing the start screen while the check runs, then opens the app without a word", async () => {
    startUpdate = state({ phase: "checking", installed: null, latest: null });
    setup();
    expect(screen.getByText("FORGE startet")).toBeTruthy();
    await waitFor(() => expect(callMock).toHaveBeenCalledWith("claude.startUpdateState", {}));
    expect(screen.getByText("FORGE startet")).toBeTruthy();
    expect(screen.queryByText("Die App")).toBeNull();

    act(() => qc.setQueryData(keys.claudeStartUpdate, state({ phase: "idle" })));
    expect(await screen.findByText("Die App")).toBeTruthy();
  });

  it("locks the window during the update and shows both versions and the last line of the log", async () => {
    startUpdate = state({ phase: "updating" });
    setup();
    expect(await screen.findByText("Claude Code wird aktualisiert")).toBeTruthy();
    expect(screen.queryByText("Die App")).toBeNull();
    expect(screen.getByLabelText("Installiert ist 2.1.100, neu ist 2.1.105")).toBeTruthy();
    expect(await screen.findByText("Downloading 2.1.105")).toBeTruthy();
    // No way around it while the update is on time.
    expect(screen.queryByRole("button")).toBeNull();

    act(() => qc.setQueryData(keys.claudeStartUpdate, state({ phase: "done" })));
    expect(await screen.findByText("Die App")).toBeTruthy();
  });

  it("offers to go on without a hanging update", async () => {
    startUpdate = state({ phase: "updating", skippable: true });
    setup();
    fireEvent.click(await screen.findByRole("button", { name: "Ohne Update weiter" }));
    expect(await screen.findByText("Die App")).toBeTruthy();
    expect(resolved()).toEqual(["skip"]);
  });

  it("names the reason of a failed update and lets the user retry or go on", async () => {
    startUpdate = state({ phase: "failed", message: "Dieses Claude Code wird von einem Paketmanager verwaltet." });
    setup();
    expect(await screen.findByText("Claude Code wurde nicht aktualisiert")).toBeTruthy();
    expect(screen.getByText("Dieses Claude Code wird von einem Paketmanager verwaltet.")).toBeTruthy();
    expect(screen.queryByText("Die App")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Erneut versuchen" }));
    expect(await screen.findByText("Claude Code wird aktualisiert")).toBeTruthy();
    expect(resolved()).toEqual(["retry"]);

    act(() => qc.setQueryData(keys.claudeStartUpdate, state({ phase: "failed", message: "Wieder nichts." })));
    expect(await screen.findByText("Wieder nichts.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ohne Update weiter" }));
    expect(await screen.findByText("Die App")).toBeTruthy();
    expect(resolved()).toEqual(["retry", "skip"]);
  });

  it("never stays locked when the sidecar does not answer", async () => {
    startUpdate = new Error("keine Antwort");
    setup();
    expect(await screen.findByText("Die App")).toBeTruthy();
    cleanup();

    // The lock is up and "go on" fails: the app opens anyway.
    startUpdate = state({ phase: "failed", message: "kaputt" });
    resolveResult = () => {
      throw new Error("keine Antwort");
    };
    setup();
    fireEvent.click(await screen.findByRole("button", { name: "Ohne Update weiter" }));
    expect(await screen.findByText("Die App")).toBeTruthy();
  });

  it("says why a retry could not start and keeps the way out", async () => {
    startUpdate = state({ phase: "failed", message: "kaputt" });
    resolveResult = () => {
      throw new Error("Es läuft bereits ein Einrichtungsschritt.");
    };
    setup();
    fireEvent.click(await screen.findByRole("button", { name: "Erneut versuchen" }));
    expect(await screen.findByText(/Es läuft bereits ein Einrichtungsschritt/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ohne Update weiter" })).toBeTruthy();
  });
});
