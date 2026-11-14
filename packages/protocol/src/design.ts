import { z } from "zod";

const Hex = z.string().regex(/^#[0-9a-f]{6}$/i);

/** The colors a scheme names; every other token of the interface is mixed from them (desktop lib/design.ts). */
export const SchemeColors = z.object({
  /** main area */
  bg: Hex,
  /** sidebar, cards, dialogs */
  surface: Hex,
  fg: Hex,
  accent: Hex,
  success: Hex,
  warning: Hex,
  danger: Hex,
});
export type SchemeColors = z.infer<typeof SchemeColors>;

export const CUSTOM_SCHEME_PREFIX = "custom-";
export const MAX_CUSTOM_SCHEMES = 20;

/** A color scheme the user made; kept in the settings, so it syncs with them. */
export const CustomScheme = z.object({
  id: z.string().regex(/^custom-[a-z0-9]{4,24}$/),
  name: z.string().trim().min(1).max(40),
  colors: SchemeColors,
});
export type CustomScheme = z.infer<typeof CustomScheme>;

export interface ColorScheme {
  id: string;
  /** a proper name, the same in every language */
  name: string;
  colors: SchemeColors;
  /** the window behind the panels; mixed from bg when left out */
  backdrop?: string;
  custom?: boolean;
}

export const DEFAULT_SCHEME_ID = "default";

/**
 * The schemes FORGE ships. The first one is FORGE's own look: its tokens stand in styles.css and are
 * not derived, the colors here only feed previews. The others follow the palettes they are named after.
 */
export const SCHEME_PRESETS: readonly ColorScheme[] = [
  { id: DEFAULT_SCHEME_ID, name: "FORGE", backdrop: "#0b0b0c", colors: { bg: "#131314", surface: "#19191a", fg: "#ececee", accent: "#f97316", success: "#3fb97a", warning: "#d9a23b", danger: "#f0605a" } },
  { id: "gruvbox", name: "Gruvbox", backdrop: "#1d2021", colors: { bg: "#282828", surface: "#32302f", fg: "#ebdbb2", accent: "#fabd2f", success: "#b8bb26", warning: "#fe8019", danger: "#fb4934" } },
  { id: "vampire", name: "Vampire", backdrop: "#1e1f29", colors: { bg: "#282a36", surface: "#2f3241", fg: "#f8f8f2", accent: "#bd93f9", success: "#50fa7b", warning: "#ffb86c", danger: "#ff5555" } },
  { id: "nord", name: "Nord", backdrop: "#242933", colors: { bg: "#2e3440", surface: "#353c4a", fg: "#eceff4", accent: "#88c0d0", success: "#a3be8c", warning: "#ebcb8b", danger: "#bf616a" } },
  { id: "tokyo-night", name: "Tokyo Night", backdrop: "#13141c", colors: { bg: "#1a1b26", surface: "#1f2130", fg: "#c0caf5", accent: "#7aa2f7", success: "#9ece6a", warning: "#e0af68", danger: "#f7768e" } },
  { id: "catppuccin", name: "Catppuccin", backdrop: "#11111b", colors: { bg: "#1e1e2e", surface: "#252536", fg: "#cdd6f4", accent: "#cba6f7", success: "#a6e3a1", warning: "#f9e2af", danger: "#f38ba8" } },
  { id: "solarized", name: "Solarized", backdrop: "#00212b", colors: { bg: "#002b36", surface: "#073642", fg: "#eee8d5", accent: "#2aa198", success: "#859900", warning: "#b58900", danger: "#dc322f" } },
  { id: "everforest", name: "Everforest", backdrop: "#232a2e", colors: { bg: "#2d353b", surface: "#343f44", fg: "#d3c6aa", accent: "#a7c080", success: "#83c092", warning: "#dbbc7f", danger: "#e67e80" } },
  { id: "rose-pine", name: "Rosé Pine", backdrop: "#12101b", colors: { bg: "#191724", surface: "#1f1d2e", fg: "#e0def4", accent: "#ebbcba", success: "#9ccfd8", warning: "#f6c177", danger: "#eb6f92" } },
];

/** Every scheme there is to choose: the presets, then the user's own. */
export function colorSchemes(custom: readonly CustomScheme[] = []): ColorScheme[] {
  return [...SCHEME_PRESETS, ...custom.map((c) => ({ ...c, custom: true }))];
}

/** The scheme the settings name; FORGE's own when it is gone (deleted here or on another computer). */
export function activeColorScheme(s: { colorScheme: string; customSchemes: readonly CustomScheme[] }): ColorScheme {
  return colorSchemes(s.customSchemes).find((x) => x.id === s.colorScheme) ?? SCHEME_PRESETS[0]!;
}

/** Opacity of the windows in percent. Below the minimum the interface is too faint to read. */
export const WINDOW_OPACITY_MIN = 50;
export const WINDOW_OPACITY_MAX = 100;
/** Steps the command palette offers; the slider in the settings takes every value. */
export const WINDOW_OPACITY_CHOICES = [100, 95, 90, 85, 80, 70] as const;
