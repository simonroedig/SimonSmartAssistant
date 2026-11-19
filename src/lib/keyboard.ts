/** A field that brings up a phone's on-screen keyboard. */
export function isTextField(el: Element | null): boolean {
  if (el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLInputElement) return !["checkbox", "radio", "button", "submit", "range"].includes(el.type);
  return el instanceof HTMLElement && el.isContentEditable;
}

/**
 * Keeps --screen-h on <html> at the screen's height without an on-screen keyboard: the
 * page gets shorter while one is up, the background shouldn't (it would shrink and move
 * up behind the page). A new width (turning the phone, a resized window) starts afresh.
 */
export function trackScreenHeight(root: HTMLElement): () => void {
  let width = window.innerWidth;
  let height = window.innerHeight;
  const set = () => root.style.setProperty("--screen-h", `${height}px`);
  const update = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    // Shorter at the same width while typing: that's the keyboard – keep the height.
    if (w === width && h < height && isTextField(document.activeElement)) return;
    width = w;
    height = h;
    set();
  };
  set();
  window.addEventListener("resize", update);
  return () => window.removeEventListener("resize", update);
}
