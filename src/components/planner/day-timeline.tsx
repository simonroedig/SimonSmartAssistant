"use client";

import { Check, ListTodo, MapPin, Moon } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PlanBlock } from "@/data/core";
import { useNow } from "@/hooks/use-now";
import { layoutBlocks } from "@/lib/planner-layout";
import { isFingerLike, setDragging } from "@/lib/pointer";
import type { Range } from "@/lib/sleep";
import { clamp, formatDuration, formatEndMinutes, formatMinutes, MINUTES_PER_DAY, minutesOfDay } from "@/lib/time";
import { cn, vibrate } from "@/lib/utils";
import { blockStyle } from "./block-colors";

const GUTTER = 56; // px for hour labels
const LABEL_HEIGHT = 26; // px a sleep label needs, incl. its padding
const LONG_PRESS_MS = 280;

type DragMode = "move" | "resize-start" | "resize-end" | "create";

/** The little bar on a block's edge: shown on hover, and while that edge is dragged. */
const handleBar = (bar: string, dragged: boolean) =>
  cn("h-1 w-8 rounded-full opacity-0 transition-opacity group-hover:opacity-60", bar, dragged && "opacity-80");

type DragState = {
  id: string;
  /** Moving a block, changing its start or end, or drawing a new one on empty space. */
  mode: DragMode;
  originStart: number;
  originEnd: number;
  pointerStartY: number; // content coordinates
  start: number;
  end: number;
};

export type DayTimelineProps = {
  blocks: PlanBlock[];
  sleepRanges: Range[];
  hourHeight: number;
  /** Visible minute range, default the whole day. */
  range?: Range;
  snap: number;
  isToday: boolean;
  /** A not-yet-saved block to preview (while the editor is open). */
  draft?: { start: number; end: number } | null;
  onCreateAt: (minute: number) => void;
  /** A new block drawn by dragging over empty space (default: like a tap at its start). */
  onCreateRange?: (start: number, end: number) => void;
  onOpen: (block: PlanBlock) => void;
  onChangeTime: (block: PlanBlock, start: number, end: number) => void;
  onToggleDone: (block: PlanBlock) => void;
  /** The minute to show at the top on mount / day change. */
  scrollTarget?: number;
  /** A minute (e.g. now) that must be in view after that scroll. */
  keepVisible?: number;
  scrollKey?: string;
  /**
   * A fixed overview (phone home screen): the whole range is visible without
   * scrolling, and blocks can only be opened – never moved or resized by accident.
   */
  overview?: boolean;
  className?: string;
};

/**
 * The day view: hour grid, greyed-out sleep, the "now" line and plan blocks.
 * Tap an empty slot to add a block; tap a block to edit it; press and hold
 * (or drag with a mouse) to move it; drag the bottom handle to change its end.
 */
export function DayTimeline({
  blocks,
  sleepRanges,
  hourHeight,
  range = [0, MINUTES_PER_DAY],
  snap,
  isToday,
  draft,
  onCreateAt,
  onCreateRange,
  onOpen,
  onChangeTime,
  onToggleDone,
  scrollTarget,
  keepVisible,
  scrollKey,
  overview = false,
  className,
}: DayTimelineProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const pending = useRef<{
    /** The block pressed, or null for empty space (drawing a new one). */
    block: PlanBlock | null;
    mode: DragMode;
    /** Empty space: the slot pressed. */
    minute?: number;
    pointerId: number;
    clientY: number;
    clientX: number;
    contentY: number;
    timer?: number;
    fingerLike: boolean;
  } | null>(null);
  // The click a browser sends after a drag is not a tap: swallowed until this moment
  // (an event timestamp). Infinity while dragging; a new press starts afresh.
  const suppressClickUntil = useRef(0);
  const autoScroll = useRef<{ raf: number; speed: number; lastClientY: number }>({ raf: 0, speed: 0, lastClientY: 0 });
  const clock = useNow("minute");
  const now = isToday && clock ? minutesOfDay(clock) : null;

  const [rangeStart, rangeEnd] = range;
  const pxPerMin = hourHeight / 60;
  const height = (rangeEnd - rangeStart) * pxPerMin;
  const y = useCallback((minute: number) => (minute - rangeStart) * pxPerMin, [rangeStart, pxPerMin]);

  // Scroll to the interesting part of the day when the day changes: the target
  // at the top edge, unless that would leave "now" out of sight.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || scrollTarget === undefined) return;
    let top = y(scrollTarget);
    if (keepVisible !== undefined && y(keepVisible) > top + el.clientHeight * 0.75) {
      top = y(keepVisible) - el.clientHeight * 0.4;
    }
    el.scrollTop = Math.max(0, top);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollKey]);

  const positioned = useMemo(() => layoutBlocks(blocks), [blocks]);

  // Pointer position in timeline coordinates (independent of scroll and padding).
  const contentY = (clientY: number) => clientY - content.current!.getBoundingClientRect().top;

  const updateDrag = (clientY: number) => {
    const state = dragRef.current;
    if (!state) return;
    const delta = (contentY(clientY) - state.pointerStartY) / pxPerMin;
    let start = state.originStart;
    let end = state.originEnd;
    if (state.mode === "create") {
      // From the slot pressed to the slot under the pointer – downwards or upwards.
      const minute = rangeStart + contentY(clientY) / pxPerMin;
      if (minute >= state.originStart) {
        end = clamp(Math.round(minute / snap) * snap, state.originStart + snap, MINUTES_PER_DAY);
      } else {
        start = clamp(Math.round(minute / snap) * snap, 0, state.originStart);
      }
    } else if (state.mode === "move") {
      const length = state.originEnd - state.originStart;
      start = clamp(Math.round((state.originStart + delta) / snap) * snap, 0, MINUTES_PER_DAY - length);
      end = start + length;
    } else if (state.mode === "resize-start") {
      start = clamp(Math.round((state.originStart + delta) / snap) * snap, 0, state.originEnd - snap);
    } else {
      end = clamp(Math.round((state.originEnd + delta) / snap) * snap, state.originStart + snap, MINUTES_PER_DAY);
    }
    if (start !== state.start || end !== state.end) {
      const next = { ...state, start, end };
      dragRef.current = next;
      setDrag(next);
      vibrate(4);
    }
  };

  const stopAutoScroll = () => {
    cancelAnimationFrame(autoScroll.current.raf);
    autoScroll.current.raf = 0;
    autoScroll.current.speed = 0;
  };

  const runAutoScroll = () => {
    const el = scroller.current;
    const state = autoScroll.current;
    if (!el || state.speed === 0 || !dragRef.current) {
      state.raf = 0;
      return;
    }
    el.scrollTop += state.speed;
    updateDrag(state.lastClientY);
    state.raf = requestAnimationFrame(runAutoScroll);
  };

  const handleAutoScroll = (clientY: number) => {
    const el = scroller.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const edge = 56;
    let speed = 0;
    if (clientY < rect.top + edge) speed = -Math.ceil((rect.top + edge - clientY) / 6);
    else if (clientY > rect.bottom - edge) speed = Math.ceil((clientY - (rect.bottom - edge)) / 6);
    autoScroll.current.speed = speed;
    autoScroll.current.lastClientY = clientY;
    if (speed !== 0 && !autoScroll.current.raf) autoScroll.current.raf = requestAnimationFrame(runAutoScroll);
  };

  const beginDrag = (p: NonNullable<typeof pending.current>) => {
    const origin = p.block ? [p.block.start_min, p.block.end_min] : [p.minute!, p.minute! + snap];
    const state: DragState = {
      id: p.block?.id ?? "new",
      mode: p.mode,
      originStart: origin[0],
      originEnd: origin[1],
      pointerStartY: p.contentY,
      start: origin[0],
      end: origin[1],
    };
    dragRef.current = state;
    setDragging(true);
    setDrag(state);
    suppressClickUntil.current = Infinity;
    vibrate(12);
  };

  // While a touch drag is active the page must not scroll.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const onTouchMove = (e: TouchEvent) => {
      if (dragRef.current) e.preventDefault();
    };
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => el.removeEventListener("touchmove", onTouchMove);
  }, []);

  /**
   * A block: a mouse drags right away; a finger holds briefly first (a quick swipe
   * over a block – or its edges – still scrolls the day).
   */
  const onBlockPointerDown = (e: React.PointerEvent, block: PlanBlock, mode: Exclude<DragMode, "create">) => {
    if (e.button !== 0 || overview) return;
    e.stopPropagation();
    suppressClickUntil.current = 0;
    const p = {
      block,
      mode,
      pointerId: e.pointerId,
      clientY: e.clientY,
      clientX: e.clientX,
      contentY: contentY(e.clientY),
      fingerLike: isFingerLike(e.pointerType),
    } as NonNullable<typeof pending.current>;
    pending.current = p;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    if (p.fingerLike) {
      p.timer = window.setTimeout(() => {
        if (pending.current === p) beginDrag(p);
      }, LONG_PRESS_MS);
    }
  };

  /**
   * Empty space: press and drag to draw a new block (a mouse right away, a finger
   * after a short hold – a quick swipe still scrolls). A tap stays a tap (onClick).
   */
  const onSurfacePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || overview) return;
    suppressClickUntil.current = 0;
    const at = contentY(e.clientY);
    const minute = clamp(Math.floor((rangeStart + at / pxPerMin) / snap) * snap, 0, MINUTES_PER_DAY - snap);
    const p = {
      block: null,
      mode: "create",
      minute,
      pointerId: e.pointerId,
      clientY: e.clientY,
      clientX: e.clientX,
      contentY: at,
      fingerLike: isFingerLike(e.pointerType),
    } as NonNullable<typeof pending.current>;
    pending.current = p;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    if (p.fingerLike) {
      p.timer = window.setTimeout(() => {
        if (pending.current === p) beginDrag(p);
      }, LONG_PRESS_MS);
    }
  };

  const onBlockPointerMove = (e: React.PointerEvent) => {
    const p = pending.current;
    if (!p || p.pointerId !== e.pointerId) return;
    if (dragRef.current) {
      updateDrag(e.clientY);
      handleAutoScroll(e.clientY);
      return;
    }
    const dist = Math.hypot(e.clientX - p.clientX, e.clientY - p.clientY);
    if (!p.fingerLike) {
      if (dist > 4) beginDrag(p);
    } else if (dist > 10) {
      // The finger moved before the long press: it's a scroll, not a drag.
      window.clearTimeout(p.timer);
      pending.current = null;
    }
  };

  const finish = (e: React.PointerEvent, cancelled: boolean) => {
    const p = pending.current;
    if (!p || p.pointerId !== e.pointerId) return;
    window.clearTimeout(p.timer);
    stopAutoScroll();
    const state = dragRef.current;
    pending.current = null;
    dragRef.current = null;
    setDragging(false);
    setDrag(null);
    // The click that may follow the drag is swallowed – however late a busy browser
    // sends it; a tap a moment later counts again.
    if (state) suppressClickUntil.current = e.timeStamp + 600;
    if (state && !cancelled && state.mode === "create") {
      if (onCreateRange) onCreateRange(state.start, state.end);
      else onCreateAt(state.start);
    } else if (p.block && state && !cancelled && (state.start !== state.originStart || state.end !== state.originEnd)) {
      onChangeTime(p.block, state.start, state.end);
    }
  };

  // The new block being drawn, or else the one in the open editor.
  const preview = drag?.mode === "create" ? { start: drag.start, end: drag.end } : draft;

  // What the timeline shows between two minutes: a block (where it's being dragged to, if
  // it is) or the block being created.
  const occupied = (from: number, to: number) =>
    blocks.some((b) => {
      const start = drag?.id === b.id ? drag.start : b.start_min;
      const end = drag?.id === b.id ? drag.end : b.end_min;
      return start < to && end > from;
    }) ||
    (preview != null && preview.start < to && preview.end > from);

  const hours = [];
  for (let h = Math.ceil(rangeStart / 60); h * 60 <= rangeEnd; h++) hours.push(h);
  // Squeezed hours only get a label every other hour.
  const labelEvery = hourHeight < 22 ? 2 : 1;

  return (
    <div
      ref={scroller}
      className={cn("relative min-h-0", !overview && "overflow-y-auto overscroll-contain", className)}
      style={overview ? undefined : { scrollbarGutter: "stable" }}
    >
      <div ref={content} className="relative mt-2.5" style={{ height: height + 16 }}>
        {/* Hour grid (past 24:00 when bedtime is after midnight) */}
        {hours.map((h) => (
          <div key={h} className="pointer-events-none absolute right-0 left-0" style={{ top: y(h * 60) }}>
            <span
              className="absolute -top-2 left-0 w-[46px] text-right text-[0.7rem] font-medium text-faint tabular"
              style={{ lineHeight: "1rem" }}
            >
              {h * 60 === rangeEnd || h % labelEvery !== 0 ? "" : `${String(h % 24).padStart(2, "0")}:00`}
            </span>
            <div className="absolute right-2 h-px bg-line" style={{ left: GUTTER }} />
          </div>
        ))}

        {/* Midnight, when the day continues into the night */}
        {rangeEnd > MINUTES_PER_DAY && rangeStart < MINUTES_PER_DAY && (
          <div
            className="pointer-events-none absolute right-2 z-[5] flex items-center"
            style={{ top: y(MINUTES_PER_DAY) - 9, left: GUTTER }}
          >
            <span className="rounded-full border border-line bg-surface-strong px-2 py-px text-[0.65rem] font-semibold tracking-wide text-muted uppercase">
              Midnight
            </span>
            <span className="h-px flex-1 border-t border-dashed border-line-strong" />
          </div>
        )}

        {/* Sleep */}
        {sleepRanges.map(([s, e]) => {
          const from = Math.max(s, rangeStart);
          const to = Math.min(e, rangeEnd);
          const top = y(from);
          const bottom = y(to);
          if (bottom - top <= 0) return null;
          // The label ("Bedtime 23:00", "Sleep until 07:00") sits at the top of the shade –
          // unless a block covers that spot; then at the bottom, and with both taken, not at all.
          const labelMin = LABEL_HEIGHT / pxPerMin;
          const labelAt =
            bottom - top <= 28
              ? null
              : !occupied(from, from + labelMin)
                ? "top"
                : !occupied(to - labelMin, to)
                  ? "bottom"
                  : null;
          return (
            <div
              key={`${s}-${e}`}
              className={cn(
                "pointer-events-none absolute right-2 flex rounded-xl sleep-shade px-3",
                labelAt === "bottom" ? "items-end pb-1.5" : "items-start pt-1.5",
              )}
              style={{ top, height: bottom - top, left: GUTTER }}
            >
              {labelAt && (
                <span className="flex items-center gap-1.5 text-xs font-medium text-faint">
                  <Moon className="size-3.5" />
                  {e <= MINUTES_PER_DAY && s < 12 * 60
                    ? `Sleep until ${formatMinutes(e)}`
                    : `Bedtime ${formatMinutes(s % MINUTES_PER_DAY)}`}
                </span>
              )}
            </div>
          );
        })}

        {/* Tap (or press and drag) target for new blocks */}
        <button
          type="button"
          aria-label="Add a block"
          tabIndex={-1}
          className="absolute top-0 right-0 cursor-cell select-none [-webkit-touch-callout:none]"
          // New blocks belong to this day: the part after midnight is for looking only.
          style={{ left: GUTTER, height: y(Math.min(rangeEnd, MINUTES_PER_DAY)) }}
          onPointerDown={onSurfacePointerDown}
          onPointerMove={onBlockPointerMove}
          onPointerUp={(e) => finish(e, false)}
          onPointerCancel={(e) => finish(e, true)}
          onContextMenu={(e) => e.preventDefault()}
          onClick={(e) => {
            if (e.timeStamp < suppressClickUntil.current) {
              suppressClickUntil.current = 0;
              return;
            }
            const minute = rangeStart + contentY(e.clientY) / pxPerMin;
            onCreateAt(clamp(Math.floor(minute / snap) * snap, 0, MINUTES_PER_DAY - snap));
          }}
        />

        {/* Draft preview: the block being drawn, or the one in the open editor */}
        {preview && (
          <div
            data-drawing={drag?.mode === "create" ? "" : undefined}
            className="pointer-events-none absolute right-2 flex items-start rounded-xl border-2 border-dashed border-accent/70 bg-accent-soft px-2.5 pt-1 text-[0.72rem] font-medium text-accent tabular"
            style={{
              top: y(preview.start) + 1,
              height: Math.max(18, (preview.end - preview.start) * pxPerMin - 2),
              left: GUTTER + 4,
            }}
          >
            {drag?.mode === "create" && `${formatMinutes(preview.start)} – ${formatEndMinutes(preview.end)}`}
          </div>
        )}

        {/* Blocks */}
        {positioned.map((block) => {
          const active = drag?.id === block.id ? drag : null;
          const start = active ? active.start : block.start_min;
          const end = active ? active.end : block.end_min;
          const top = y(start);
          const h = Math.max(overview ? 15 : 20, (end - start) * pxPerMin - (overview ? 2 : 3));
          const style = blockStyle(block.color);
          const tiny = h < 38;
          const small = overview && h < 22;
          const widthPct = 100 / block.columns;
          return (
            <div
              key={block.id}
              data-dragging={active ? "" : undefined}
              className={cn(
                "group absolute z-10 [touch-action:pan-y] select-none [-webkit-touch-callout:none]",
                active && "z-30",
              )}
              style={{
                top: top + (overview ? 1 : 1.5),
                height: h,
                left: `calc(${GUTTER + 4}px + (100% - ${GUTTER + 12}px) * ${(block.column * widthPct) / 100})`,
                width: `calc((100% - ${GUTTER + 12}px) * ${widthPct / 100} - 4px)`,
              }}
              onPointerDown={(e) => onBlockPointerDown(e, block, "move")}
              onPointerMove={onBlockPointerMove}
              onPointerUp={(e) => finish(e, false)}
              onPointerCancel={(e) => finish(e, true)}
              onContextMenu={(e) => e.preventDefault()}
              // Handled here, not on the inner button: while the pointer is captured
              // (for dragging) a mouse click lands on this element.
              onClick={(e) => {
                e.stopPropagation();
                if (e.timeStamp < suppressClickUntil.current) {
                  suppressClickUntil.current = 0;
                  return;
                }
                onOpen(block);
              }}
            >
              <div
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onOpen(block);
                  }
                }}
                className={cn(
                  "relative flex h-full cursor-pointer overflow-hidden rounded-xl transition-[box-shadow,transform] duration-150",
                  style.bg,
                  style.text,
                  active && "scale-[1.02] shadow-pop ring-2",
                  active && style.ring,
                  block.done && !active && "opacity-60",
                )}
              >
                <span className={cn("absolute inset-y-0 left-0 w-1", style.bar)} />
                <div
                  className={cn(
                    "flex min-w-0 flex-1 pr-1.5 pl-3",
                    tiny ? "items-center gap-2" : "flex-col justify-start pt-1.5",
                  )}
                >
                  <span
                    className={cn(
                      "truncate leading-tight font-semibold",
                      small ? "text-[0.74rem] leading-none" : "text-[0.88rem]",
                      block.done && "line-through decoration-2 opacity-80",
                    )}
                  >
                    {block.todo_id && (
                      <ListTodo
                        className="-mt-0.5 mr-1 inline size-3.5 opacity-80"
                        aria-label="From your backlog"
                        role="img"
                      />
                    )}
                    {block.title}
                  </span>
                  <span
                    className={cn(
                      "truncate text-[0.72rem] tabular opacity-70",
                      tiny && "shrink-0",
                      small && "text-[0.66rem] leading-none",
                    )}
                  >
                    {formatMinutes(start)}
                    {!tiny && ` – ${formatEndMinutes(end)}`}
                    {!tiny && h > 70 && ` · ${formatDuration(end - start)}`}
                  </span>
                  {!tiny && h > 70 && block.location && (
                    <span className="flex min-w-0 items-center gap-1 text-[0.72rem] opacity-70">
                      <MapPin className="size-3 shrink-0" />
                      <span className="truncate">{block.location}</span>
                    </span>
                  )}
                  {!tiny && h > 92 && block.notes && (
                    <span className="mt-1 line-clamp-2 text-[0.72rem] opacity-60">{block.notes}</span>
                  )}
                </div>
                {h >= 30 && (
                  <button
                    type="button"
                    aria-label={block.done ? "Mark as not done" : "Mark as done"}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      vibrate(8);
                      onToggleDone(block);
                    }}
                    className="m-1 grid size-8 shrink-0 place-items-center self-start rounded-full"
                  >
                    <span
                      className={cn(
                        "grid size-5 place-items-center rounded-full border-2 border-current transition-colors",
                        block.done ? cn(style.bar, "border-transparent text-white") : "opacity-40",
                      )}
                    >
                      {block.done && <Check className="size-3" strokeWidth={3.5} />}
                    </span>
                  </button>
                )}
              </div>
              {/* Resize handles: the end, and the start where the block is tall enough to keep
                  room for grabbing it in the middle (the top one leaves the done circle free). */}
              {!overview && h >= 40 && (
                <div
                  aria-hidden="true"
                  data-resize="start"
                  className="absolute -top-1 right-10 left-0 flex h-4 cursor-ns-resize items-center justify-center"
                  onPointerDown={(e) => onBlockPointerDown(e, block, "resize-start")}
                >
                  <span className={handleBar(style.bar, active?.mode === "resize-start")} />
                </div>
              )}
              {!overview && (
                <div
                  aria-hidden="true"
                  data-resize="end"
                  className="absolute right-0 -bottom-1 left-0 flex h-4 cursor-ns-resize items-center justify-center"
                  onPointerDown={(e) => onBlockPointerDown(e, block, "resize-end")}
                >
                  <span className={handleBar(style.bar, active?.mode === "resize-end")} />
                </div>
              )}
              {active && (
                <div className="pointer-events-none absolute -top-7 left-2 rounded-lg bg-fg px-2 py-0.5 text-xs font-semibold text-[var(--bg)] tabular shadow-lg">
                  {formatMinutes(active.start)} – {formatEndMinutes(active.end)}
                </div>
              )}
            </div>
          );
        })}

        {/* Now line */}
        {now !== null && now >= rangeStart && now <= rangeEnd && (
          <div className="pointer-events-none absolute right-0 left-0 z-20" style={{ top: y(now) }}>
            <span className="absolute -top-2.5 left-0 w-[50px] rounded-md bg-now py-0.5 text-center text-[0.68rem] font-bold text-white tabular">
              {formatMinutes(now)}
            </span>
            <div className="absolute right-2 h-0.5 rounded-full bg-now" style={{ left: GUTTER - 4 }} />
            <span className="absolute -top-[5px] size-3 rounded-full bg-now" style={{ left: GUTTER - 7 }} />
          </div>
        )}
      </div>
    </div>
  );
}
