import { t } from "@/i18n";
import { NAV } from "./nav";
import type { PaletteEntry } from "./palette-actions";

/** The predefined items of the menu bar that macOS itself carries out. */
export type SystemItem = "Undo" | "Redo" | "Cut" | "Copy" | "Paste" | "SelectAll" | "Minimize" | "Maximize" | "Fullscreen" | "Hide" | "HideOthers" | "ShowAll" | "CloseWindow" | "Quit" | "Services" | "BringAllToFront" | "About";

/**
 * One item of the menu bar. An action runs the first palette entry of `ids` that exists right now;
 * without one the item is greyed out. `live` shows that entry's label (on/off, start/stop).
 */
export type MenuNode =
  | { action: string; ids: readonly string[]; label: string; live?: boolean; accelerator?: string }
  | { system: SystemItem; label: string }
  | { submenu: string; items: readonly MenuNode[] }
  | "-";

/** Not in the palette: the menu opens the palette itself. */
export const PALETTE_ID = "menu-palette";

const m = t.layout.appMenu;
const a = (ids: string | readonly string[], label: string, extra: { live?: boolean; accelerator?: string } = {}): MenuNode => {
  const list = typeof ids === "string" ? [ids] : ids;
  return { action: list[0]!, ids: list, label, ...extra };
};
const sys = (system: SystemItem, label: string): MenuNode => ({ system, label });

/**
 * The macOS menu bar. Accelerators only where the window has the same app-wide shortcut: WebKit offers
 * a key to the page first and to the menu only if the page left it unhandled. Cmd+F and Ctrl+R are
 * left out because the terminal and the editors keep those without marking them handled.
 */
export const APP_MENU: ReadonlyArray<{ submenu: string; items: readonly MenuNode[]; role?: "window" | "help" }> = [
  {
    submenu: "FORGE",
    items: [
      sys("About", m.about),
      "-",
      a("nav-settings", m.settings, { accelerator: "CmdOrCtrl+," }),
      a("update-check", m.updateCheck),
      "-",
      a("claude-login", m.claudeLogin),
      a("claude-switch", m.claudeSwitch),
      a("phone", m.phone, { live: true }),
      a("remote", m.remote, { live: true }),
      "-",
      sys("Services", m.services),
      "-",
      sys("Hide", m.hide),
      sys("HideOthers", m.hideOthers),
      sys("ShowAll", m.showAll),
      "-",
      sys("Quit", m.quit),
    ],
  },
  {
    submenu: m.file,
    items: [
      a("new-session", m.newSession, { accelerator: "CmdOrCtrl+N" }),
      "-",
      a("temp-chat", m.tempChat, { accelerator: "CmdOrCtrl+Shift+N" }),
      a("add-project", m.addProject, { accelerator: "CmdOrCtrl+O" }),
      a("create-project", m.createProject),
      a("clone-project", m.cloneProject),
      a("create-group", m.createGroup),
      "-",
      a(["chat-window-open", "chat-window-recall"], m.chatWindow, { live: true }),
      "-",
      a("screenshot", m.screenshot),
      a("backup", m.backup),
      a("push-all", m.pushAll),
      "-",
      sys("CloseWindow", m.closeWindow),
    ],
  },
  {
    submenu: m.edit,
    items: [
      sys("Undo", m.undo),
      sys("Redo", m.redo),
      "-",
      sys("Cut", m.cut),
      sys("Copy", m.copy),
      sys("Paste", m.paste),
      sys("SelectAll", m.selectAll),
      "-",
      a("chat-find", m.chatFind),
      a("composer-history", m.composerHistory),
      a("session-edit-last", m.editLast),
      a("dictate-toggle", m.dictate),
    ],
  },
  {
    submenu: m.view,
    items: [
      a(PALETTE_ID, m.palette, { accelerator: "CmdOrCtrl+K" }),
      "-",
      { submenu: m.goTo, items: NAV.map((n) => a(`nav-${n.view}`, n.label)) },
      {
        submenu: m.tabs,
        items: [
          a("tab-chat", t.layout.actions.tabs.chat),
          a("tab-agents", t.layout.actions.tabs.agents),
          a("tab-git", t.layout.actions.tabs.git),
          a("tab-files", t.layout.actions.tabs.files),
          a("tab-devtools", t.layout.actions.tabs.devtools),
          a("tab-knowledge", t.layout.actions.tabs.knowledge),
          a("tab-crew", t.crew.tab),
          a("tab-settings", t.layout.actions.tabs.settings),
        ],
      },
      "-",
      a("bottom", m.bottom, { accelerator: "CmdOrCtrl+J" }),
      a("right", m.right, { accelerator: "CmdOrCtrl+Shift+E" }),
      "-",
      a("split-add", m.splitAdd),
      a("split-close", m.splitClose),
      a("split-restore", m.splitRestore),
      "-",
      a("chat-view-all", m.chatAll),
      a("chat-view-prompts", m.chatPrompts),
      a("chat-view-answers", m.chatAnswers),
      a("chat-view-files", m.chatFiles),
      "-",
      sys("Fullscreen", m.fullscreen),
    ],
  },
  {
    submenu: m.session,
    items: [
      a("session-stop", m.sessionStop),
      a("compact", m.compact),
      a("session-close", m.sessionClose),
      "-",
      a("session-summary", m.sessionSummary),
      a("session-fork", m.sessionFork),
      a("session-handoff", m.sessionHandoff),
      "-",
      a("session-mode", m.planMode, { live: true }),
      a("session-usage", m.sessionUsage),
      "-",
      a("template-new", m.templateNew),
      a("templates-manage", m.templatesManage),
      "-",
      a("session-delete", m.sessionDelete),
    ],
  },
  {
    submenu: m.git,
    items: [
      a("git-commit", m.gitCommit),
      "-",
      a("git-fetch", m.gitFetch),
      a("git-pull", m.gitPull),
      a("git-push", m.gitPush),
      a("git-remote-check", m.gitRemoteCheck),
      "-",
      a("git-new-branch", m.newBranch),
      a("git-pr", m.createPr),
      a("git-remote", m.gitRemote),
    ],
  },
  {
    submenu: m.project,
    items: [
      a("terminal", m.terminal),
      a("explorer-project", m.revealProject),
      "-",
      a(["dev-start", "dev-stop"], m.devServer, { live: true }),
      a(["testdb-start", "testdb-stop"], m.testDb, { live: true }),
      "-",
      a("agent-new", m.agentNew),
      a("knowledge-stale", m.knowledgeStale),
      a("report-project", m.reportProject),
      "-",
      a("tab-settings", m.projectSettings),
    ],
  },
  {
    submenu: m.window,
    role: "window",
    items: [sys("Minimize", m.minimize), sys("Maximize", m.zoom), "-", a("setting-alwaysOnTop", m.alwaysOnTop, { live: true }), "-", sys("BringAllToFront", m.bringAllToFront)],
  },
  {
    submenu: m.help,
    role: "help",
    items: [
      a("setup-wizard", m.setupWizard),
      a("usage-forecast", m.usageForecast),
      a("report", m.report),
      "-",
      a("support-feedback", m.feedback),
      a("support-open", m.support),
    ],
  },
];

/** Every action item of the menu, also those in submenus. */
export function menuActions(nodes: readonly MenuNode[] = APP_MENU.flatMap((s) => s.items)): Array<Extract<MenuNode, { action: string }>> {
  return nodes.flatMap((n) => (n === "-" || "system" in n ? [] : "submenu" in n ? menuActions(n.items) : [n]));
}

export interface MenuItemState {
  text: string;
  enabled: boolean;
  entry: PaletteEntry | null;
}

/** What an action item shows right now, given the entries the palette would offer. */
export function menuItemState(item: Extract<MenuNode, { action: string }>, entries: ReadonlyMap<string, PaletteEntry>): MenuItemState {
  const entry = item.ids.map((id) => entries.get(id)).find((e) => e !== undefined) ?? null;
  return { text: item.live && entry ? entry.label : item.label, enabled: entry !== null, entry };
}
