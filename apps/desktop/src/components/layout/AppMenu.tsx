import { useEffect, useMemo, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Menu, MenuItem, PredefinedMenuItem, Submenu } from "@tauri-apps/api/menu";
import { useUi } from "@/stores/ui";
import { dialogOpen } from "@/lib/shortcuts";
import { buildActions, type PaletteDialog, type PaletteEntry } from "./palette-actions";
import { useActionContext } from "./action-context";
import { APP_MENU, PALETTE_ID, menuItemState, type MenuNode } from "./app-menu";

type ActionNode = Extract<MenuNode, { action: string }>;
interface Live {
  node: ActionNode;
  item: MenuItem;
  text: string;
  enabled: boolean;
}

/** Actions that belong where they are, not in the main window: they do not bring it to the front. */
const STAY = new Set(["screenshot", "chat-window-recall", "setting-alwaysOnTop", "support-feedback"]);

/**
 * The menu bar of macOS with FORGE's actions. The items run the entries of the command palette, so
 * the menu offers what the palette offers right now and greys out the rest.
 */
export function AppMenu({ openDialog }: { openDialog: (d: PaletteDialog) => void }) {
  const ctx = useActionContext(openDialog);
  const entries = useMemo(() => {
    const map = new Map<string, PaletteEntry>(buildActions(ctx).map((e) => [e.id, e]));
    map.set(PALETTE_ID, { id: PALETTE_ID, group: "Aktionen", label: "", icon: null, run: () => useUi.getState().setPaletteOpen(true) });
    return map;
  }, [ctx]);
  const entriesRef = useRef(entries);
  const liveRef = useRef<Live[]>([]);

  useEffect(() => {
    let cancelled = false;
    let menu: Menu | null = null;
    const live: Live[] = [];

    const run = (node: ActionNode) => {
      const ui = useUi.getState();
      if (ui.paletteOpen) {
        ui.setPaletteOpen(false);
        if (node.action === PALETTE_ID) return;
      } else if (dialogOpen()) {
        // An open dialog owns the window, as it does for the shortcuts.
        return;
      }
      const entry = menuItemState(node, entriesRef.current).entry;
      if (!entry) return;
      if (!document.hasFocus() && !STAY.has(entry.id)) void invoke("show_main_window").catch(() => {});
      entry.run();
    };

    const create = async (nodes: readonly MenuNode[]): Promise<Array<MenuItem | Submenu | PredefinedMenuItem>> => {
      const out: Array<MenuItem | Submenu | PredefinedMenuItem> = [];
      for (const n of nodes) {
        if (n === "-") out.push(await PredefinedMenuItem.new({ item: "Separator" }));
        else if ("system" in n) out.push(await PredefinedMenuItem.new({ item: n.system === "About" ? { About: null } : n.system, text: n.label }));
        else if ("submenu" in n) out.push(await Submenu.new({ text: n.submenu, items: await create(n.items) }));
        else {
          const state = menuItemState(n, entriesRef.current);
          const item = await MenuItem.new({ text: state.text, enabled: state.enabled, accelerator: n.accelerator, action: () => run(n) });
          live.push({ node: n, item, text: state.text, enabled: state.enabled });
          out.push(item);
        }
      }
      return out;
    };

    void (async () => {
      try {
        const submenus: Submenu[] = [];
        for (const s of APP_MENU) {
          const sub = await Submenu.new({ text: s.submenu, items: await create(s.items) });
          submenus.push(sub);
          if (cancelled) return;
        }
        menu = await Menu.new({ items: submenus });
        if (cancelled) return;
        await menu.setAsAppMenu();
        // macOS adds the open windows to the one, the help search to the other.
        for (const [i, s] of APP_MENU.entries()) {
          if (s.role === "window") await submenus[i]!.setAsWindowsMenuForNSApp();
          if (s.role === "help") await submenus[i]!.setAsHelpMenuForNSApp();
        }
        liveRef.current = live;
        syncItems(live, entriesRef.current);
      } catch (e) {
        console.error("[forge] menu bar not set", e);
      }
    })();

    return () => {
      cancelled = true;
      liveRef.current = [];
      if (menu) void Menu.default().then((m) => m.setAsAppMenu()).catch(() => {});
    };
  }, []);

  useEffect(() => {
    entriesRef.current = entries;
    syncItems(liveRef.current, entries);
  }, [entries]);

  return null;
}

/** Only what changed goes to macOS: the entries are rebuilt on every status change of a session. */
function syncItems(live: Live[], entries: ReadonlyMap<string, PaletteEntry>) {
  for (const l of live) {
    const state = menuItemState(l.node, entries);
    if (state.text !== l.text) {
      l.text = state.text;
      void l.item.setText(state.text).catch(() => {});
    }
    if (state.enabled !== l.enabled) {
      l.enabled = state.enabled;
      void l.item.setEnabled(state.enabled).catch(() => {});
    }
  }
}
