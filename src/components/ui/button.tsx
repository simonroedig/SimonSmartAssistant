import { Slot } from "radix-ui";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "soft";
type Size = "sm" | "md" | "lg" | "icon" | "icon-sm" | "icon-lg";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-accent-fg shadow-[0_8px_24px_-10px_var(--accent)] hover:brightness-110 active:brightness-95",
  secondary: "bg-surface-hover text-fg border border-line hover:bg-surface-sunken",
  ghost: "text-muted hover:text-fg hover:bg-surface-hover",
  soft: "bg-accent-soft text-accent hover:brightness-110",
  danger: "bg-danger/12 text-danger hover:bg-danger/20",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3.5 text-sm gap-1.5 rounded-xl",
  md: "h-11 px-4.5 text-[0.95rem] gap-2 rounded-2xl",
  lg: "h-13 px-6 text-base gap-2.5 rounded-2xl",
  icon: "size-11 rounded-2xl",
  "icon-sm": "size-9 rounded-xl",
  "icon-lg": "size-13 rounded-2xl",
};

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  asChild?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "secondary", size = "md", asChild, type, ...props },
  ref,
) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      ref={ref}
      type={asChild ? undefined : (type ?? "button")}
      className={cn(
        "ui-btn inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap transition-[background-color,color,filter,transform,box-shadow] duration-150 select-none active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-[1.15em] [&_svg]:shrink-0",
        `ui-btn-${variant}`,
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
});
