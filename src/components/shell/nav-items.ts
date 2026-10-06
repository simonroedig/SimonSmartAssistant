import { CalendarClock, CloudSun, House, ListTodo, Settings2, ShoppingBasket, type LucideIcon } from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Home", icon: House },
  { href: "/planner", label: "Planner", icon: CalendarClock },
  { href: "/shopping", label: "Shopping", icon: ShoppingBasket },
  { href: "/todos", label: "Backlog", icon: ListTodo },
  { href: "/weather", label: "Weather", icon: CloudSun },
];

export const SETTINGS_ITEM: NavItem = { href: "/settings", label: "Settings", icon: Settings2 };

export function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
