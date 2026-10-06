"use client";

import { X } from "lucide-react";
import { AnimatePresence, motion, type PanInfo, useDragControls } from "motion/react";
import { Dialog } from "radix-ui";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

/**
 * Responsive modal: a bottom sheet (swipe down to close) on phones and a
 * centered dialog on larger screens. Stays above on-screen keyboards.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
  size = "md",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const isPhone = useMediaQuery("(max-width: 767px)");
  const dragControls = useDragControls();

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 110 || info.velocity.y > 600) onOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
              />
            </Dialog.Overlay>
            <div
              className={cn(
                "pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center",
                isPhone ? "items-end" : "items-center p-6",
              )}
              style={{ bottom: "var(--sheet-bottom, 0px)" }}
            >
              <Dialog.Content
                asChild
                forceMount
                onOpenAutoFocus={(e) => {
                  // Don't pop up keyboards on touch devices just by opening a sheet.
                  if (isPhone) e.preventDefault();
                }}
              >
                <motion.div
                  className={cn(
                    "pointer-events-auto flex max-h-[min(88dvh,100%)] w-full flex-col overflow-hidden glass-strong outline-none",
                    isPhone
                      ? "rounded-t-[1.75rem] border-b-0 pb-[env(safe-area-inset-bottom)]"
                      : cn(
                          "rounded-[1.75rem]",
                          size === "sm" && "max-w-md",
                          size === "md" && "max-w-lg",
                          size === "lg" && "max-w-2xl",
                        ),
                    className,
                  )}
                  initial={isPhone ? { y: "100%" } : { opacity: 0, scale: 0.96, y: 12 }}
                  animate={isPhone ? { y: 0 } : { opacity: 1, scale: 1, y: 0 }}
                  exit={isPhone ? { y: "100%" } : { opacity: 0, scale: 0.97, y: 8 }}
                  transition={{ type: "spring", stiffness: 420, damping: 38, mass: 0.9 }}
                  drag={isPhone ? "y" : false}
                  dragConstraints={{ top: 0, bottom: 0 }}
                  dragElastic={{ top: 0, bottom: 0.6 }}
                  dragControls={dragControls}
                  dragListener={false}
                  onDragEnd={onDragEnd}
                >
                  {isPhone && (
                    <div
                      className="flex shrink-0 cursor-grab touch-none justify-center pt-3 pb-1 active:cursor-grabbing"
                      onPointerDown={(e) => dragControls.start(e)}
                    >
                      <span className="h-1.5 w-10 rounded-full bg-line-strong" />
                    </div>
                  )}
                  <div className="flex shrink-0 items-start gap-3 px-6 pt-4 pb-2 md:pt-6">
                    <div className="min-w-0 flex-1">
                      <Dialog.Title className="text-lg font-semibold tracking-tight">{title}</Dialog.Title>
                      {description ? (
                        <Dialog.Description className="mt-1 text-sm text-muted">{description}</Dialog.Description>
                      ) : (
                        <Dialog.Description className="sr-only">{title}</Dialog.Description>
                      )}
                    </div>
                    <Dialog.Close
                      className="-mt-1 -mr-2 grid size-10 place-items-center rounded-xl text-muted transition-colors hover:bg-surface-hover hover:text-fg"
                      aria-label="Close"
                    >
                      <X className="size-5" />
                    </Dialog.Close>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pt-2 pb-6">{children}</div>
                  {footer && (
                    <div className="flex shrink-0 items-center gap-2 border-t border-line px-6 py-4">{footer}</div>
                  )}
                </motion.div>
              </Dialog.Content>
            </div>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
