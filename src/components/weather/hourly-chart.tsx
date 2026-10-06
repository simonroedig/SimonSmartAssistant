"use client";

import { useEffect, useId, useRef } from "react";
import type { HourlyPoint } from "@/lib/weather/open-meteo";
import { cn } from "@/lib/utils";
import { WeatherIcon } from "./weather-icon";

const COL = 52; // px per hour
const CHART_H = 110;
const PAD_TOP = 26;
const BAR_H = 34;

function smoothPath(points: [number, number][]): string {
  if (points.length < 2) return "";
  let d = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2[0]} ${p2[1]}`;
  }
  return d;
}

/**
 * Hour-by-hour chart: temperature curve with values, weather icons, and rain
 * probability bars. Scrolls horizontally and starts at `focusHour`.
 */
export function HourlyChart({
  hours,
  focusHour,
  nowTime,
  className,
}: {
  hours: HourlyPoint[];
  focusHour?: number;
  nowTime?: string;
  className?: string;
}) {
  const id = useId();
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!scroller.current || focusHour === undefined) return;
    scroller.current.scrollTo({ left: Math.max(0, (focusHour - 1) * COL), behavior: "smooth" });
  }, [focusHour, hours]);

  if (hours.length === 0) return null;

  const temps = hours.map((h) => h.temperature);
  const min = Math.min(...temps);
  const max = Math.max(...temps);
  const span = Math.max(1, max - min);
  const width = hours.length * COL;
  const y = (t: number) => PAD_TOP + (1 - (t - min) / span) * (CHART_H - PAD_TOP - 8);
  const points = hours.map((h, i) => [i * COL + COL / 2, y(h.temperature)] as [number, number]);
  const line = smoothPath(points);
  const area = `${line} L ${points.at(-1)![0]} ${CHART_H} L ${points[0][0]} ${CHART_H} Z`;

  return (
    <div ref={scroller} className={cn("no-scrollbar overflow-x-auto", className)}>
      <div style={{ width }} className="relative">
        <div className="flex">
          {hours.map((h) => {
            const isNow = nowTime !== undefined && h.time === nowTime;
            return (
              <div key={h.time} style={{ width: COL }} className="flex flex-col items-center gap-1 pb-1">
                <span className={cn("text-[0.7rem] font-medium tabular", isNow ? "text-accent" : "text-muted")}>
                  {isNow ? "Now" : `${String(h.hour).padStart(2, "0")}:00`}
                </span>
                <WeatherIcon code={h.code} isDay={h.isDay} className="size-9" />
              </div>
            );
          })}
        </div>
        <svg width={width} height={CHART_H} className="block overflow-visible" aria-hidden="true">
          <defs>
            <linearGradient id={`fill-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--accent)" stopOpacity="0.32" />
              <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#fill-${id})`} />
          <path d={line} fill="none" stroke="var(--accent)" strokeWidth={2.5} strokeLinecap="round" />
          {points.map(([px, py], i) => (
            <g key={hours[i].time}>
              <circle cx={px} cy={py} r={3} fill="var(--accent)" stroke="var(--bg)" strokeWidth={1.5} />
              <text
                x={px}
                y={py - 10}
                textAnchor="middle"
                className="fill-[var(--text)] text-[12px] font-semibold"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {Math.round(hours[i].temperature)}°
              </text>
            </g>
          ))}
        </svg>
        <div className="flex items-end" style={{ height: BAR_H + 16 }}>
          {hours.map((h) => (
            <div key={h.time} style={{ width: COL }} className="flex flex-col items-center justify-end gap-1">
              <div
                className="w-5 rounded-t-md bg-sky-400/70 dark:bg-sky-400/55"
                style={{ height: Math.max(2, (h.precipitationProbability / 100) * BAR_H) }}
              />
              <span className="text-[0.65rem] font-semibold text-sky-600 tabular dark:text-sky-300">
                {h.precipitationProbability}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
