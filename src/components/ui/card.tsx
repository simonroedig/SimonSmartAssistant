import { ChevronRight } from "lucide-react";
import { AppLink } from "@/components/shell/app-link";
import { type Tone, TONE_STYLES } from "@/lib/tones";
import { cn } from "@/lib/utils";

export function Card({
  className,
  children,
  as: Tag = "section",
  ...props
}: React.HTMLAttributes<HTMLElement> & { as?: "section" | "div" | "article" }) {
  return (
    <Tag className={cn("relative flex min-w-0 flex-col rounded-(--radius-card) glass", className)} {...props}>
      {children}
    </Tag>
  );
}

/** Card header with an icon badge, title, optional subtitle/count and actions. */
export function CardHeader({
  icon,
  title,
  subtitle,
  titleClassName,
  count,
  href,
  tone = "accent",
  actions,
  className,
}: {
  icon: React.ReactNode;
  title: string;
  /** Small second line under the title (e.g. a date). */
  subtitle?: string;
  /** Extra classes for the title text (e.g. the blue "Today"). */
  titleClassName?: string;
  count?: number;
  href?: string;
  tone?: Tone;
  actions?: React.ReactNode;
  className?: string;
}) {
  const styles = TONE_STYLES[tone];
  const label = (
    <>
      <span
        className={cn(
          "ui-badge grid size-9 shrink-0 place-items-center rounded-xl [&_svg]:size-[18px]",
          styles.soft,
          styles.text,
        )}
      >
        {icon}
      </span>
      <span className="flex min-w-0 flex-col">
        <span
          className={cn("ui-title truncate text-[0.95rem] leading-tight font-semibold tracking-tight", titleClassName)}
        >
          {title}
        </span>
        {subtitle && <span className="truncate text-xs leading-tight text-muted tabular">{subtitle}</span>}
      </span>
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
        <AppLink href={href} className="group flex min-w-0 items-center gap-3">
          {label}
          <ChevronRight className="size-4 shrink-0 text-faint transition-transform group-hover:translate-x-0.5" />
        </AppLink>
      ) : (
        <div className="flex min-w-0 items-center gap-3">{label}</div>
      )}
      {actions && <div className="ml-auto flex shrink-0 items-center gap-1">{actions}</div>}
    </div>
  );
}

/** Bottom link of a home card that only shows its first items ("4 more"). */
export function CardMoreLink({ href, tone, children }: { href: string; tone: Tone; children: React.ReactNode }) {
  return (
    <AppLink
      href={href}
      className={cn(
        "mt-2 flex h-11 items-center justify-center gap-1 rounded-2xl text-sm font-semibold transition-colors well hover:bg-surface-hover active:bg-surface-hover",
        TONE_STYLES[tone].text,
      )}
    >
      {children}
      <ChevronRight className="size-4" />
    </AppLink>
  );
}
