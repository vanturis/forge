import { useEffect, useState, type KeyboardEvent, type PointerEvent } from "react";
import * as P from "@radix-ui/react-popover";
import { hexToHsv, hsvToHex, type Hsv } from "@/lib/design";
import { POPPER_MOTION } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";

const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));

/** Where in the element the pointer is, 0 to 1 on both axes; follows the pointer while a button is held, also outside the element. */
function drag(onMove: (x: number, y: number) => void) {
  const report = (e: PointerEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    onMove(clamp((e.clientX - r.left) / r.width), clamp((e.clientY - r.top) / r.height));
  };
  return {
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      report(e);
    },
    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) report(e);
    },
  };
}

const THUMB = "pointer-events-none absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgb(0_0_0/0.45),0_1px_3px_rgb(0_0_0/0.5)]";
const HUES = "linear-gradient(to right, hsl(0 100% 50%), hsl(60 100% 50%), hsl(120 100% 50%), hsl(180 100% 50%), hsl(240 100% 50%), hsl(300 100% 50%), hsl(360 100% 50%))";

/**
 * A color as a swatch that opens FORGE's own picker: a field for saturation and brightness and a bar
 * for the hue. Both follow the pointer and the arrow keys. The value is a hex color (#rrggbb).
 */
export function ColorPicker({ value, onChange, label }: { value: string; onChange: (hex: string) => void; label: string }) {
  const [hsv, setHsv] = useState(() => hexToHsv(value));
  // A value from outside (typed, taken from another scheme) moves the picker. Grey and black have no hue: keep the one shown.
  useEffect(() => {
    setHsv((prev) => {
      if (hsvToHex(prev) === value.toLowerCase()) return prev;
      const next = hexToHsv(value);
      return next.s === 0 || next.v === 0 ? { ...next, h: prev.h } : next;
    });
  }, [value]);

  const set = (next: Hsv) => {
    setHsv(next);
    const hex = hsvToHex(next);
    if (hex !== value.toLowerCase()) onChange(hex);
  };
  const step = (e: KeyboardEvent) => (e.shiftKey ? 0.1 : 0.02);
  const areaKey = (e: KeyboardEvent) => {
    const dx = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    const dy = e.key === "ArrowUp" ? 1 : e.key === "ArrowDown" ? -1 : 0;
    if (!dx && !dy) return;
    e.preventDefault();
    set({ ...hsv, s: clamp(hsv.s + dx * step(e)), v: clamp(hsv.v + dy * step(e)) });
  };
  const hueKey = (e: KeyboardEvent) => {
    const d = e.key === "ArrowRight" || e.key === "ArrowUp" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    set({ ...hsv, h: clamp(hsv.h + d * step(e) * 360, 0, 359.9) });
  };
  const pure = hsvToHex({ h: hsv.h, s: 1, v: 1 });

  return (
    <P.Root>
      <P.Trigger asChild>
        <button
          type="button"
          aria-label={label}
          title={label}
          className="h-8 w-10 shrink-0 rounded-md border border-border-strong shadow-xs transition-[border-color,transform] duration-120 hover:border-subtle active:scale-[0.97] data-[state=open]:border-accent"
          style={{ background: value }}
        />
      </P.Trigger>
      <P.Portal>
        <P.Content align="start" sideOffset={6} collisionPadding={12} className={cn("z-50 flex w-60 flex-col gap-3 rounded-xl border border-border bg-surface-2 p-3 shadow-xl outline-none", POPPER_MOTION)}>
          <div
            role="slider"
            tabIndex={0}
            aria-label={t.ui.colorPicker.area}
            aria-valuetext={`${Math.round(hsv.s * 100)} %, ${Math.round(hsv.v * 100)} %`}
            aria-valuenow={Math.round(hsv.s * 100)}
            onKeyDown={areaKey}
            {...drag((x, y) => set({ ...hsv, s: x, v: 1 - y }))}
            className="relative h-36 cursor-crosshair touch-none rounded-lg border border-border"
            style={{ background: `linear-gradient(to top, black, transparent), linear-gradient(to right, white, transparent), ${pure}` }}
          >
            <span className={THUMB} style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: hsvToHex(hsv) }} />
          </div>
          <div
            role="slider"
            tabIndex={0}
            aria-label={t.ui.colorPicker.hue}
            aria-valuemin={0}
            aria-valuemax={360}
            aria-valuenow={Math.round(hsv.h)}
            onKeyDown={hueKey}
            {...drag((x) => set({ ...hsv, h: clamp(x * 360, 0, 359.9) }))}
            className="relative mx-1.5 h-3 cursor-pointer touch-none rounded-full"
            style={{ background: HUES }}
          >
            <span className={cn(THUMB, "top-1/2")} style={{ left: `${(hsv.h / 360) * 100}%`, background: pure }} />
          </div>
        </P.Content>
      </P.Portal>
    </P.Root>
  );
}
