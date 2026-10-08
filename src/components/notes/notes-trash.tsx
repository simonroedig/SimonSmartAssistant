"use client";

import { RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import type { Note } from "@/data/core";
import { useDeleteNotes, useNotes, useRestoreNotes, useTrashedNotes, useTrashNotes } from "@/data/notes";
import { formatDayMonthShort } from "@/lib/date";
import { positionAtStart } from "@/lib/ordering";
import { cn } from "@/lib/utils";
import { noteLabel } from "./notes-board";

/**
 * The trash of the notes: deleted notes wait here until they are restored or
 * deleted for good (one by one or all at once).
 */
export function NotesTrashButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const trashed = useTrashedNotes();
  const board = useNotes();
  const move = useTrashNotes();
  const remove = useDeleteNotes();
  const restoreDeleted = useRestoreNotes();
  const notes = trashed.data ?? [];

  const restore = (note: Note) => {
    const group = (board.data ?? []).filter((n) => n.pinned === note.pinned);
    move.mutate({ ids: [note.id], trash: false, position: positionAtStart(group) });
    toast(`Restored "${noteLabel(note)}"`);
  };

  const deleteForGood = (items: Note[], label: string) => {
    if (items.length === 0) return;
    remove.mutate({ ids: items.map((n) => n.id) });
    toast(label, {
      action: { label: "Undo", onClick: () => restoreDeleted.mutate({ notes: items }) },
      duration: 6000,
    });
  };

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        aria-label={`Trash (${notes.length})`}
        className={className}
        onClick={() => setOpen(true)}
      >
        <Trash2 />
        Trash
        {notes.length > 0 && (
          <span className="rounded-full bg-surface-hover px-1.5 text-xs font-semibold text-muted tabular">
            {notes.length}
          </span>
        )}
      </Button>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title="Trash"
        description="Deleted notes wait here until you restore them or delete them for good."
        footer={
          <Button
            variant="danger"
            className="ml-auto"
            disabled={notes.length === 0}
            onClick={() =>
              deleteForGood(notes, `Deleted ${notes.length} ${notes.length === 1 ? "note" : "notes"} for good`)
            }
          >
            <Trash2 /> Empty trash
          </Button>
        }
      >
        {notes.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center text-muted">
            <Trash2 className="size-8 text-faint" />
            <p className="text-sm">The trash is empty.</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {notes.map((note) => (
              <li
                key={note.id}
                className="flex items-start gap-2 rounded-2xl border border-line bg-surface-strong py-2 pr-2 pl-4"
              >
                <div className="min-w-0 flex-1 py-1">
                  {note.title && <p className="truncate text-[0.95rem] font-semibold">{note.title}</p>}
                  {note.body && (
                    <p
                      className={cn(
                        "line-clamp-3 text-sm break-words whitespace-pre-line",
                        note.title ? "text-muted" : "text-fg",
                      )}
                    >
                      {note.body}
                    </p>
                  )}
                  {note.deleted_at && (
                    <p className="mt-1 text-xs text-faint">Deleted {formatDayMonthShort(new Date(note.deleted_at))}</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Restore "${noteLabel(note)}"`}
                  onClick={() => restore(note)}
                >
                  <RotateCcw />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete "${noteLabel(note)}" for good`}
                  className="text-danger hover:bg-danger/10"
                  onClick={() => deleteForGood([note], `Deleted "${noteLabel(note)}" for good`)}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Sheet>
    </>
  );
}
