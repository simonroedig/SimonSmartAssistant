/**
 * List pages on phones: the "add" row is the card's footer, near the thumb,
 * while the list above it scrolls inside the card. Larger screens keep the
 * row above the list.
 */
export const PHONE_ADD_ROW =
  "max-md:order-last max-md:-mx-4 max-md:-mb-4 max-md:rounded-b-[1.75rem] max-md:border-t max-md:border-line max-md:bg-surface-strong max-md:p-3";

/** The list part of such a page: it scrolls by itself on phones. */
export const PHONE_SCROLL_AREA =
  "max-md:-mx-4 max-md:mt-0 max-md:min-h-0 max-md:flex-1 max-md:overflow-y-auto max-md:overscroll-contain max-md:px-4 max-md:py-1";
