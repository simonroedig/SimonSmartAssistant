"use client";

import { Moon, Sun } from "lucide-react";
import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { TimeField } from "@/components/ui/time-field";
import {
  applyToDays,
  sharedDay,
  type SleepDay,
  type SleepSchedule,
  WEEKDAY_NAMES,
  WEEKDAYS,
  WEEKEND,
} from "@/lib/sleep";
import { formatDuration, MINUTES_PER_DAY } from "@/lib/time";
import { cn } from "@/lib/utils";

function DayRow({
  label,
  value,
  onChange,
  className,
}: {
  label: string;
  value: SleepDay;
  onChange: (patch: Partial<SleepDay>) => void;
  className?: string;
}) {
  const sleep = MINUTES_PER_DAY - (value.bed - value.wake);
  return (
    <div className={cn("rounded-3xl p-4 well", className)}>
      <div className="mb-3 flex items-baseline justify-between">
        <span className="font-semibold">{label}</span>
        <span className="text-xs text-muted tabular">{formatDuration(sleep)} sleep</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted uppercase">
            <Sun className="size-3.5" /> Wake up
          </div>
          <TimeField
            value={value.wake}
            onChange={(wake) => onChange({ wake })}
            min={0}
            max={Math.min(value.bed - 60, MINUTES_PER_DAY - 15)}
            label="Wake up"
          />
        </div>
        <div>
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted uppercase">
            <Moon className="size-3.5" /> Bedtime
          </div>
          <TimeField
            value={value.bed}
            onChange={(bed) => onChange({ bed })}
            min={value.wake + 60}
            max={MINUTES_PER_DAY + 6 * 60}
            label="Bedtime"
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Sleep times per weekday (greyed out in the planner). Edit weekdays and the
 * weekend as groups, or switch to individual days.
 */
export function SleepScheduleEditor({
  value,
  onChange,
}: {
  value: SleepSchedule;
  onChange: (schedule: SleepSchedule) => void;
}) {
  const groupsUniform = sharedDay(value, WEEKDAYS) !== null && sharedDay(value, WEEKEND) !== null;
  const [perDay, setPerDay] = useState(!groupsUniform);

  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center justify-between gap-4 px-1">
        <span className="text-sm text-muted">Set each day individually</span>
        <Switch
          checked={perDay}
          onCheckedChange={(on) => {
            setPerDay(on);
            if (!on) {
              // Collapse to groups using Monday and Saturday as the template.
              const unified = applyToDays(applyToDays(value, WEEKDAYS, value[0]), WEEKEND, value[5]);
              onChange(unified);
            }
          }}
          label="Set each day individually"
        />
      </label>
      {perDay ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {value.map((day, i) => (
            <DayRow
              key={WEEKDAY_NAMES[i]}
              label={WEEKDAY_NAMES[i]}
              value={day}
              onChange={(patch) => onChange(applyToDays(value, [i], patch))}
            />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          <DayRow
            label="Weekdays · Mon–Fri"
            value={value[0]}
            onChange={(patch) => onChange(applyToDays(value, WEEKDAYS, patch))}
          />
          <DayRow
            label="Weekend · Sat–Sun"
            value={value[5]}
            onChange={(patch) => onChange(applyToDays(value, WEEKEND, patch))}
          />
        </div>
      )}
    </div>
  );
}
