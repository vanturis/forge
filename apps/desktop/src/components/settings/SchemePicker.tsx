import { useEffect, useRef, useState } from "react";
import { Check, Copy, Pencil, Trash2 } from "lucide-react";
import { colorSchemes, WINDOW_OPACITY_MAX, WINDOW_OPACITY_MIN, type ColorScheme, type Settings } from "@forge/protocol";
import { applyWindowOpacity, schemeTokens } from "@/lib/design";
import { contextItems } from "@/lib/context-menu";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/misc";
import { Slider } from "@/components/ui/slider";
import type { MenuItem } from "@/components/ui/dropdown";
import { t } from "@/i18n";

const td = t.settings.design;
const ICON = "h-3.5 w-3.5";

export interface SchemeActions {
  onEdit: (scheme: ColorScheme) => void;
  onDuplicate: (scheme: ColorScheme) => void;
  onDelete: (scheme: ColorScheme) => void;
}

/**
 * The color schemes as cards with a small picture of the app in their colors. Choosing saves right
 * away. With `actions` (the settings) the cards also offer edit, copy and delete on a right click.
 */
export function SchemePicker({
  s,
  onPick,
  actions,
  compact,
  className,
}: {
  s: Pick<Settings, "colorScheme" | "customSchemes">;
  onPick: (id: string) => void;
  actions?: SchemeActions;
  /** lower pictures, where the cards share a dialog with other things (setup assistant) */
  compact?: boolean;
  className?: string;
}) {
  const schemes = colorSchemes(s.customSchemes);
  const current = schemes.some((x) => x.id === s.colorScheme) ? s.colorScheme : schemes[0]!.id;
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const move = (index: number, step: number) => {
    const next = (index + step + schemes.length) % schemes.length;
    onPick(schemes[next]!.id);
    refs.current[next]?.focus();
  };
  return (
    <div role="radiogroup" aria-label={td.pickerLabel} className={cn("grid grid-cols-3 gap-3", className)}>
      {schemes.map((scheme, i) => {
        const checked = scheme.id === current;
        const menu = (): MenuItem[] => [
          { label: td.apply, icon: <Check className={ICON} />, disabled: checked, onSelect: () => onPick(scheme.id) },
          ...(actions
            ? [
                ...(scheme.custom ? [{ label: td.edit, icon: <Pencil className={ICON} />, onSelect: () => actions.onEdit(scheme) }] : []),
                { label: td.duplicate, icon: <Copy className={ICON} />, onSelect: () => actions.onDuplicate(scheme) },
                ...(scheme.custom ? [{ label: td.delete, icon: <Trash2 className={ICON} />, danger: true, onSelect: () => actions.onDelete(scheme) }] : []),
              ]
            : []),
        ];
        return (
          <button
            key={scheme.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            onClick={() => !checked && onPick(scheme.id)}
            onKeyDown={(e) => {
              const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
              if (!step) return;
              e.preventDefault();
              move(i, step);
            }}
            onContextMenu={contextItems(menu)}
            className={cn(
              "flex flex-col gap-2.5 rounded-xl border p-2.5 text-left transition-colors duration-120",
              checked ? "border-accent bg-accent-soft" : "border-border bg-surface-2/40 hover:border-border-strong",
            )}
          >
            <SchemePreview scheme={scheme} className={compact ? "h-14" : undefined} />
            <span className="flex min-w-0 items-center gap-2 px-1 pb-0.5">
              <span className="min-w-0 flex-1 truncate text-body font-medium" title={scheme.name}>
                {scheme.name}
              </span>
              {scheme.custom && <Badge>{td.ownBadge}</Badge>}
              {checked && <Check className="h-4 w-4 shrink-0 text-accent" aria-hidden />}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** The shell of FORGE in miniature, drawn in the colors of a scheme: backdrop, sidebar, main area with a few lines. */
export function SchemePreview({ scheme, className }: { scheme: ColorScheme; className?: string }) {
  const c = schemeTokens(scheme);
  const bar = "h-1 rounded-full";
  return (
    <span aria-hidden className={cn("flex h-18 gap-1 rounded-lg p-1.5", className)} style={{ background: c["--color-backdrop"] }}>
      <span className="flex w-[28%] flex-col gap-1 rounded-md border p-1.5" style={{ background: c["--color-sidebar"], borderColor: c["--color-border"] }}>
        <span className="h-2 rounded-full" style={{ background: c["--color-accent"] }} />
        <span className={cn(bar, "w-4/5")} style={{ background: c["--color-subtle"] }} />
        <span className={cn(bar, "w-3/5")} style={{ background: c["--color-subtle"] }} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1 rounded-md border p-1.5" style={{ background: c["--color-bg"], borderColor: c["--color-border"] }}>
        <span className={cn(bar, "w-2/5")} style={{ background: c["--color-fg"] }} />
        <span className={cn(bar, "w-4/5")} style={{ background: c["--color-muted"] }} />
        <span className={cn(bar, "w-3/5")} style={{ background: c["--color-muted"] }} />
        <span className="mt-auto flex items-center gap-1">
          {(["--color-success", "--color-warning", "--color-danger"] as const).map((k) => (
            <span key={k} className="h-1.5 w-1.5 rounded-full" style={{ background: c[k] }} />
          ))}
          <span className="ml-auto h-2 w-6 rounded-full" style={{ background: c["--color-accent"] }} />
        </span>
      </span>
    </span>
  );
}

/**
 * Opacity of the windows. The window follows while the thumb moves; saved is only where the user
 * lets go, so dragging does not write a setting (and a sync) per step.
 */
export function OpacitySlider({ value, onSave, className }: { value: number; onSave: (percent: number) => void; className?: string }) {
  const [draft, setDraft] = useState(value);
  // A change from elsewhere (palette, phone, sync) moves the thumb too.
  useEffect(() => setDraft(value), [value]);
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <Slider
        value={draft}
        min={WINDOW_OPACITY_MIN}
        max={WINDOW_OPACITY_MAX}
        onChange={(v) => {
          setDraft(v);
          applyWindowOpacity(v);
        }}
        onCommit={(v) => v !== value && onSave(v)}
        aria-label={td.opacityLabel}
        valueText={td.percent(draft)}
        className="min-w-0 flex-1"
      />
      <span className="w-12 shrink-0 text-right text-body tabular-nums text-muted">{td.percent(draft)}</span>
    </div>
  );
}
