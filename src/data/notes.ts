"use client";

import type { QueryKey } from "@tanstack/react-query";
import { byPosition } from "@/lib/ordering";
import { createClient } from "@/lib/supabase/client";
import { useVaultOpen } from "@/lib/vault";
import { newId, type Note, nowIso, queryKeys, useAppQuery, useOptimisticMutation } from "./core";

/** Pinned notes first, then the user's own order. */
export function sortNotes(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => (a.pinned === b.pinned ? byPosition(a, b) : a.pinned ? -1 : 1));
}

/**
 * The board's notes and the vault's are two lists (two queries): the vault's is
 * only fetched while it's open and never stored on the device. Mutations update
 * whichever lists they find under `["notes"]`; this tells them which one it is.
 */
function isVaultList(key: QueryKey): boolean {
  return key[1] === "vault";
}

async function fetchNotes(vault: boolean): Promise<Note[]> {
  const { data, error } = await createClient()
    .from("notes")
    .select("*")
    .eq("vault", vault)
    .order("position", { ascending: true });
  if (error) throw error;
  return sortNotes(data);
}

const onBoard = (notes: Note[]) => notes.filter((n) => !n.deleted_at);
const inTrash = (notes: Note[]) =>
  notes.filter((n) => n.deleted_at).sort((a, b) => (b.deleted_at ?? "").localeCompare(a.deleted_at ?? ""));

/** The notes on the board (everything that is not in the trash or the vault). */
export function useNotes() {
  return useAppQuery({ queryKey: queryKeys.notes, queryFn: () => fetchNotes(false), select: onBoard });
}

/** The vault's notes – only while it's open. */
export function useVaultNotes() {
  const open = useVaultOpen();
  return useAppQuery({
    queryKey: queryKeys.vaultNotes,
    queryFn: () => fetchNotes(true),
    select: onBoard,
    enabled: open,
    meta: { persist: false },
    gcTime: 0,
  });
}

/** Notes in the trash, most recently deleted first (the vault's too, while it's open). */
export function useTrashedNotes() {
  const open = useVaultOpen();
  const board = useAppQuery({ queryKey: queryKeys.notes, queryFn: () => fetchNotes(false), select: inTrash });
  const vault = useAppQuery({
    queryKey: queryKeys.vaultNotes,
    queryFn: () => fetchNotes(true),
    select: inTrash,
    enabled: open,
    meta: { persist: false },
    gcTime: 0,
  });
  const data = open && vault.data ? inTrash([...(board.data ?? []), ...vault.data]) : board.data;
  return { ...board, data };
}

export type NoteDraft = { title: string; body: string };

export function prepareNote(
  draft: NoteDraft & {
    position: number;
    pinned?: boolean;
    id?: string;
    categoryId?: string | null;
    vault?: boolean;
  },
) {
  return {
    id: draft.id ?? newId(),
    title: draft.title.trim() || null,
    body: draft.body.replace(/\s+$/, ""),
    pinned: draft.pinned ?? false,
    position: draft.position,
    category_id: draft.vault ? null : (draft.categoryId ?? null),
    vault: draft.vault ?? false,
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
    update: (data, note, key) => {
      if (note.vault !== isVaultList(key)) return data;
      const now = nowIso();
      return sortNotes([
        ...(data as Note[]),
        { ...note, created_at: now, updated_at: now, deleted_at: null, user_id: "" },
      ]);
    },
  });
}

export type NotePatch = Partial<Pick<Note, "title" | "body" | "pinned" | "position" | "category_id" | "vault">>;

export function useUpdateNote() {
  return useOptimisticMutation<{ id: string; patch: NotePatch }>({
    table: "notes",
    queryKey: queryKeys.notes,
    errorTitle: "Couldn't update the note",
    mutationFn: async ({ id, patch }) => {
      const { error } = await createClient().from("notes").update(patch).eq("id", id);
      if (error) throw error;
    },
    update: (data, { id, patch }, key) =>
      sortNotes(
        (data as Note[])
          // Into or out of the vault: it leaves this list (the other one fetches it).
          .filter((n) => n.id !== id || patch.vault === undefined || patch.vault === isVaultList(key))
          .map((n) => (n.id === id ? { ...n, ...patch, updated_at: nowIso() } : n)),
      ),
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
      const rows = notes.map(({ id, title, body, pinned, position, created_at, deleted_at, category_id, vault }) => ({
        id,
        title,
        body,
        pinned,
        position,
        created_at,
        deleted_at,
        category_id: category_id ?? null,
        vault: vault ?? false,
      }));
      const { error } = await createClient().from("notes").upsert(rows);
      if (error) throw error;
    },
    update: (data, { notes }, key) => {
      const existing = data as Note[];
      const ids = new Set(existing.map((n) => n.id));
      const mine = notes.filter((n) => !ids.has(n.id) && (n.vault ?? false) === isVaultList(key));
      return sortNotes([...existing, ...mine]);
    },
  });
}
