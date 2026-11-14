import { useEffect } from "react";
import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { activeColorScheme, DEFAULT_SCHEME_ID, SCHEME_PRESETS, SchemeColors, WINDOW_OPACITY_MAX, WINDOW_OPACITY_MIN, type ColorScheme } from "@forge/protocol";
import { useSettings } from "./queries";
import { isTauri } from "./rpc";
import { isLinux } from "./platform";

type Rgb = [number, number, number];

function rgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function hex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("")}`;
}

/** `amount` of `b` in `a`, 0 to 1. */
export function mix(a: string, b: string, amount: number): string {
  const [x, y] = [rgb(a), rgb(b)];
  return hex([0, 1, 2].map((i) => x[i]! + (y[i]! - x[i]!) * amount) as Rgb);
}

/** Relative luminance (WCAG), 0 black to 1 white. */
export function luminance(color: string): number {
  const [r, g, b] = rgb(color).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** A scheme with a light background: code colors and the backdrop of dialogs follow (styles.css, data-tone). */
export function isLightScheme(scheme: ColorScheme): boolean {
  return luminance(scheme.colors.bg) > 0.4;
}

/**
 * The tokens of styles.css for a scheme. Its seven colors are named, the steps between them (raised
 * surfaces, borders, quieter text) are mixed in the same proportions FORGE's own look has.
 */
export function schemeTokens(scheme: ColorScheme): Record<string, string> {
  const { bg, surface, fg, accent, success, warning, danger } = scheme.colors;
  const light = isLightScheme(scheme);
  return {
    "--color-backdrop": scheme.backdrop ?? mix(bg, "#000000", light ? 0.07 : 0.4),
    "--color-bg": bg,
    "--color-sidebar": surface,
    "--color-surface": surface,
    "--color-surface-2": mix(surface, fg, 0.035),
    "--color-surface-3": mix(surface, fg, 0.08),
    "--color-border": mix(surface, fg, 0.095),
    "--color-border-strong": mix(surface, fg, 0.19),
    "--color-fg": fg,
    "--color-muted": mix(fg, bg, 0.34),
    "--color-subtle": mix(fg, bg, 0.56),
    "--color-accent": accent,
    "--color-accent-strong": mix(accent, "#000000", 0.12),
    "--color-accent-soft": `${accent}17`,
    // White where it reads on the accent, otherwise a dark tone of the accent itself. The limit lies just
    // below FORGE orange (2.8), so a scheme copied from FORGE's own keeps its white text.
    "--color-accent-fg": contrast(accent, "#ffffff") >= 2.75 ? "#ffffff" : mix(accent, "#000000", 0.82),
    "--color-success": success,
    "--color-success-soft": `${success}1f`,
    "--color-warning": warning,
    "--color-warning-soft": `${warning}1f`,
    "--color-danger": danger,
    "--color-danger-soft": `${danger}1f`,
    "--color-diff-add": `${success}1a`,
    "--color-diff-del": `${danger}1a`,
  };
}

const TOKEN_NAMES = Object.keys(schemeTokens(SCHEME_PRESETS[0]!));

/** Other parts that took colors from the tokens once (terminals) read them again on this event. */
export const DESIGN_EVENT = "forge:design";

function paint(scheme: ColorScheme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  // FORGE's own look is what styles.css says: no overrides, so it never drifts from the stylesheet.
  const tokens = scheme.id === DEFAULT_SCHEME_ID ? null : schemeTokens(scheme);
  for (const name of TOKEN_NAMES) {
    if (tokens) root.style.setProperty(name, tokens[name]!);
    else root.style.removeProperty(name);
  }
  if (isLightScheme(scheme)) root.dataset.tone = "light";
  else delete root.dataset.tone;
  window.dispatchEvent(new Event(DESIGN_EVENT));
}

const STORAGE_KEY = "forge.design";

/** The scheme of the last start: the settings answer only after the first render, and the start screen shall not flash in other colors. */
function storedScheme(): ColorScheme {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<ColorScheme> | null;
    const colors = SchemeColors.safeParse(raw?.colors);
    if (raw && colors.success && typeof raw.id === "string" && typeof raw.name === "string") {
      return { id: raw.id, name: raw.name, colors: colors.data, backdrop: typeof raw.backdrop === "string" && /^#[0-9a-f]{6}$/i.test(raw.backdrop) ? raw.backdrop : undefined, custom: raw.custom === true };
    }
  } catch {
    // nothing stored, or not readable: FORGE's own look
  }
  return SCHEME_PRESETS[0]!;
}

interface DesignState {
  /** the scheme of the settings */
  saved: ColorScheme;
  /** shown instead while the user tries one out (editor, hover); never stored */
  preview: ColorScheme | null;
}

export const useDesign = create<DesignState>(() => ({ saved: storedScheme(), preview: null }));

/** The scheme on screen right now. */
export const useShownScheme = () => useDesign((s) => s.preview ?? s.saved);

/** Before the first render (main.tsx): the colors of the last start. */
export function paintStoredDesign() {
  paint(useDesign.getState().saved);
}

function setSavedScheme(scheme: ColorScheme) {
  const { saved, preview } = useDesign.getState();
  if (JSON.stringify(saved) === JSON.stringify(scheme)) return;
  useDesign.setState({ saved: scheme });
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scheme));
  } catch {
    // only the next start flashes in the old colors
  }
  if (!preview) paint(scheme);
}

/** Shows a scheme without saving it; null goes back to the saved one. */
export function previewScheme(scheme: ColorScheme | null) {
  useDesign.setState({ preview: scheme });
  paint(scheme ?? useDesign.getState().saved);
}

/**
 * The shell can make a window see-through on Windows and macOS (set_window_opacity). GTK would need
 * a compositor that plays along, so Linux keeps solid windows and the setting is not offered there.
 */
export const supportsWindowOpacity = !isLinux;

/** Applies the opacity to this window right away, e.g. while the slider moves; the setting is saved by the caller. */
export function applyWindowOpacity(percent: number) {
  if (!isTauri() || !supportsWindowOpacity) return;
  void invoke("set_window_opacity", { percent: Math.round(Math.min(WINDOW_OPACITY_MAX, Math.max(WINDOW_OPACITY_MIN, percent))) }).catch(() => {});
}

/**
 * Every window follows the design settings: colors as CSS tokens, the opacity through the shell.
 * Changes from the settings, the palette, the phone or the sync all arrive as settings.updated.
 */
export function useDesignSync(): void {
  const s = useSettings().data;
  const schemeId = s?.colorScheme;
  const custom = s?.customSchemes;
  const opacity = s?.windowOpacity;
  useEffect(() => {
    if (schemeId === undefined || custom === undefined) return;
    setSavedScheme(activeColorScheme({ colorScheme: schemeId, customSchemes: custom }));
  }, [schemeId, custom]);
  useEffect(() => {
    if (opacity !== undefined) applyWindowOpacity(opacity);
  }, [opacity]);
}
