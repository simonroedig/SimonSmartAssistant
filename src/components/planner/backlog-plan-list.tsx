"use client";

import { ArrowRight, CalendarCheck, Plus, Star } from "lucide-react";
import type { PlanBlock, Todo } from "@/data/core";
import { todoHeadline } from "@/data/todos";
import { type DayKey, dueLabel } from "@/lib/date";
import { plannedLabel } from "@/lib/plan-todo";
import { STAR_ON } from "@/lib/tones";
import { cn } from "@/lib/utils";

/**
 * Open backlog items to put into the plan. Items that are already planned show
 * where, and tapping them jumps there instead of planning them twice.
 */
export function BacklogPlanList({
  todos,
  planned,
  today,
  onPlan,
  className,
}: {
  todos: Todo[];
  planned: Map<string, PlanBlock>;
  today: DayKey | null;
  onPlan: (todo: Todo) => void;
  className?: string;
}) {
  if (todos.length === 0) {
    return <p className={cn("px-3 py-4 text-sm text-muted", className)}>Your backlog is empty.</p>;
  }
  return (
    <ul className={cn("flex flex-col", className)}>
      {todos.map((todo) => {
        const block = planned.get(todo.id);
        const headline = todoHeadline(todo.title);
        return (
          <li key={todo.id}>
            <button
              type="button"
              onClick={() => onPlan(todo)}
              aria-label={block ? `Show "${headline}" in the plan` : `Plan "${headline}"`}
              className="group flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-surface-hover"
            >
              {todo.starred && <Star className={cn("size-3.5 shrink-0", STAR_ON)} />}
              <span className="min-w-0 flex-1">
                <span className={cn("block truncate text-sm", todo.starred && "font-bold", block && "text-muted")}>
                  {headline}
                </span>
                {block && today ? (
                  <span className="mt-0.5 flex items-center gap-1 text-xs font-medium text-rose-600 dark:text-rose-300">
                    <CalendarCheck className="size-3.5" />
                    Planned · {plannedLabel(block, today)}
                  </span>
                ) : (
                  todo.due_date &&
                  today && (
                    <span className="mt-0.5 block text-xs text-muted">{dueLabel(todo.due_date, today).text}</span>
                  )
                )}
              </span>
              {block ? (
                <ArrowRight className="size-4 shrink-0 text-faint transition-colors group-hover:text-rose-500" />
              ) : (
                <Plus className="size-4 shrink-0 text-faint transition-colors group-hover:text-rose-500" />
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
