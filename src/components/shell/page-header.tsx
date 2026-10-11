import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        // One row: the title (its subtitle wraps if need be) and the actions beside it.
        "flex items-end gap-3 px-4 pt-[calc(var(--safe-top)+1.25rem)] pb-4 md:pt-(--gutter) md:pr-(--gutter) md:pl-0",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <h1 className="ui-title text-[1.75rem] leading-tight font-semibold tracking-tight md:text-[2rem]">{title}</h1>
        {subtitle && <p className="mt-0.5 text-[0.95rem] text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="ml-auto flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

export function PageBody({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("px-4 pb-8 md:pr-(--gutter) md:pb-(--gutter) md:pl-0", className)}>{children}</div>;
}

/**
 * Phones: the page is exactly the screen above the tab bar and never scrolls
 * itself – the list inside scrolls, and its "add" row stays at the bottom,
 * near the thumb.
 */
export function FillPage({ children }: { children: React.ReactNode }) {
  return (
    // Clipped (not scrolled), with room for the cards' shadows to show above the tab bar.
    <div className="flex flex-col max-md:h-[calc(100dvh-var(--page-bottom))] max-md:overflow-clip max-md:[overflow-clip-margin:1.5rem] md:block">
      {children}
    </div>
  );
}

/** Body of a `FillPage`: on phones it takes the remaining height. */
export const FILL_BODY = "max-md:flex max-md:min-h-0 max-md:flex-1 max-md:flex-col max-md:pb-0";
