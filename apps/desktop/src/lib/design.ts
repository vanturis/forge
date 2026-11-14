import { useEffect } from "react";
import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { activeColorScheme, DEFAULT_SCHEME_ID, SCHEME_PRESETS, SchemeColors, Transparency, type ColorScheme } from "@forge/protocol";
import { useSettings } from "./queries";
import { isTauri } from "./rpc";

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

/** Hue 0 to 360, saturation and value 0 to 1 (the color picker works in these). */
export interface Hsv {
  h: number;
  s: number;
  v: number;
}

export function hexToHsv(color: string): Hsv {
  const [r, g, b] = rgb(color).map((x) => x / 255) as Rgb;
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  const h = !d ? 0 : max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s: max ? d / max : 0, v: max };
}

export function hsvToHex({ h, s, v }: Hsv): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return hex([(r + m) * 255, (g + m) * 255, (b + m) * 255]);
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

/** What styles.css says for FORGE's own look; the translucent backdrop of a transparency step is mixed from these. */
const OWN_TOKENS = schemeTokens(SCHEME_PRESETS[0]!);

const withAlpha = (color: string, alpha: number) => `${color}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`;

function paint(scheme: ColorScheme, transparency: Transparency) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  // FORGE's own look is what styles.css says: no overrides, so it never drifts from the stylesheet.
  const tokens = scheme.id === DEFAULT_SCHEME_ID ? null : schemeTokens(scheme);
  for (const name of TOKEN_NAMES) {
    if (tokens) root.style.setProperty(name, tokens[name]!);
    else root.style.removeProperty(name);
  }
  // The window is transparent on Windows; what shows of the blur behind it is decided here: the backdrop
  // between the panels and, from "medium" on, the sidebar are painted translucent. Solid otherwise.
  const look = TRANSPARENCY_LOOK[transparency];
  const base = tokens ?? OWN_TOKENS;
  if (look) {
    root.style.setProperty("--color-backdrop", withAlpha(base["--color-backdrop"]!, look.backdrop));
    if (look.side < 1) root.style.setProperty("--color-shell-side", withAlpha(base["--color-sidebar"]!, look.side));
    else root.style.removeProperty("--color-shell-side");
  } else root.style.removeProperty("--color-shell-side");
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

/** How solid the window's backdrop and the sidebar are painted per step; the main area and everything on it stay solid. */
const TRANSPARENCY_LOOK: Record<Transparency, { backdrop: number; side: number } | null> = {
  off: null,
  light: { backdrop: 0.8, side: 1 },
  medium: { backdrop: 0.55, side: 0.9 },
  strong: { backdrop: 0.3, side: 0.7 },
};

const TRANSPARENCY_KEY = "forge.transparency";

/** The step painted at the last start (only kept where the system supports it). */
function storedTransparency(): Transparency {
  try {
    const parsed = Transparency.safeParse(localStorage.getItem(TRANSPARENCY_KEY));
    return parsed.success ? parsed.data : "off";
  } catch {
    return "off";
  }
}

interface DesignState {
  /** the scheme of the settings */
  saved: ColorScheme;
  /** shown instead while the user tries one out (editor, hover); never stored */
  preview: ColorScheme | null;
  /** the step this window paints: the setting where the system can blur behind a window, "off" elsewhere */
  transparency: Transparency;
  /** whether the shell can blur behind a window (Windows 11 22H2 and newer); null until it answered */
  transparencySupported: boolean | null;
}

export const useDesign = create<DesignState>(() => ({ saved: storedScheme(), preview: null, transparency: storedTransparency(), transparencySupported: isTauri() ? null : false }));

if (isTauri()) {
  invoke<boolean>("transparency_supported").then(
    (supported) => useDesign.setState({ transparencySupported: supported === true }),
    () => useDesign.setState({ transparencySupported: false }),
  );
}

/** The scheme on screen right now. */
export const useShownScheme = () => useDesign((s) => s.preview ?? s.saved);

/** Whether the transparency setting does anything here; the interface offers it only then. */
export const useTransparencySupported = () => useDesign((s) => s.transparencySupported === true);

const repaint = () => {
  const s = useDesign.getState();
  paint(s.preview ?? s.saved, s.transparency);
};

/** Before the first render (main.tsx): the colors of the last start. */
export function paintStoredDesign() {
  repaint();
}

function setSavedScheme(scheme: ColorScheme) {
  const { saved } = useDesign.getState();
  if (JSON.stringify(saved) === JSON.stringify(scheme)) return;
  useDesign.setState({ saved: scheme });
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scheme));
  } catch {
    // only the next start flashes in the old colors
  }
  repaint();
}

/** Shows a scheme without saving it; null goes back to the saved one. */
export function previewScheme(scheme: ColorScheme | null) {
  useDesign.setState({ preview: scheme });
  repaint();
}

function setTransparency(level: Transparency) {
  if (useDesign.getState().transparency !== level) {
    useDesign.setState({ transparency: level });
    try {
      localStorage.setItem(TRANSPARENCY_KEY, level);
    } catch {
      // only the next start begins solid
    }
    repaint();
  }
  // The shell switches the blur behind this window; a new window starts with it and is told here if it is off.
  if (isTauri()) void invoke("set_window_transparency", { on: level !== "off" }).catch(() => {});
}

/**
 * Every window follows the design settings: colors as CSS tokens, the blur behind the window through
 * the shell. Changes from the settings, the palette, the phone or the sync all arrive as settings.updated.
 */
export function useDesignSync(): void {
  const s = useSettings().data;
  const schemeId = s?.colorScheme;
  const custom = s?.customSchemes;
  const level = s?.transparency;
  const supported = useDesign((d) => d.transparencySupported);
  useEffect(() => {
    if (schemeId === undefined || custom === undefined) return;
    setSavedScheme(activeColorScheme({ colorScheme: schemeId, customSchemes: custom }));
  }, [schemeId, custom]);
  useEffect(() => {
    if (level === undefined || supported === null) return;
    setTransparency(supported ? level : "off");
  }, [level, supported]);
}
