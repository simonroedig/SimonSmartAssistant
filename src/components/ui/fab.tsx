import { Plus } from "lucide-react";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { Button, type ButtonProps } from "./button";

/**
 * The round "+" of a page (planner, notes): one look, one hover for all of them.
 * Pass the section's solid tone and the position in `className`.
 */
export const Fab = forwardRef<HTMLButtonElement, Omit<ButtonProps, "variant" | "size" | "children">>(function Fab(
  { className, ...props },
  ref,
) {
  return (
    <Button
      ref={ref}
      // "primary" has no border: a bordered button shows a light ring inside the action's edge.
      variant="primary"
      size="icon-lg"
      className={cn(
        // Hover: a touch bigger and brighter (the press still shrinks it).
        "ui-action z-30 rounded-full shadow-(--shadow-card) transition-[filter,scale,transform,box-shadow] hover:scale-108 hover:brightness-110 active:scale-[0.97]",
        className,
      )}
      {...props}
    >
      <Plus className="!size-6" />
    </Button>
  );
});
