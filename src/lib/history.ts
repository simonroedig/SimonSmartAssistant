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
