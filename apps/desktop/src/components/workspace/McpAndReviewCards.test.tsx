import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ELICITATION_TOOL } from "@forge/protocol";
import type * as RpcModuleNs from "@/lib/rpc";

const callMock = vi.fn();
const openExternal = vi.fn(async (_url: string) => {});
vi.mock("@/lib/rpc", async (orig) => ({ ...(await orig<typeof RpcModuleNs>()), rpc: { call: (...a: unknown[]) => callMock(...a), subscribe: () => () => {} } }));
vi.mock("@/lib/native", async (orig) => ({ ...(await orig<object>()), openExternal: (u: string) => openExternal(u) }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const { ElicitationCard } = await import("./InteractiveCards");
const { FindingsCard, parseFindings } = await import("./FindingsCard");

const request = (input: Record<string, unknown>) => ({
  type: "approval.request" as const,
  requestId: `r-${Math.random()}`,
  toolUseId: "e1",
  toolName: ELICITATION_TOOL,
  input: { serverName: "crm", message: "Welcher Kunde?", ...input },
  title: "crm",
  description: null,
  reason: null,
  allowSessionScope: false,
  outsideProject: false,
});
const form = { mode: "form", schema: { type: "object", required: ["name"], properties: { name: { type: "string", title: "Name" }, plan: { type: "boolean", title: "Pro" } } } };

const show = (ui: React.ReactNode) => render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>);

beforeEach(() => {
  callMock.mockReset();
  callMock.mockResolvedValue({ ok: true });
  openExternal.mockClear();
});
afterEach(cleanup);

describe("MCP question card", () => {
  it("sends the form only once required fields are filled", async () => {
    const req = request(form);
    show(<ElicitationCard req={req} resolved={null} sessionId="s1" />);
    expect(screen.getByText("crm braucht eine Angabe")).toBeTruthy();
    const send = screen.getByRole("button", { name: "Senden" }) as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Ada" } });
    expect(send.disabled).toBe(false);
    fireEvent.click(send);
    await waitFor(() => expect(callMock).toHaveBeenCalledWith("sessions.respondApproval", expect.objectContaining({ requestId: req.requestId, decision: "allow", answers: { name: "Ada", plan: "false" } })));
  });

  it("declines", async () => {
    show(<ElicitationCard req={request(form)} resolved={null} sessionId="s2" />);
    fireEvent.click(screen.getByRole("button", { name: "Ablehnen" }));
    await waitFor(() => expect(callMock).toHaveBeenCalledWith("sessions.respondApproval", expect.objectContaining({ decision: "deny" })));
  });

  it("names the host of a sign-in page and opens it on request", async () => {
    show(<ElicitationCard req={request({ mode: "url", url: "https://login.example.com/x" })} resolved={null} sessionId="s3" />);
    expect(screen.getByText("Öffnet login.example.com")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Im Browser öffnen" }));
    expect(openExternal).toHaveBeenCalledWith("https://login.example.com/x");
    await waitFor(() => expect(callMock).toHaveBeenCalledWith("sessions.respondApproval", expect.objectContaining({ decision: "allow" })));
  });

  it("shows no fields once answered", () => {
    show(<ElicitationCard req={request(form)} resolved={{ type: "approval.resolved", requestId: "x", decision: "allow", scope: "once", source: "user", message: null }} sessionId="s4" />);
    expect(screen.getByText("Rückfrage von crm")).toBeTruthy();
    expect(screen.queryByLabelText("Name")).toBeNull();
  });
});

describe("code review card", () => {
  it("lists findings with verdict and outcome", () => {
    show(<FindingsCard input={{ findings: [{ file: "src/a.ts", line: 3, summary: "Fehlt", failure_scenario: "Absturz", category: "correctness", verdict: "CONFIRMED", outcome: "fixed" }] }} />);
    expect(screen.getByText("Code-Review: 1 Befund")).toBeTruthy();
    expect(screen.getByText("Fehlt")).toBeTruthy();
    expect(screen.getByText("Auswirkung: Absturz")).toBeTruthy();
    expect(screen.getByText("Bestätigt")).toBeTruthy();
    expect(screen.getByText("Behoben")).toBeTruthy();
  });

  it("says when nothing was found and skips broken entries", () => {
    expect(parseFindings({ findings: [{ file: 3 }, null, { file: "a", summary: "b" }] })).toHaveLength(1);
    show(<FindingsCard input={{ findings: [] }} />);
    expect(screen.getByText("Code-Review: keine Befunde")).toBeTruthy();
  });
});
