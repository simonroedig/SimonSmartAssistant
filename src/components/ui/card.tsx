import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function Card({
  className,
  children,
  as: Tag = "section",
  ...props
}: React.HTMLAttributes<HTMLElement> & { as?: "section" | "div" | "article" }) {
  return (
    <Tag className={cn("relative flex min-w-0 flex-col rounded-[1.75rem] glass", className)} {...props}>
      {children}
    </Tag>
  );
}

/** Card header with an icon badge, title, optional count and actions. */
export function CardHeader({
  icon,
  title,
  count,
  href,
  tone = "accent",
  actions,
  className,
}: {
  icon: React.ReactNode;
  title: string;
  count?: number;
  href?: string;
  tone?: "accent" | "sky" | "emerald" | "amber" | "rose";
  actions?: React.ReactNode;
  className?: string;
}) {
  const tones = {
    accent: "bg-accent-soft text-accent",
    sky: "bg-sky-500/14 text-sky-600 dark:text-sky-300",
    emerald: "bg-emerald-500/14 text-emerald-600 dark:text-emerald-300",
    amber: "bg-amber-500/16 text-amber-600 dark:text-amber-300",
    rose: "bg-rose-500/14 text-rose-600 dark:text-rose-300",
  } as const;

  const label = (
    <>
      <span className={cn("grid size-9 place-items-center rounded-xl [&_svg]:size-[18px]", tones[tone])}>{icon}</span>
      <span className="text-[0.95rem] font-semibold tracking-tight">{title}</span>
      {typeof count === "number" && count > 0 && (
        <span className="rounded-full bg-surface-hover px-2 py-0.5 text-xs font-semibold text-muted tabular">
          {count}
        </span>
      )}
    </>
  );

  return (
    <div className={cn("flex items-center gap-3 px-5 pt-4 pb-3", className)}>
      {href ? (
        <Link href={href} className="group flex min-w-0 items-center gap-3">
          {label}
          <ChevronRight className="size-4 text-faint transition-transform group-hover:translate-x-0.5" />
        </Link>
      ) : (
        <div className="flex min-w-0 items-center gap-3">{label}</div>
      )}
      {actions && <div className="ml-auto flex items-center gap-1">{actions}</div>}
    </div>
  );
}
