/**
 * Order of the sections in the navigation, chosen in Settings: one for the
 * phone's tab bar, one for the side rail (PC, wall display). Home has a fixed
 * place – first in the rail; in the middle or on the left of the tab bar.
 *
 * Saved with the other preferences (synced to all devices) and mirrored into a
 * cookie, so the server already renders the bar in the right order.
 */

export type SectionId = "planner" | "shopping" | "backlog" | "notes" | "weather" | "media" | "mind";
export type PhoneHome = "middle" | "left";
/** Floating cards with a margin, or attached to the screen edges. */
export type NavStyle = "floating" | "attached";

export type NavigationPreferences = {
  /** The four sections of the tab bar, left to right (Home sits between or before them). */
  phone: SectionId[];
  phoneHome: PhoneHome;
  /** All sections of the rail, top to bottom, below Home. */
  rail: SectionId[];
  /** Phone tab bar: floating or attached – independent of the side rail's. */
  phoneStyle: NavStyle;
  /** Side rail of PC and wall display. */
  railStyle: NavStyle;
};

/** The second page of the phone's tab bar (swiped to). */
export const PHONE_MORE: ("media" | "mind" | "weather" | "settings")[] = ["media", "mind", "weather", "settings"];

export const RAIL_SECTIONS: SectionId[] = ["planner", "shopping", "backlog", "notes", "weather", "media", "mind"];
/** Sections added later, oldest first: a saved rail order without them gets them at its end. */
const LATER_SECTIONS: SectionId[] = ["media", "mind"];
/** The first page of the phone's tab bar (Media, Mind, Weather and Settings are on its second). */
export const PHONE_SECTIONS: SectionId[] = ["planner", "shopping", "backlog", "notes"];

export const DEFAULT_NAVIGATION: NavigationPreferences = {
  phone: ["shopping", "backlog", "planner", "notes"],
  phoneHome: "middle",
  rail: ["planner", "shopping", "backlog", "notes", "weather", "media", "mind"],
  phoneStyle: "floating",
  railStyle: "floating",
};

export const NAVIGATION_COOKIE = "ssa-nav";

/** `value` if it holds exactly the given sections (in any order), otherwise null. */
function orderOf(value: unknown, sections: SectionId[]): SectionId[] | null {
  if (!Array.isArray(value) || value.length !== sections.length) return null;
  const set = new Set(value);
  return set.size === sections.length && sections.every((s) => set.has(s)) ? (value as SectionId[]) : null;
}

export function parseNavigation(value: unknown): NavigationPreferences {
  const nav = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  return {
    phone: orderOf(nav.phone, PHONE_SECTIONS) ?? DEFAULT_NAVIGATION.phone,
    phoneHome: nav.phoneHome === "left" ? "left" : DEFAULT_NAVIGATION.phoneHome,
    rail: orderOf(nav.rail, RAIL_SECTIONS) ?? withNewSections(nav.rail) ?? DEFAULT_NAVIGATION.rail,
    // (Earlier one shared `style` for both.)
    phoneStyle: navStyle(nav.phoneStyle ?? nav.style),
    railStyle: navStyle(nav.railStyle ?? nav.style),
  };
}

/** A rail order saved before Media (or Mind) existed keeps its order, with the new ones added at the end. */
function withNewSections(value: unknown): SectionId[] | null {
  for (let i = LATER_SECTIONS.length - 1; i >= 0; i--) {
    const missing = LATER_SECTIONS.slice(i);
    const before = orderOf(
      value,
      RAIL_SECTIONS.filter((s) => !missing.includes(s)),
    );
    if (before) return [...before, ...missing];
  }
  return null;
}

function navStyle(value: unknown): NavStyle {
  return value === "attached" ? "attached" : "floating";
}

/** The tab bar from left to right, Home included. */
export function phoneTabs(nav: NavigationPreferences): (SectionId | "home")[] {
  if (nav.phoneHome === "left") return ["home", ...nav.phone];
  const half = Math.ceil(nav.phone.length / 2);
  return [...nav.phone.slice(0, half), "home", ...nav.phone.slice(half)];
}

/** The rail from top to bottom, Home included. */
export function railItems(nav: NavigationPreferences): (SectionId | "home")[] {
  return ["home", ...nav.rail];
}

/** Swaps two sections of an order. */
export function swap(order: SectionId[], a: SectionId, b: SectionId): SectionId[] {
  return order.map((s) => (s === a ? b : s === b ? a : s));
}

/** The order kept in the cookie (whatever got there; anything odd gives the default). */
export function navigationFromCookie(raw: string | undefined): NavigationPreferences {
  if (!raw) return DEFAULT_NAVIGATION;
  for (const text of [raw, safeDecode(raw)]) {
    try {
      return parseNavigation(JSON.parse(text));
    } catch {
      // Try the decoded form, then give up.
    }
  }
  return DEFAULT_NAVIGATION;
}

function safeDecode(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}
