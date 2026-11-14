import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  // Pressed state: a short dip on mousedown, so every click is felt before anything else happens.
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-120 ease-snappy active:scale-[0.97] active:duration-75 disabled:pointer-events-none disabled:opacity-50 select-none",
  {
    variants: {
      variant: {
        // Important: tailwind-merge takes the size class text-body for a color and would drop the color before it.
        // On FORGE's orange that went unseen (white next to near-white); a light accent needs its dark text.
        primary: "bg-accent text-accent-fg! shadow-md hover:bg-accent-strong",
        secondary: "bg-surface-3 text-fg shadow-xs hover:bg-border-strong",
        ghost: "text-muted hover:text-fg hover:bg-surface-3 active:bg-border-strong",
        outline: "border border-border text-fg shadow-xs hover:border-border-strong hover:bg-surface-3",
        danger: "bg-danger text-accent-fg! shadow-md hover:opacity-90",
        "danger-ghost": "text-danger hover:bg-danger-soft",
      },
      size: {
        sm: "h-7 px-3 text-xs",
        md: "h-8 px-3.5 text-body",
        lg: "h-10 px-5 text-sm",
        icon: "h-8 w-8",
        "icon-sm": "h-7 w-7",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, disabled, children, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      // While loading, the spinner replaces the button's own icon.
      className={cn(buttonVariants({ variant, size }), "aria-busy:[&>svg:not(.animate-spin)]:hidden", className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
      {children}
    </button>
  ),
);
Button.displayName = "Button";
