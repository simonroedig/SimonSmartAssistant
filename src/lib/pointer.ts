/**
 * The wall display's touch screen may reach Chromium as a mouse (the Wayland
 * compositor emulates one). In wall display mode every pointer is therefore
 * treated like a finger: press and hold to drag, swipe to scroll and page.
 */
export function isKioskDocument(): boolean {
  return typeof document !== "undefined" && document.documentElement.classList.contains("kiosk");
}

export function isFingerLike(pointerType: string): boolean {
  return pointerType !== "mouse" || isKioskDocument();
}

/** Set while an element is being dragged, so drag-to-scroll stays out of the way. */
let dragging = false;

export function setDragging(active: boolean) {
  dragging = active;
}

export function isDragging(): boolean {
  return dragging;
}
