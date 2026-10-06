import { cn } from "@/lib/utils";

/** Colour stops for a temperature, from icy blue to hot red. */
function tempColor(t: number): string {
  if (t <= -5) return "#7dd3fc";
  if (t <= 5) return "#38bdf8";
  if (t <= 12) return "#2dd4bf";
  if (t <= 18) return "#a3e635";
  if (t <= 24) return "#facc15";
  if (t <= 30) return "#fb923c";
  return "#f43f5e";
}

/**
 * Range bar (like iOS weather): the day's min–max placed on the scale of the
 * whole week, coloured by temperature, with an optional "now" marker.
 */
export function TemperatureBar({
  min,
  max,
  weekMin,
  weekMax,
  current,
  className,
}: {
  min: number;
  max: number;
  weekMin: number;
  weekMax: number;
  current?: number;
  className?: string;
}) {
  const span = Math.max(1, weekMax - weekMin);
  const left = ((min - weekMin) / span) * 100;
  const width = Math.max(6, ((max - min) / span) * 100);
  const nowPos = current === undefined ? null : ((current - weekMin) / span) * 100;

  return (
    <div className={cn("relative h-1.5 rounded-full bg-surface-sunken", className)}>
      <div
        className="absolute inset-y-0 rounded-full"
        style={{
          left: `${left}%`,
          width: `${Math.min(width, 100 - left)}%`,
          background: `linear-gradient(90deg, ${tempColor(min)}, ${tempColor(max)})`,
        }}
      />
      {nowPos !== null && (
        <div
          className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--bg)] bg-fg"
          style={{ left: `${Math.min(100, Math.max(0, nowPos))}%` }}
        />
      )}
    </div>
  );
}
