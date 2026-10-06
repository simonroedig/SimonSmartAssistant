"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { newId, nowIso, queryKeys, type Todo, useOptimisticMutation } from "./core";

export function useTodos() {
  return useQuery({
    queryKey: queryKeys.todos,
    queryFn: async () => {
      const { data, error } = await createClient().from("todos").select("*").order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

/** Open todos: starred first, then by due date, then oldest first. */
export function sortOpenTodos(todos: Todo[]): Todo[] {
  return todos
    .filter((t) => !t.done)
    .sort((a, b) => {
      if (a.starred !== b.starred) return a.starred ? -1 : 1;
      if (a.due_date !== b.due_date) {
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return a.due_date.localeCompare(b.due_date);
      }
      return a.created_at.localeCompare(b.created_at);
    });
}

export function sortDoneTodos(todos: Todo[]): Todo[] {
  return todos.filter((t) => t.done).sort((a, b) => (b.done_at ?? "").localeCompare(a.done_at ?? ""));
}

export type TodoInput = Pick<Todo, "title"> & Partial<Pick<Todo, "notes" | "starred" | "due_date">> & { id?: string };

export function prepareTodo(input: TodoInput) {
  return {
    id: input.id ?? newId(),
    title: input.title.trim(),
    notes: input.notes?.trim() || null,
    starred: input.starred ?? false,
    due_date: input.due_date ?? null,
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
        { ...todo, done: false, done_at: null, created_at: now, updated_at: now, user_id: "" } satisfies Todo,
      ];
    },
  });
}

export type TodoPatch = Partial<Pick<Todo, "title" | "notes" | "starred" | "due_date" | "done">>;

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
      (data as Todo[]).map((t) =>
        t.id === id
          ? { ...t, ...patch, done_at: patch.done === undefined ? t.done_at : patch.done ? nowIso() : null }
          : t,
      ),
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
      const rows = todos.map(({ id, title, notes, starred, due_date, done, created_at }) => ({
        id,
        title,
        notes,
        starred,
        due_date,
        done,
        created_at,
      }));
      const { error } = await createClient().from("todos").upsert(rows);
      if (error) throw error;
    },
    update: (data, { todos }) => {
      const existing = data as Todo[];
      const ids = new Set(existing.map((t) => t.id));
      return [...existing, ...todos.filter((t) => !ids.has(t.id))];
    },
  });
}
