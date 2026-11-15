import { create } from "zustand";
import { isWindows } from "./platform";

/**
 * Whether FORGE draws its own title bar (components/layout/TitleBar.tsx) instead of the native one.
 * Windows only: there the shell opens the windows without a frame. macOS and Linux keep their native
 * title bar and menu, and the app-wide buttons stay in the page headers.
 */
export const hasTitleBar = isWindows && typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/**
 * For the head row of an area (project header, page header): dragging it moves the window like the title
 * bar does, a double click maximizes, and its text cannot be marked by accident. "deep" covers the texts
 * and icons inside; Tauri leaves buttons, links and inputs out, they keep working. Add `select-none`
 * to the classes: the attribute alone stops the marking only inside the Tauri window.
 */
export const windowDrag = { "data-tauri-drag-region": "deep" } as const;

/** The place in the title bar that takes the layout switches of the open project (InTitleBar). */
export const useTitleBarSlot = create<{ el: HTMLElement | null }>(() => ({ el: null }));
