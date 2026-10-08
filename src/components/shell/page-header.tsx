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
        "flex flex-wrap items-end gap-3 px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-4 md:px-8 md:pt-7",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight md:text-[2rem]">{title}</h1>
        {subtitle && <p className="mt-0.5 text-[0.95rem] text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
    </header>
  );
}

export function PageBody({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("px-4 pb-8 md:px-8", className)}>{children}</div>;
}

/**
 * Phones: the page fills the screen above the tab bar, so a list's "add" bar
 * can sit at the bottom (near the thumb) even while the list is short.
 */
export function FillPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[calc(100dvh-6.5rem-env(safe-area-inset-bottom))] flex-col md:block md:min-h-0">
      {children}
    </div>
  );
}
