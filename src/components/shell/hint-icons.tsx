/**
 * The menu's icons, changed by what's in the section instead of badges on top:
 * the backlog's box becomes a star when something is starred and its tick becomes
 * the number of open items; the shopping basket holds the number in place of its
 * weave; Settings' two knobs fill in amber when a backup is due.
 * Drawn like Lucide's (24 grid, round strokes), so they sit among the others.
 */

import { cn } from "@/lib/utils";

type IconProps = { className?: string; strokeWidth?: number };

function Svg({ className, strokeWidth = 2, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn("lucide", className)}
    >
      {children}
    </svg>
  );
}

/** A number drawn into an icon (≤ 9 as it is, more as "9+"). */
function Count({ x, y, value, size }: { x: number; y: number; value: number; size: number }) {
  const text = value > 9 ? "9+" : String(value);
  return (
    <text
      x={x}
      y={y}
      data-hint="count"
      data-count={text}
      fill="currentColor"
      stroke="none"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={text.length > 1 ? size * 0.86 : size}
      fontWeight={800}
      style={{ fontFamily: "var(--font-sans)", fontVariantNumeric: "tabular-nums" }}
    >
      {text}
    </text>
  );
}

/** Five points around (cx, cy). */
function starPath(cx: number, cy: number, r: number): string {
  const points = Array.from({ length: 10 }, (_, i) => {
    const radius = i % 2 === 0 ? r : r * 0.48;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    return `${(cx + radius * Math.cos(angle)).toFixed(2)} ${(cy + radius * Math.sin(angle)).toFixed(2)}`;
  });
  return `M${points.join("L")}Z`;
}

export function BacklogIcon({ star, count, ...props }: IconProps & { star?: boolean; count?: number }) {
  return (
    <Svg {...props}>
      <path d="M13 5h8" />
      <path d="M13 12h8" />
      <path d="M13 19h8" />
      {star ? (
        <path d={starPath(6, 7.2, 4.3)} data-hint="star" fill="currentColor" fillOpacity={0.35} />
      ) : (
        <rect x="3" y="4" width="6" height="6" rx="1" />
      )}
      {count !== undefined ? <Count x={6} y={17.3} value={count} size={9} /> : <path d="m3 17 2 2 4-4" />}
    </Svg>
  );
}

/**
 * Lucide's basket, a little taller (rim at 9 instead of 11), so a number fits inside with room
 * above and below; drawn this way with and without the number, so it doesn't jump.
 */
export function ShoppingIcon({ count, ...props }: IconProps & { count?: number }) {
  return (
    <Svg {...props}>
      <path d="M2 9h20" />
      <path d="m3.5 9 1.8 9.4a2 2 0 0 0 2 1.6h9.4a2 2 0 0 0 2-1.6l1.8-9.4" />
      <path d="m19 9-4-5.5" />
      <path d="m5 9 4-5.5" />
      {count !== undefined ? (
        // The number takes the place of the weave. Its ink sits ~0.7 above y, so this puts it a
        // touch above the middle of the basket (9–20) – optically centred, as the basket narrows.
        <Count x={12} y={14.85} value={count} size={9} />
      ) : (
        <>
          <path d="m15 9-1 11" />
          <path d="M4.6 14.5h14.8" />
          <path d="m9 9 1 11" />
        </>
      )}
    </Svg>
  );
}

export function SettingsIcon({ due, ...props }: IconProps & { due?: boolean }) {
  return (
    <Svg {...props}>
      <path d="M14 17H5" />
      <path d="M19 7h-9" />
      <g
        data-hint={due ? "due" : undefined}
        className={cn(due && "fill-amber-400 text-amber-500 dark:fill-amber-300 dark:text-amber-300")}
      >
        <circle cx="17" cy="17" r="3" />
        <circle cx="7" cy="7" r="3" />
      </g>
    </Svg>
  );
}
