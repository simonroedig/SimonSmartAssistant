import {
  CalendarClock,
  CloudSun,
  House,
  ListTodo,
  Settings2,
  ShoppingBasket,
  StickyNote,
  type LucideIcon,
} from "lucide-react";
import type { SectionId } from "@/lib/navigation";
import type { Tone } from "@/lib/tones";

export type NavItem = { href: string; label: string; icon: LucideIcon; tone: Tone };

export const HOME_ITEM: NavItem = { href: "/", label: "Home", icon: House, tone: "accent" };
export const PLANNER_ITEM: NavItem = { href: "/planner", label: "Planner", icon: CalendarClock, tone: "rose" };
export const SHOPPING_ITEM: NavItem = { href: "/shopping", label: "Shopping", icon: ShoppingBasket, tone: "emerald" };
export const BACKLOG_ITEM: NavItem = { href: "/todos", label: "Backlog", icon: ListTodo, tone: "yellow" };
export const NOTES_ITEM: NavItem = { href: "/notes", label: "Notes", icon: StickyNote, tone: "orange" };
export const WEATHER_ITEM: NavItem = { href: "/weather", label: "Weather", icon: CloudSun, tone: "sky" };
export const SETTINGS_ITEM: NavItem = { href: "/settings", label: "Settings", icon: Settings2, tone: "slate" };

/** The sections that can be ordered in Settings (Home and Settings keep their place). */
export const SECTION_ITEMS: Record<SectionId, NavItem> = {
  planner: PLANNER_ITEM,
  shopping: SHOPPING_ITEM,
  backlog: BACKLOG_ITEM,
  notes: NOTES_ITEM,
  weather: WEATHER_ITEM,
};

export function navItem(id: SectionId | "home"): NavItem {
  return id === "home" ? HOME_ITEM : SECTION_ITEMS[id];
}

export function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
