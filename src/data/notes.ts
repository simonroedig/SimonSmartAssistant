"use client";

import { byPosition } from "@/lib/ordering";
import { createClient } from "@/lib/supabase/client";
import { newId, type Note, nowIso, queryKeys, useOptimisticMutation, useAppQuery } from "./core";

/** Pinned notes first, then the user's own order. */
export function sortNotes(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => (a.pinned === b.pinned ? byPosition(a, b) : a.pinned ? -1 : 1));
}

async function fetchNotes(): Promise<Note[]> {
  const { data, error } = await createClient().from("notes").select("*").order("position", { ascending: true });
  if (error) throw error;
  return sortNotes(data);
}

/** The notes on the board (everything that is not in the trash). */
export function useNotes() {
  return useAppQuery({
    queryKey: queryKeys.notes,
    queryFn: fetchNotes,
    select: (notes: Note[]) => notes.filter((n) => !n.deleted_at),
  });
}

/** Notes in the trash, most recently deleted first. */
export function useTrashedNotes() {
  return useAppQuery({
    queryKey: queryKeys.notes,
    queryFn: fetchNotes,
    select: (notes: Note[]) =>
      notes.filter((n) => n.deleted_at).sort((a, b) => (b.deleted_at ?? "").localeCompare(a.deleted_at ?? "")),
  });
}

export type NoteDraft = { title: string; body: string };

export function prepareNote(draft: NoteDraft & { position: number; pinned?: boolean; id?: string }) {
  return {
    id: draft.id ?? newId(),
    title: draft.title.trim() || null,
    body: draft.body.replace(/\s+$/, ""),
    pinned: draft.pinned ?? false,
    position: draft.position,
  };
}

export function isNoteEmpty(draft: NoteDraft): boolean {
  return !draft.title.trim() && !draft.body.trim();
}

export function useAddNote() {
  return useOptimisticMutation<ReturnType<typeof prepareNote>>({
    table: "notes",
    queryKey: queryKeys.notes,
    errorTitle: "Couldn't save the note",
    mutationFn: async (note) => {
      const { error } = await createClient().from("notes").insert(note);
      if (error) throw error;
    },
    update: (data, note) => {
      const now = nowIso();
      return sortNotes([
        ...(data as Note[]),
        { ...note, created_at: now, updated_at: now, deleted_at: null, user_id: "" },
      ]);
    },
  });
}

export type NotePatch = Partial<Pick<Note, "title" | "body" | "pinned" | "position">>;

export function useUpdateNote() {
  return useOptimisticMutation<{ id: string; patch: NotePatch }>({
    table: "notes",
    queryKey: queryKeys.notes,
    errorTitle: "Couldn't update the note",
    mutationFn: async ({ id, patch }) => {
      const { error } = await createClient().from("notes").update(patch).eq("id", id);
      if (error) throw error;
    },
    update: (data, { id, patch }) =>
      sortNotes((data as Note[]).map((n) => (n.id === id ? { ...n, ...patch, updated_at: nowIso() } : n))),
  });
}

/** Moves notes to the trash (`trash: true`) or back onto the board (`trash: false`). */
export function useTrashNotes() {
  return useOptimisticMutation<{ ids: string[]; trash: boolean; position?: number }>({
    table: "notes",
    queryKey: queryKeys.notes,
    errorTitle: "Couldn't move the note",
    mutationFn: async ({ ids, trash, position }) => {
      if (ids.length === 0) return;
      const patch = trash
        ? { deleted_at: nowIso() }
        : { deleted_at: null, ...(position !== undefined ? { position } : {}) };
      const { error } = await createClient().from("notes").update(patch).in("id", ids);
      if (error) throw error;
    },
    update: (data, { ids, trash, position }) =>
      sortNotes(
        (data as Note[]).map((n) =>
          ids.includes(n.id)
            ? { ...n, deleted_at: trash ? nowIso() : null, ...(!trash && position !== undefined ? { position } : {}) }
            : n,
        ),
      ),
  });
}

/** Deletes notes for good (from the trash). */
export function useDeleteNotes() {
  return useOptimisticMutation<{ ids: string[] }>({
    table: "notes",
    queryKey: queryKeys.notes,
    errorTitle: "Couldn't delete the note",
    mutationFn: async ({ ids }) => {
      if (ids.length === 0) return;
      const { error } = await createClient().from("notes").delete().in("id", ids);
      if (error) throw error;
    },
    update: (data, { ids }) => (data as Note[]).filter((n) => !ids.includes(n.id)),
  });
}

export function useRestoreNotes() {
  return useOptimisticMutation<{ notes: Note[] }>({
    table: "notes",
    queryKey: queryKeys.notes,
    errorTitle: "Couldn't restore the note",
    mutationFn: async ({ notes }) => {
      const rows = notes.map(({ id, title, body, pinned, position, created_at, deleted_at }) => ({
        id,
        title,
        body,
        pinned,
        position,
        created_at,
        deleted_at,
      }));
      const { error } = await createClient().from("notes").upsert(rows);
      if (error) throw error;
    },
    update: (data, { notes }) => {
      const existing = data as Note[];
      const ids = new Set(existing.map((n) => n.id));
      return sortNotes([...existing, ...notes.filter((n) => !ids.has(n.id))]);
    },
  });
}
