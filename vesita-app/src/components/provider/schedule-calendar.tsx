"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { addDays, TODAY, toISODate } from "@/lib/data/seed";
import { cn } from "@/lib/utils";
import type {
  DaySchedule,
  Holiday,
  SchedulingMode,
  Weekday,
} from "@/lib/types";

const DAY_INITIALS = ["S", "M", "T", "W", "T", "F", "S"];

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * A month grid over the weekly schedule + holiday list.
 *
 * Working days are tinted; holidays override them and are hatched + struck
 * through, so the distinction survives greyscale and colour-blind viewing.
 */
export function ScheduleCalendar({
  schedule,
  holidays,
  branchName,
  mode = "slot",
  className,
}: {
  schedule: DaySchedule[];
  holidays: Holiday[];
  /** Which branch this schedule belongs to (§2) — schedules are per branch. */
  branchName?: string;
  mode?: SchedulingMode;
  className?: string;
}) {
  const [offset, setOffset] = useState(0);
  const dayByWeekday = new Map<Weekday, DaySchedule>(
    schedule.map((d) => [d.weekday, d]),
  );

  const firstOfMonth = new Date(
    Date.UTC(TODAY.getUTCFullYear(), TODAY.getUTCMonth() + offset, 1),
  );
  const daysInMonth = new Date(
    Date.UTC(firstOfMonth.getUTCFullYear(), firstOfMonth.getUTCMonth() + 1, 0),
  ).getUTCDate();

  const leadingBlanks = firstOfMonth.getUTCDay();
  const todayIso = toISODate(TODAY);

  const holidayByDate = new Map(holidays.map((h) => [h.date, h]));
  const workingByWeekday = new Map<Weekday, boolean>(
    schedule.map((d) => [d.weekday, d.isWorkingDay]),
  );

  const cells = Array.from({ length: daysInMonth }, (_, i) =>
    addDays(firstOfMonth, i),
  );

  return (
    <Card className={className}>
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="text-base">
            {MONTH_NAMES[firstOfMonth.getUTCMonth()]}{" "}
            {firstOfMonth.getUTCFullYear()}
          </CardTitle>
          <CardDescription>
            {branchName
              ? `Working days, days off and holidays at ${branchName}`
              : "Working days, days off and holidays at a glance"}
          </CardDescription>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Previous month"
            onClick={() => setOffset((o) => o - 1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOffset(0)}
            disabled={offset === 0}
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Next month"
            onClick={() => setOffset((o) => o + 1)}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-7 gap-1.5">
          {DAY_INITIALS.map((initial, i) => (
            <div
              key={i}
              className="pb-1 text-center text-xs font-medium text-muted-foreground"
              aria-hidden
            >
              {initial}
            </div>
          ))}

          {Array.from({ length: leadingBlanks }, (_, i) => (
            <div key={`blank-${i}`} />
          ))}

          {cells.map((date) => {
            const iso = toISODate(date);
            const weekday = date.getUTCDay() as Weekday;
            const holiday = holidayByDate.get(iso);
            const isWorking = workingByWeekday.get(weekday) ?? false;
            const isToday = iso === todayIso;
            const day = dayByWeekday.get(weekday);

            const capacityNote =
              isWorking && day
                ? ` — ${day.capacity} ${mode === "session" ? "patients" : "places per slot"} (${day.capacityType} limit), ${day.startTime}–${day.endTime}`
                : "";

            const label = holiday
              ? `${iso} — holiday: ${holiday.reason}`
              : `${iso} — ${isWorking ? "working day" : "day off"}${capacityNote}`;

            return (
              <div
                key={iso}
                title={label}
                aria-label={label}
                className={cn(
                  "flex aspect-square flex-col items-center justify-center rounded-xl border text-sm tabular-nums transition-colors",
                  holiday
                    ? "border-destructive/40 bg-destructive/10 font-medium text-destructive line-through"
                    : isWorking
                      ? "border-primary/30 bg-primary/10 font-medium text-foreground"
                      : "border-dashed bg-muted/40 text-muted-foreground",
                  isToday && "ring-2 ring-ring ring-offset-1 ring-offset-background",
                )}
              >
                {date.getUTCDate()}
                {holiday && (
                  <span className="mt-0.5 max-w-full truncate px-1 text-[10px] leading-none no-underline">
                    {holiday.reason}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-4 border-t pt-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span
              className="size-3 rounded-[4px] border border-primary/30 bg-primary/10"
              aria-hidden
            />
            Working day
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="size-3 rounded-[4px] border border-dashed bg-muted/40"
              aria-hidden
            />
            Day off
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="size-3 rounded-[4px] border border-destructive/40 bg-destructive/10"
              aria-hidden
            />
            Holiday
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
