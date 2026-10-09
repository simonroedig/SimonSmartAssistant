"use client";

import { useCallback } from "react";
import { birthdayLabel, isBirthdayOn } from "@/lib/birthdays";
import { type ClockChange, clockChangeOn } from "@/lib/clock-change";
import type { DayKey } from "@/lib/date";
import { type CalendarDay, calendarDayOf } from "@/lib/holidays";
import { useBirthdays } from "./birthdays";
import type { Birthday } from "./core";
import { useSettings } from "./settings";

export type DayExtras = {
  /** Public holiday or a day worth knowing about for the shops. */
  holiday: CalendarDay | null;
  /** Summer or winter time starts. */
  clockChange: ClockChange | null;
  birthdays: { birthday: Birthday; label: string }[];
};

const NONE: DayExtras = { holiday: null, clockChange: null, birthdays: [] };

export function hasExtras(extras: DayExtras): boolean {
  return extras.holiday !== null || extras.clockChange !== null || extras.birthdays.length > 0;
}

/**
 * Holidays, clock changes and birthdays for any day, as switched on in Settings. Returns a
 * lookup function so calendars can ask for many days cheaply.
 */
export function useDayExtras(): (day: DayKey) => DayExtras {
  const { settings } = useSettings();
  const birthdays = useBirthdays();
  const { holidays, clockChanges, region, birthdays: showBirthdays } = settings.calendar;
  const list = birthdays.data;

  return useCallback(
    (day: DayKey) => {
      const holiday = holidays ? calendarDayOf(day, region) : null;
      const clockChange = clockChanges ? clockChangeOn(day) : null;
      const people =
        showBirthdays && list
          ? list.filter((b) => isBirthdayOn(b, day)).map((b) => ({ birthday: b, label: birthdayLabel(b, day) }))
          : [];
      return holiday || clockChange || people.length > 0 ? { holiday, clockChange, birthdays: people } : NONE;
    },
    [holidays, clockChanges, region, showBirthdays, list],
  );
}
