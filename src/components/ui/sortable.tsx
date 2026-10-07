"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { createContext, useContext, useRef } from "react";
import { isKioskDocument, setDragging } from "@/lib/pointer";
import { cn, vibrate } from "@/lib/utils";

type HandleProps = Record<string, unknown>;

const HandleContext = createContext<{ props: HandleProps | undefined; setRef: (el: HTMLElement | null) => void }>({
  props: undefined,
  setRef: () => undefined,
});

/** Press-and-hold before dragging a whole card; a handle starts right away. */
const HOLD = { delay: 250, tolerance: 8 };

/**
 * Drag-and-drop ordering. `onMove(id, index)` is called with the item's new
 * index; persist it with `positionForMove`. Use `withHandle` for list rows
 * (drag only by the grip, so rows still scroll and swipe) or leave it off to
 * drag whole cards after a short press.
 */
export function SortableList<T extends { id: string }>({
  items,
  onMove,
  children,
  layout = "list",
  withHandle = true,
  className,
}: {
  items: T[];
  onMove: (id: string, index: number) => void;
  children: (item: T) => React.ReactNode;
  layout?: "list" | "grid";
  withHandle?: boolean;
  className?: string;
}) {
  const kiosk = isKioskDocument();
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: withHandle ? { distance: 4 } : kiosk ? HOLD : { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: withHandle ? { delay: 60, tolerance: 6 } : HOLD }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const lastDrag = useRef(0);

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDragging(false);
    lastDrag.current = Date.now();
    if (!over || active.id === over.id) return;
    const index = items.findIndex((i) => i.id === over.id);
    if (index >= 0) onMove(String(active.id), index);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={() => {
        setDragging(true);
        vibrate(10);
      }}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setDragging(false);
      }}
    >
      <SortableContext
        items={items.map((i) => i.id)}
        strategy={layout === "grid" ? rectSortingStrategy : verticalListSortingStrategy}
      >
        <ul
          className={className}
          onClickCapture={(e) => {
            // The release after a drag is not a tap.
            if (Date.now() - lastDrag.current < 250) {
              e.stopPropagation();
              e.preventDefault();
            }
          }}
        >
          {items.map((item) => (
            <SortableItem key={item.id} id={item.id} withHandle={withHandle}>
              {children(item)}
            </SortableItem>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableItem({ id, withHandle, children }: { id: string; withHandle: boolean; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("relative", isDragging && "z-20 opacity-90 drop-shadow-xl")}
      // Whole cards are dragged by press-and-hold; their own buttons stay the tap targets.
      {...(withHandle ? {} : listeners)}
    >
      <HandleContext.Provider
        value={{ props: withHandle ? { ...attributes, ...listeners } : undefined, setRef: setActivatorNodeRef }}
      >
        {children}
      </HandleContext.Provider>
    </li>
  );
}

/** The grip a row is dragged by (inside a `SortableList` with `withHandle`). */
export function DragHandle({ label, className }: { label: string; className?: string }) {
  const { props, setRef } = useContext(HandleContext);
  if (!props) return null;
  return (
    <button
      type="button"
      ref={setRef}
      aria-label={label}
      data-no-drag-scroll
      className={cn(
        "grid w-7 shrink-0 cursor-grab touch-none place-items-center self-stretch text-faint transition-colors hover:text-muted active:cursor-grabbing",
        className,
      )}
      {...props}
    >
      <GripVertical className="size-4" />
    </button>
  );
}
