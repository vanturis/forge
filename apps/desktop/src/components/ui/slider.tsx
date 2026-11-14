import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

interface SliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  /** while the thumb moves */
  onChange: (v: number) => void;
  /** once the user lets go (pointer, key or focus): the moment to save */
  onCommit?: (v: number) => void;
  "aria-label": string;
  /** what a screen reader says for the value, e.g. "85 %" */
  valueText?: string;
  disabled?: boolean;
  className?: string;
}

/** A value on a scale. The native range input, so arrow keys, Home and End work; the look is `.slider` in styles.css. */
export function Slider({ value, min, max, step = 1, onChange, onCommit, valueText, disabled, className, ...rest }: SliderProps) {
  const fill = `${((value - min) / (max - min)) * 100}%`;
  const commit = (e: { currentTarget: HTMLInputElement }) => onCommit?.(Number(e.currentTarget.value));
  return (
    <input
      type="range"
      className={cn("slider", className)}
      style={{ "--slider-fill": fill } as CSSProperties}
      value={value}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      aria-label={rest["aria-label"]}
      aria-valuetext={valueText}
      onChange={(e) => onChange(Number(e.target.value))}
      onPointerUp={commit}
      onKeyUp={commit}
      onBlur={commit}
    />
  );
}
