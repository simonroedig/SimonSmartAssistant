"use client";

import { Trash2 } from "lucide-react";
import { animate, motion, useMotionValue, useTransform } from "motion/react";
import { cn } from "@/lib/utils";

const THRESHOLD = 96;

/** Row that can be swiped left to delete (touch), with a red reveal behind it. */
export function SwipeRow({
  children,
  onDelete,
  className,
}: {
  children: React.ReactNode;
  onDelete: () => void;
  className?: string;
}) {
  const x = useMotionValue(0);
  const revealOpacity = useTransform(x, [-THRESHOLD, -24, 0], [1, 0.4, 0]);
  const iconScale = useTransform(x, [-THRESHOLD, -40], [1.1, 0.7]);

  return (
    <div className={cn("relative overflow-hidden rounded-2xl", className)}>
      <motion.div
        aria-hidden="true"
        style={{ opacity: revealOpacity }}
        className="absolute inset-0 flex items-center justify-end rounded-2xl bg-danger/90 pr-5 text-white"
      >
        <motion.span style={{ scale: iconScale }}>
          <Trash2 className="size-5" />
        </motion.span>
      </motion.div>
      <motion.div
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: -THRESHOLD * 1.6, right: 0 }}
        dragElastic={{ left: 0.25, right: 0 }}
        dragSnapToOrigin={false}
        style={{ x }}
        onDragEnd={(_, info) => {
          if (info.offset.x < -THRESHOLD || info.velocity.x < -700) {
            animate(x, -600, { duration: 0.18 });
            onDelete();
          } else {
            animate(x, 0, { type: "spring", stiffness: 500, damping: 40 });
          }
        }}
        className="relative"
      >
        {children}
      </motion.div>
    </div>
  );
}
