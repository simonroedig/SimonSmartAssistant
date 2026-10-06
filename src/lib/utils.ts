import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function vibrate(pattern: number | number[] = 8) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // not supported
  }
}
