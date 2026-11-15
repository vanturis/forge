import type { ReactNode } from "react";
import { AlwaysOnTopButton } from "./AlwaysOnTopButton";
import { SyncButton } from "./SyncButton";
import { PhoneButton } from "./PhoneButton";
import { hasTitleBar, windowDrag } from "@/lib/title-bar";

/** Thin vertical line between groups of header controls. */
export function HeaderDivider() {
  return <span className="mx-1 h-5 w-px shrink-0 bg-border" aria-hidden />;
}

/**
 * Sync, pin and phone at the right end of a header. Where FORGE draws its own title bar (Windows) they
 * sit there instead and the header keeps the room.
 */
export function AppButtons({ divider = false }: { divider?: boolean }) {
  if (hasTitleBar) return null;
  return (
    <>
      {divider && <HeaderDivider />}
      <SyncButton />
      <AlwaysOnTopButton />
      <PhoneButton />
    </>
  );
}

export function Page({ title, subtitle, actions, children }: { title: string; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <header {...windowDrag} className="flex min-h-18 select-none items-center justify-between gap-4 px-7 pb-3 pt-5">
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em]">{title}</h1>
          {subtitle && <div className="mt-0.5 text-body text-muted">{subtitle}</div>}
        </div>
        {/* Not part of the drag area: a page's actions may hold controls Tauri does not recognize as such. */}
        <div data-tauri-drag-region="false" className="flex shrink-0 items-center gap-2">
          {actions}
          <AppButtons divider={!!actions} />
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-7 pb-6 pt-3">{children}</div>
    </div>
  );
}
