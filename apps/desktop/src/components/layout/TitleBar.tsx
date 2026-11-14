import { Component, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Copy, Minus, Square, X } from "lucide-react";
import { hasTitleBar, useTitleBarSlot } from "@/lib/title-bar";
import { SupportButton } from "@/components/settings/SupportSettings";
import { AlwaysOnTopButton } from "./AlwaysOnTopButton";
import { Logo } from "./Logo";
import { PhoneButton } from "./PhoneButton";
import { SearchField } from "./SearchField";
import { SyncButton } from "./SyncButton";
import { t } from "@/i18n";

/**
 * FORGE's own title bar on Windows, in place of the native one: logo, the search in the middle, the
 * layout switches of the open project and the app-wide buttons, then minimize, maximize and close.
 * Everything without `data-tauri-drag-region` is a control; the rest moves the window.
 * `bare` while the app starts (no sidecar yet) and in chat windows, which carry their own header.
 */
export function TitleBar({ mode }: { mode: "bare" | "main" }) {
  return (
    <header data-tauri-drag-region className="flex h-10 shrink-0 select-none items-center">
      <div data-tauri-drag-region className="flex min-w-0 flex-1 items-center pl-4.5">
        <span className="pointer-events-none flex">
          <Logo height={18} />
        </span>
      </div>
      {mode === "main" && (
        <Quiet>
          <MainItems />
        </Quiet>
      )}
      <WindowControls />
    </header>
  );
}

const setSlot = (el: HTMLElement | null) => useTitleBarSlot.setState({ el });

function MainItems() {
  return (
    <>
      <div className="w-[min(26rem,34vw)] shrink-0">
        <SearchField compact />
      </div>
      {/* One size for every icon button here, whatever it has in a page header. */}
      <div data-tauri-drag-region className="flex min-w-0 flex-1 items-center justify-end gap-0.5 pl-3 pr-2 [&_button[aria-label]]:h-7 [&_button[aria-label]]:w-7">
        <div ref={setSlot} className="flex items-center gap-0.5 empty:hidden" />
        <span aria-hidden className="mx-1.5 h-4 w-px shrink-0 bg-border [div:empty+&]:hidden" />
        <SupportButton compact />
        <SyncButton />
        <PhoneButton />
        <AlwaysOnTopButton />
      </div>
    </>
  );
}

/**
 * Puts its children into the title bar where FORGE has one, and leaves them in place elsewhere.
 * A portal, so they keep the context of the place they are written in (project, split view).
 */
export function InTitleBar({ children }: { children: ReactNode }) {
  const el = useTitleBarSlot((s) => s.el);
  if (!hasTitleBar) return <>{children}</>;
  return el ? createPortal(children, el) : null;
}

function WindowControls() {
  const [maximized, setMaximized] = useState(false);
  useEffect(() => {
    const win = getCurrentWindow();
    let gone = false;
    let off: (() => void) | undefined;
    const read = () =>
      void win
        .isMaximized()
        .then((m) => !gone && setMaximized(m === true))
        .catch(() => {});
    read();
    void win
      .onResized(read)
      .then((unlisten) => {
        if (gone) unlisten();
        else off = unlisten;
      })
      .catch(() => {});
    return () => {
      gone = true;
      off?.();
    };
  }, []);
  const win = () => getCurrentWindow();
  const tb = t.layout.titleBar;
  const button = "grid h-10 w-11.5 place-items-center text-muted transition-colors duration-120 hover:bg-surface-2 hover:text-fg focus-visible:outline-offset-[-2px]";
  return (
    <div className="flex shrink-0">
      <button type="button" className={button} aria-label={tb.minimize} title={tb.minimize} onClick={() => void win().minimize().catch(() => {})}>
        <Minus className="h-4 w-4" strokeWidth={1.5} />
      </button>
      <button type="button" className={button} aria-label={maximized ? tb.restore : tb.maximize} title={maximized ? tb.restore : tb.maximize} onClick={() => void win().toggleMaximize().catch(() => {})}>
        {maximized ? <Copy className="h-3.5 w-3.5 -scale-x-100" strokeWidth={1.5} /> : <Square className="h-3.5 w-3.5" strokeWidth={1.5} />}
      </button>
      {/* close() asks first: the main window may offer to push, a chat window hands its draft back. */}
      <button type="button" className={`${button} hover:bg-danger hover:text-accent-fg`} aria-label={tb.close} title={tb.close} onClick={() => void win().close().catch(() => {})}>
        <X className="h-4 w-4" strokeWidth={1.5} />
      </button>
    </div>
  );
}

/** An error in a button of the bar must not take the window controls with it. */
class Quiet extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch(error: Error) {
    console.error("[forge] title bar", error);
  }
  override render() {
    return this.state.failed ? <div data-tauri-drag-region className="flex-1 self-stretch" /> : this.props.children;
  }
}
