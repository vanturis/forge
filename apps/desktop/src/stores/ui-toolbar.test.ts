import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUi } from "./ui";

let inChatWindow = false;
vi.mock("@/lib/chat-windows", () => ({ isChatWindow: () => inChatWindow }));

beforeEach(() => {
  localStorage.clear();
  inChatWindow = false;
  useUi.setState({ view: "workspace", activeProjectId: "p1", workspaceTab: "chat", toolbarOpen: false, selectedFile: {} });
});

describe("workspace toolbar", () => {
  it("is shown by default, also for those who still have the former default saved", async () => {
    expect(useUi.getInitialState().toolbarOpen).toBe(true);
    localStorage.setItem("forge.ui", JSON.stringify({ toolbarOpen: false }));
    vi.resetModules();
    const fresh = await import("./ui");
    expect(fresh.useUi.getState().toolbarOpen).toBe(true);
  });

  it("shows itself when another area than the chat opens", () => {
    useUi.getState().setWorkspaceTab("git");
    expect(useUi.getState().toolbarOpen).toBe(true);
    useUi.getState().toggleToolbar(false);
    expect(useUi.getState()).toMatchObject({ toolbarOpen: false, workspaceTab: "chat" });
    useUi.getState().openFile("p1", "src/app.ts");
    expect(useUi.getState()).toMatchObject({ toolbarOpen: true, workspaceTab: "files" });
  });

  it("stays as the user left it after a restart", () => {
    useUi.getState().toggleToolbar(true);
    expect(JSON.parse(localStorage.getItem("forge.ui")!)).toMatchObject({ toolbarShown: true });
    useUi.getState().toggleToolbar();
    expect(JSON.parse(localStorage.getItem("forge.ui")!)).toMatchObject({ toolbarShown: false });
  });

  it("is not saved from a chat window, which would overwrite the main window's layout", () => {
    useUi.getState().toggleToolbar(true);
    inChatWindow = true;
    useUi.getState().toggleToolbar(false);
    useUi.getState().openProject("p2");
    expect(JSON.parse(localStorage.getItem("forge.ui")!)).toMatchObject({ toolbarShown: true, activeProjectId: "p1" });
  });
});
