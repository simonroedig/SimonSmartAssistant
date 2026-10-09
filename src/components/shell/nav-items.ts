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
import type { Tone } from "@/lib/tones";

export type NavItem = { href: string; label: string; icon: LucideIcon; tone: Tone };

export const HOME_ITEM: NavItem = { href: "/", label: "Home", icon: House, tone: "accent" };
export const PLANNER_ITEM: NavItem = { href: "/planner", label: "Planner", icon: CalendarClock, tone: "rose" };
export const SHOPPING_ITEM: NavItem = { href: "/shopping", label: "Shopping", icon: ShoppingBasket, tone: "emerald" };
export const BACKLOG_ITEM: NavItem = { href: "/todos", label: "Backlog", icon: ListTodo, tone: "yellow" };
export const NOTES_ITEM: NavItem = { href: "/notes", label: "Notes", icon: StickyNote, tone: "orange" };
export const WEATHER_ITEM: NavItem = { href: "/weather", label: "Weather", icon: CloudSun, tone: "sky" };
export const SETTINGS_ITEM: NavItem = { href: "/settings", label: "Settings", icon: Settings2, tone: "slate" };

/** Side rail on tablets, laptops and the wall display. */
export const RAIL_ITEMS: NavItem[] = [HOME_ITEM, PLANNER_ITEM, SHOPPING_ITEM, BACKLOG_ITEM, NOTES_ITEM, WEATHER_ITEM];

/**
 * Bottom tab bar on phones – Home in the middle, the anchor of the app. Weather
 * and settings are reached from the home screen.
 */
export const TAB_ITEMS: NavItem[] = [PLANNER_ITEM, SHOPPING_ITEM, HOME_ITEM, BACKLOG_ITEM, NOTES_ITEM];

export function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
