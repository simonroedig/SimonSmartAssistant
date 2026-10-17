/**
 * "Still" mode of the wall display: a while after the last touch nothing on the
 * page moves any more (weather icons, the sky's rain and snow), so the browser has
 * nothing to redraw – the Pi idles even when its screen is merely switched off.
 * The first touch brings everything back. Phones and laptops never need it: their
 * browsers stop drawing by themselves once the page is out of sight.
 */
let still = false;
const listeners = new Set<() => void>();

export function setStill(value: boolean) {
  if (value === still) return;
  still = value;
  if (value) document.documentElement.dataset.still = "";
  else delete document.documentElement.dataset.still;
  listeners.forEach((listener) => listener());
}

export function subscribeStill(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const getStill = () => still;
export const getServerStill = () => false;
