"use client";

import { useQuery } from "@tanstack/react-query";
import { byPosition } from "@/lib/ordering";
import { createClient } from "@/lib/supabase/client";
import { newId, nowIso, queryKeys, type Todo, useOptimisticMutation } from "./core";

export function useTodos() {
  return useQuery({
    queryKey: queryKeys.todos,
    queryFn: async () => {
      const { data, error } = await createClient().from("todos").select("*").order("position", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

/** Open todos in the user's own order (drag and drop). */
export function sortOpenTodos(todos: Todo[]): Todo[] {
  return todos.filter((t) => !t.done).sort(byPosition);
}

/** First line of a backlog item – used as its headline and for planner blocks. */
export function todoHeadline(text: string, max = 120): string {
  const line = text.trim().split("\n")[0].trim();
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

export function sortDoneTodos(todos: Todo[]): Todo[] {
  return todos.filter((t) => t.done).sort((a, b) => (b.done_at ?? "").localeCompare(a.done_at ?? ""));
}

export type TodoInput = Pick<Todo, "title" | "position"> &
  Partial<Pick<Todo, "starred" | "due_date">> & { id?: string };

export function prepareTodo(input: TodoInput) {
  return {
    id: input.id ?? newId(),
    title: input.title.trim(),
    starred: input.starred ?? false,
    due_date: input.due_date ?? null,
    position: input.position,
  };
}

export function useAddTodo() {
  return useOptimisticMutation<ReturnType<typeof prepareTodo>>({
    table: "todos",
    queryKey: queryKeys.todos,
    errorTitle: "Couldn't add the todo",
    mutationFn: async (todo) => {
      const { error } = await createClient().from("todos").insert(todo);
      if (error) throw error;
    },
    update: (data, todo) => {
      const now = nowIso();
      return [
        ...(data as Todo[]),
        {
          ...todo,
          notes: null,
          done: false,
          done_at: null,
          created_at: now,
          updated_at: now,
          user_id: "",
        } satisfies Todo,
      ].sort(byPosition);
    },
  });
}

export type TodoPatch = Partial<Pick<Todo, "title" | "starred" | "due_date" | "done" | "position">>;

export function useUpdateTodo() {
  return useOptimisticMutation<{ id: string; patch: TodoPatch }>({
    table: "todos",
    queryKey: queryKeys.todos,
    errorTitle: "Couldn't update the todo",
    mutationFn: async ({ id, patch }) => {
      const { error } = await createClient().from("todos").update(patch).eq("id", id);
      if (error) throw error;
    },
    update: (data, { id, patch }) =>
      (data as Todo[])
        .map((t) =>
          t.id === id
            ? { ...t, ...patch, done_at: patch.done === undefined ? t.done_at : patch.done ? nowIso() : null }
            : t,
        )
        .sort(byPosition),
  });
}

export function useDeleteTodos() {
  return useOptimisticMutation<{ ids: string[] }>({
    table: "todos",
    queryKey: queryKeys.todos,
    errorTitle: "Couldn't delete",
    alsoInvalidate: [queryKeys.blocks],
    mutationFn: async ({ ids }) => {
      if (ids.length === 0) return;
      const { error } = await createClient().from("todos").delete().in("id", ids);
      if (error) throw error;
    },
    update: (data, { ids }) => (data as Todo[]).filter((t) => !ids.includes(t.id)),
  });
}

export function useRestoreTodos() {
  return useOptimisticMutation<{ todos: Todo[] }>({
    table: "todos",
    queryKey: queryKeys.todos,
    errorTitle: "Couldn't restore",
    mutationFn: async ({ todos }) => {
      const rows = todos.map(({ id, title, starred, due_date, done, position, created_at }) => ({
        id,
        title,
        starred,
        due_date,
        done,
        position,
        created_at,
      }));
      const { error } = await createClient().from("todos").upsert(rows);
      if (error) throw error;
    },
    update: (data, { todos }) => {
      const existing = data as Todo[];
      const ids = new Set(existing.map((t) => t.id));
      return [...existing, ...todos.filter((t) => !ids.has(t.id))].sort(byPosition);
    },
  });
}
