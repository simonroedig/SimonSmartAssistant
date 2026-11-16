/**
 * Runs `fn` once an open sheet has given up its history entry (sheets push one
 * so the back gesture closes them). Use it when closing a sheet leads straight
 * into a navigation or another sheet.
 */
export function afterSheetClosed(fn: () => void) {
  if (typeof window !== "undefined" && window.history.state?.sheet) {
    window.addEventListener("popstate", () => window.setTimeout(fn, 0), { once: true });
  } else {
    fn();
  }
}

/**
 * How many history entries the current page pushed on top of its own (a level deeper
 * in the notes, an open sheet): the back gesture undoes those first.
 */
export function inPageDepth(): number {
  if (typeof window === "undefined") return 0;
  const depth = window.history.state?.inPage;
  return typeof depth === "number" && depth > 0 ? depth : 0;
}

/** A history entry of the page's own, on top of the current one (counted by `inPageDepth`). */
export function pushInPage(data: Record<string, unknown>) {
  window.history.pushState({ ...data, inPage: inPageDepth() + 1 }, "");
}

/** Runs `fn` once the page's own entries are given back – before navigating elsewhere. */
export function leaveInPage(fn: () => void) {
  const depth = inPageDepth();
  if (depth === 0) {
    fn();
    return;
  }
  window.addEventListener("popstate", () => window.setTimeout(fn, 0), { once: true });
  window.history.go(-depth);
}

/** Back to the page below this one, past the page's own entries. */
export function backOutOfPage() {
  window.history.go(-(inPageDepth() + 1));
}
