"use client";

import { Check, ChevronRight, Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { DragHandle, SortableList } from "@/components/ui/sortable";
import { newId, type NoteCategory } from "@/data/core";
import { categoryColor, useDeleteCategory, useMoveCategory, useSaveCategory } from "@/data/note-categories";
import { useLongPress } from "@/hooks/use-long-press";
import { positionForMove } from "@/lib/ordering";
import { PALETTE, PALETTE_COLORS, type PaletteColor } from "@/lib/palette";
import { FIELD_FOCUS, TONE_STYLES } from "@/lib/tones";
import { cn } from "@/lib/utils";

/** What the notes page shows: everything (but the vault), the vault, or one category. */
export type NoteFilter = "all" | "vault" | { category: string };

export const VAULT_TONE = TONE_STYLES.slate;

const CHIP =
  "flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium whitespace-nowrap transition-colors select-none [-webkit-touch-callout:none]";
const CHIP_IDLE = "text-muted well hover:text-fg";
// Picked: tinted, with a thin ring in its colour – clear even for a grey category on a light page.
const CHIP_ON = "font-semibold ring-[1.5px] ring-current/45 ring-inset";

/**
 * Keeps the picked chip of a sideways-scrolling row in view, a page margin
 * away from the screen's edge. When the row's start (or end) can show it, the
 * row goes all the way there – back to how the page opens on All, and at the
 * last chip with + and the pencil in sight, so it's clear there's no more.
 */
function useScrollToPressed(key: unknown) {
  const row = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = row.current;
    if (!el) return;
    const chips = [...el.querySelectorAll<HTMLElement>("[aria-pressed]")];
    const index = chips.findIndex((c) => c.getAttribute("aria-pressed") === "true");
    if (index < 0) return;
    const margin = parseFloat(getComputedStyle(el).paddingLeft) || 16;
    const rowBox = el.getBoundingClientRect();
    const box = chips[index].getBoundingClientRect();
    const left = box.left - rowBox.left + el.scrollLeft;
    const right = left + box.width;
    const end = el.scrollWidth - el.clientWidth;
    let target: number;
    if (index === 0 || right + margin <= el.clientWidth) target = 0;
    else if (index === chips.length - 1 || left - margin >= end) target = end;
    else if (left - margin < el.scrollLeft) target = left - margin;
    else if (right + margin > el.scrollLeft + el.clientWidth) target = right + margin - el.clientWidth;
    else return;
    el.scrollTo({ left: Math.max(0, Math.min(end, target)), behavior: "smooth" });
  }, [key]);
  return row;
}

/** A note's category, small and in its colour. */
export function CategoryTag({ category, className }: { category: NoteCategory; className?: string }) {
  const style = PALETTE[categoryColor(category)];
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.72rem] font-medium",
        style.bg,
        style.ink,
        className,
      )}
    >
      <span className="size-1.5 shrink-0 rounded-full bg-current" />
      <span className="truncate">{category.name}</span>
    </span>
  );
}

function CategoryChip({
  category,
  active,
  onSelect,
  onEdit,
}: {
  category: NoteCategory;
  active: boolean;
  onSelect: () => void;
  onEdit: () => void;
}) {
  // Press and hold (or right-click): rename, recolour, delete.
  const longPress = useLongPress(onEdit, 500);
  const style = PALETTE[categoryColor(category)];
  return (
    <button
      type="button"
      aria-pressed={active}
      title="Hold to edit"
      {...longPress.props}
      onClick={() => {
        if (!longPress.wasLongPress()) onSelect();
      }}
      className={cn(CHIP, active ? cn(style.bg, style.ink, CHIP_ON) : CHIP_IDLE)}
    >
      <span className={cn("size-2 rounded-full bg-current", style.ink)} />
      {category.name}
    </button>
  );
}

/**
 * The filters above the notes: the vault, All, the categories, + for a new one and
 * the pencil for all categories (order, edit).
 */
export function NoteFilters({
  filter,
  categories,
  vaultOpen,
  onChange,
  onVault,
  onAdd,
  onEdit,
  onManage,
  className,
}: {
  filter: NoteFilter;
  categories: NoteCategory[];
  vaultOpen: boolean;
  onChange: (filter: NoteFilter) => void;
  /** The vault was tapped (it may need the PIN first). */
  onVault: () => void;
  onAdd: () => void;
  onEdit: (category: NoteCategory) => void;
  /** The pencil: all categories, to put in order and edit. */
  onManage: () => void;
  className?: string;
}) {
  const selected = typeof filter === "object" ? categories.find((c) => c.id === filter.category) : undefined;
  const row = useScrollToPressed(typeof filter === "object" ? filter.category : filter);
  return (
    <div
      ref={row}
      role="group"
      aria-label="Filter notes"
      // Sideways it scrolls the chips, not the section.
      data-swipe
      className={cn(
        "-mx-4 flex [scrollbar-width:none] items-center gap-2 overflow-x-auto overscroll-x-contain px-4 py-1",
        className,
      )}
    >
      <button
        type="button"
        aria-pressed={filter === "vault"}
        aria-label={vaultOpen ? "Vault (open)" : "Vault"}
        onClick={onVault}
        // Open, the vault stands out in solid grey.
        className={cn(CHIP, filter === "vault" ? VAULT_TONE.solid : CHIP_IDLE)}
      >
        <Lock className="size-3.5" strokeWidth={2.4} />
        Vault
      </button>
      <button
        type="button"
        aria-pressed={filter === "all"}
        onClick={() => onChange("all")}
        className={cn(
          CHIP,
          // Neutral, so it never looks like one of the categories.
          filter === "all" ? cn("bg-fg/8 text-fg", CHIP_ON) : CHIP_IDLE,
        )}
      >
        All
      </button>
      {categories.map((category) => (
        <CategoryChip
          key={category.id}
          category={category}
          active={selected?.id === category.id}
          onSelect={() => onChange(selected?.id === category.id ? "all" : { category: category.id })}
          onEdit={() => onEdit(category)}
        />
      ))}
      <button
        type="button"
        aria-label="New category"
        onClick={onAdd}
        className={cn(CHIP, CHIP_IDLE, "w-9 justify-center px-0")}
      >
        <Plus className="size-4" />
      </button>
      {categories.length > 0 && (
        <button
          type="button"
          aria-label="Edit categories"
          onClick={onManage}
          className={cn(CHIP, "w-9 justify-center px-0 text-faint hover:text-fg")}
        >
          <Pencil className="size-3.5" />
        </button>
      )}
    </div>
  );
}

/** In the note editor: which category the note belongs to (or the vault). Tap again for none. */
export function CategoryPicker({
  categoryId,
  vault,
  categories,
  vaultAvailable,
  onChange,
}: {
  categoryId: string | null;
  vault: boolean;
  categories: NoteCategory[];
  /** The vault can be picked (a PIN is set). */
  vaultAvailable: boolean;
  onChange: (value: { categoryId: string | null; vault: boolean }) => void;
}) {
  const row = useScrollToPressed(vault ? "vault" : categoryId);
  if (categories.length === 0 && !vaultAvailable && !vault) return null;
  const small = "h-8 px-3 text-[0.8rem]";
  return (
    <div
      ref={row}
      role="group"
      aria-label="Category"
      data-swipe
      className="-mx-1 flex [scrollbar-width:none] gap-1.5 overflow-x-auto px-1 py-0.5"
    >
      {(vaultAvailable || vault) && (
        <button
          type="button"
          aria-pressed={vault}
          onClick={() => onChange({ categoryId: null, vault: !vault })}
          className={cn(CHIP, small, vault ? VAULT_TONE.solid : CHIP_IDLE)}
        >
          <Lock className="size-3" strokeWidth={2.4} />
          Vault
        </button>
      )}
      {categories.map((category) => {
        const style = PALETTE[categoryColor(category)];
        const active = !vault && categoryId === category.id;
        return (
          <button
            key={category.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange({ categoryId: active ? null : category.id, vault: false })}
            className={cn(CHIP, small, active ? cn(style.bg, style.ink, CHIP_ON) : CHIP_IDLE)}
          >
            <span className={cn("size-1.5 rounded-full bg-current", style.ink)} />
            {category.name}
          </button>
        );
      })}
    </div>
  );
}

/**
 * All categories, in the order of the chips: drag by the grip to reorder, tap one to
 * rename, recolour or delete it. (Vault and All always come first.)
 */
export function CategoriesSheet({
  open,
  categories,
  onClose,
  onEdit,
  onAdd,
}: {
  open: boolean;
  categories: NoteCategory[];
  onClose: () => void;
  onEdit: (category: NoteCategory) => void;
  onAdd: () => void;
}) {
  const move = useMoveCategory();
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title="Categories">
      <p className="-mt-2 mb-3 text-sm text-muted">Drag to change the order, tap one to edit it.</p>
      <SortableList
        items={categories}
        className="flex flex-col gap-1.5"
        onMove={(id, index) => move.mutate({ id, position: positionForMove(categories, id, index) })}
      >
        {(category) => {
          const style = PALETTE[categoryColor(category)];
          return (
            <div className="flex items-center gap-1 rounded-2xl pr-1 well">
              <DragHandle label={`Move ${category.name}`} className="w-10" />
              <button
                type="button"
                onClick={() => onEdit(category)}
                className="flex min-h-12 min-w-0 flex-1 items-center gap-2.5 text-left font-medium"
              >
                <span className={cn("size-2.5 shrink-0 rounded-full bg-current", style.ink)} />
                <span className="truncate">{category.name}</span>
                <ChevronRight className="ml-auto size-4 shrink-0 text-faint" />
              </button>
            </div>
          );
        }}
      </SortableList>
      <Button variant="secondary" onClick={onAdd} className="mt-3 w-full">
        <Plus /> New category
      </Button>
    </Sheet>
  );
}

export type CategorySheetState = { mode: "create" } | { mode: "edit"; category: NoteCategory } | null;

/** New category, or rename / recolour / delete one. */
export function CategorySheet({
  state,
  onClose,
  onCreated,
  onDeleted,
}: {
  state: CategorySheetState;
  onClose: () => void;
  onCreated?: (id: string) => void;
  onDeleted?: (id: string) => void;
}) {
  // A fresh form per opening, kept while it animates out.
  const [shown, setShown] = useState({ state, count: 0 });
  if (state && state !== shown.state) setShown({ state, count: shown.count + 1 });
  return (
    <CategoryForm
      key={shown.count}
      state={shown.state}
      open={state !== null}
      onClose={onClose}
      onCreated={onCreated}
      onDeleted={onDeleted}
    />
  );
}

function CategoryForm({
  state,
  open,
  onClose,
  onCreated,
  onDeleted,
}: {
  state: CategorySheetState;
  open: boolean;
  onClose: () => void;
  onCreated?: (id: string) => void;
  onDeleted?: (id: string) => void;
}) {
  const editing = state?.mode === "edit" ? state.category : null;
  const [name, setName] = useState(editing?.name ?? "");
  const [color, setColor] = useState<PaletteColor>(editing ? categoryColor(editing) : "sky");
  const save = useSaveCategory();
  const remove = useDeleteCategory();
  const nameRef = useRef<HTMLInputElement>(null);

  // A new one starts typing (once the sheet is in); editing doesn't pop the keyboard up.
  useEffect(() => {
    if (!open || editing) return;
    const id = window.setTimeout(() => nameRef.current?.focus(), 150);
    return () => window.clearTimeout(id);
  }, [open, editing]);

  const submit = () => {
    if (!name.trim()) return;
    const id = editing?.id ?? newId();
    save.mutate({ id, name, color, isNew: !editing });
    if (!editing) onCreated?.(id);
    onClose();
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={editing ? "Edit category" : "New category"}
      size="sm"
      className={FIELD_FOCUS.orange}
      footer={
        <>
          {editing && (
            <Button
              variant="danger"
              size="icon"
              aria-label="Delete category"
              title="Delete – its notes stay, without a category"
              onClick={() => {
                remove.mutate({ id: editing.id });
                onDeleted?.(editing.id);
                onClose();
              }}
            >
              <Trash2 />
            </Button>
          )}
          <Button
            variant="primary"
            className={cn("ui-action ml-auto shadow-none", TONE_STYLES.orange.solid)}
            disabled={!name.trim()}
            onClick={submit}
          >
            {editing ? "Save" : "Add category"}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          ref={nameRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name, e.g. Work"
          aria-label="Category name"
          maxLength={30}
          className="field h-11 w-full rounded-2xl px-4 text-[0.95rem] outline-none well placeholder:text-faint focus:border-(--field-focus)"
        />
        <div role="radiogroup" aria-label="Colour" className="flex flex-wrap gap-2.5">
          {PALETTE_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={color === c}
              aria-label={PALETTE[c].label}
              title={PALETTE[c].label}
              onClick={() => setColor(c)}
              className={cn(
                "grid size-9 place-items-center rounded-full transition-transform active:scale-95",
                PALETTE[c].swatch,
                PALETTE[c].onSwatch,
                color === c && "ring-2 ring-fg/70 ring-offset-2 ring-offset-(--surface-strong)",
              )}
            >
              {color === c && <Check className="size-4" strokeWidth={3} />}
            </button>
          ))}
        </div>
      </form>
    </Sheet>
  );
}
