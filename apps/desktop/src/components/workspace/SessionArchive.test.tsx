import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import type { Session } from "@forge/protocol";
import type * as RpcModuleNs from "@/lib/rpc";
import { useSessionArchiveDialog } from "@/stores/session-archive";
import { useToasts } from "@/stores/toast";
import { useUi } from "@/stores/ui";

type RpcModule = typeof RpcModuleNs;

const callMock = vi.fn();
vi.mock("@/lib/rpc", async (orig) => ({ ...(await orig<RpcModule>()), rpc: { call: (...a: unknown[]) => callMock(...a), subscribe: () => () => {} } }));
vi.mock("@/lib/chat-windows", async (orig) => ({ ...(await orig<object>()), closeChatWindows: vi.fn() }));

const { queryClient } = await import("@/lib/queries");
const { SessionArchiveDialogHost } = await import("./SessionArchive");
const { archiveMenuItems, archiveSession, canArchive } = await import("./session-archive");

type Row = Session & { projectName: string };

const row = (id: string, projectId: string, title: string | null, over: Partial<Row> = {}): Row =>
  ({ id, projectId, projectName: projectId === "p1" ? "Shop" : "Blog", title, archived: true, status: "stopped", live: false, background: [], claudeSessionId: `c-${id}`, updatedAt: "2026-10-11T10:00:00Z", ...over }) as Row;

let archive: Row[] = [];
/** resolves the pending sessions.listAll, to look at the dialog while it loads */
let release: (() => void) | null = null;

function setup() {
  render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SessionArchiveDialogHost />
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  queryClient.clear();
  useToasts.setState({ toasts: [] });
  archive = [row("s1", "p1", "Warenkorb"), row("s2", "p2", "Impressum"), row("s3", "p1", null)];
  release = null;
  callMock.mockReset();
  callMock.mockImplementation(async (method: string, params: { sessionId?: string; archived?: unknown }) => {
    if (method === "projects.list") return [{ id: "p1", name: "Shop" }, { id: "p2", name: "Blog" }];
    if (method === "sessions.listAll") {
      expect(params).toEqual({ archived: "only" });
      if (release === null) return archive;
      await new Promise<void>((r) => (release = r));
      return archive;
    }
    if (method === "sessions.archive") {
      const s = archive.find((x) => x.id === params.sessionId)!;
      archive = archive.filter((x) => x.id !== s.id);
      return { ...s, archived: false };
    }
    throw new Error("unexpected " + method);
  });
});
afterEach(() => {
  cleanup();
  useSessionArchiveDialog.setState({ shown: false, projectId: null });
});

describe("session archive dialog", () => {
  it("shows a skeleton while it loads, then the archived sessions of the project", async () => {
    release = () => {};
    useSessionArchiveDialog.getState().open("p1");
    setup();
    expect(await screen.findByRole("status", { name: "Lädt Archiv" })).toBeTruthy();
    expect(screen.queryByText("Das Archiv ist leer")).toBeNull();
    release();

    expect(await screen.findByText("Warenkorb")).toBeTruthy();
    expect(screen.queryByRole("status", { name: "Lädt Archiv" })).toBeNull();
    expect(screen.getByText("Ohne Titel")).toBeTruthy();
    expect(screen.queryByText("Impressum")).toBeNull();
    expect(screen.getByText("2 Sessions")).toBeTruthy();
    expect(await screen.findByText("Archivierte Sessions von Shop. Sie bleiben mit ihrem Verlauf erhalten.")).toBeTruthy();
  });

  it("lists the archive of all projects with their names, and says when it is empty", async () => {
    useSessionArchiveDialog.getState().open(null);
    setup();
    expect(await screen.findByText("Impressum")).toBeTruthy();
    expect(screen.getByText(/^Blog · /)).toBeTruthy();
    expect(screen.getByText("3 Sessions")).toBeTruthy();
    cleanup();

    queryClient.clear();
    archive = [];
    setup();
    expect(await screen.findByText("Das Archiv ist leer")).toBeTruthy();
  });

  it("opens a session read-only, brings one back and asks before deleting", async () => {
    useSessionArchiveDialog.getState().open("p1");
    setup();
    fireEvent.click(await screen.findByRole("button", { name: "Warenkorb aus dem Archiv holen" }));
    await waitFor(() => expect(callMock).toHaveBeenCalledWith("sessions.archive", { sessionId: "s1", archived: false }));
    await waitFor(() => expect(screen.queryByText("Warenkorb")).toBeNull());
    expect(useToasts.getState().toasts.at(-1)).toMatchObject({ tone: "success", title: "Session aus dem Archiv geholt" });

    fireEvent.click(screen.getByRole("button", { name: "Ohne Titel löschen" }));
    expect(await screen.findByText("Session löschen?")).toBeTruthy();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });

    fireEvent.click(await screen.findByRole("button", { name: "Ohne Titel öffnen" }));
    expect(useUi.getState()).toMatchObject({ view: "workspace", activeProjectId: "p1" });
    expect(useUi.getState().activeSession.p1).toBe("s3");
    expect(useSessionArchiveDialog.getState().shown).toBe(false);
  });
});

describe("archiving from menus", () => {
  it("offers archiving only for a session at rest, and the way back for an archived one", () => {
    const idle = row("s1", "p1", "Warenkorb", { archived: false, status: "idle", live: true });
    expect(archiveMenuItems(idle).map((i) => i.label)).toEqual(["Archivieren"]);
    expect(archiveMenuItems(row("s1", "p1", "Warenkorb")).map((i) => i.label)).toEqual(["Aus dem Archiv holen"]);
    for (const status of ["running", "starting", "stopping", "waiting_approval"] as const) expect(canArchive({ ...idle, status })).toBe(false);
    expect(archiveMenuItems({ ...idle, background: [{ taskId: "b" }] as Session["background"] })).toEqual([]);
  });

  it("clears the chat of an archived session and offers to undo; a refusal shows as an error", async () => {
    const idle = row("s9", "p1", "Warenkorb", { archived: false, status: "idle" });
    archive = [idle];
    useUi.setState({ activeSession: { p1: "s9" } });
    callMock.mockImplementation(async (method: string, params: { archived: boolean }) => ({ ...idle, archived: params.archived }));
    expect(await archiveSession(idle)).toBe(true);
    expect(callMock).toHaveBeenCalledWith("sessions.archive", { sessionId: "s9", archived: true });
    expect(useUi.getState().activeSession.p1).toBeNull();
    const done = useToasts.getState().toasts.at(-1)!;
    expect(done).toMatchObject({ tone: "success", title: "Session archiviert", body: "„Warenkorb“ liegt im Archiv.", action: { label: "Rückgängig" } });
    done.action!.onClick();
    await waitFor(() => expect(callMock).toHaveBeenCalledWith("sessions.archive", { sessionId: "s9", archived: false }));

    callMock.mockRejectedValue(new Error("Die Session arbeitet noch. Erst stoppen, dann archivieren."));
    expect(await archiveSession(idle)).toBe(false);
    expect(useToasts.getState().toasts.at(-1)).toMatchObject({ tone: "error", title: "Session nicht archiviert", body: "Die Session arbeitet noch. Erst stoppen, dann archivieren." });
  });
});
