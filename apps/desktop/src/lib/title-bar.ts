import { create } from "zustand";
import { isWindows } from "./platform";

/**
 * Whether FORGE draws its own title bar (components/layout/TitleBar.tsx) instead of the native one.
 * Windows only: there the shell opens the windows without a frame. macOS and Linux keep their native
 * title bar and menu, and the app-wide buttons stay in the page headers.
 */
export const hasTitleBar = isWindows && typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/** The place in the title bar that takes the layout switches of the open project (InTitleBar). */
export const useTitleBarSlot = create<{ el: HTMLElement | null }>(() => ({ el: null }));
