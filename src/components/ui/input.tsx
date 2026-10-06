import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        "h-12 w-full rounded-2xl border border-line bg-surface-sunken px-4 text-[0.95rem] transition-colors outline-none placeholder:text-faint focus:border-accent/60 focus:bg-surface-hover",
        className,
      )}
      {...props}
    />
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(
          "min-h-24 w-full resize-none rounded-2xl border border-line bg-surface-sunken px-4 py-3 text-[0.95rem] leading-relaxed transition-colors outline-none placeholder:text-faint focus:border-accent/60 focus:bg-surface-hover",
          className,
        )}
        {...props}
      />
    );
  },
);

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("mb-2 block text-xs font-semibold tracking-wide text-muted uppercase", className)}
      {...props}
    />
  );
}
