"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { INTL_LOCALES, type Locale } from "@/i18n/config";
import { addDays, now, toISODate } from "@/lib/time";
import { useFormat } from "@/lib/i18n/use-format";
import { cn } from "@/lib/utils";
import type {
  DaySchedule,
  Holiday,
  SchedulingMode,
  Weekday,
} from "@/lib/types";

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
  const t = useTranslations("provider");
  const { locale } = useFormat();
  const intlLocale = INTL_LOCALES[locale as Locale];

  const [offset, setOffset] = useState(0);
  const dayByWeekday = new Map<Weekday, DaySchedule>(
    schedule.map((d) => [d.weekday, d]),
  );

  const firstOfMonth = new Date(
    Date.UTC(now().getUTCFullYear(), now().getUTCMonth() + offset, 1),
  );
  const daysInMonth = new Date(
    Date.UTC(firstOfMonth.getUTCFullYear(), firstOfMonth.getUTCMonth() + 1, 0),
  ).getUTCDate();

  const leadingBlanks = firstOfMonth.getUTCDay();
  const todayIso = toISODate(now());

  const holidayByDate = new Map(holidays.map((h) => [h.date, h]));
  const workingByWeekday = new Map<Weekday, boolean>(
    schedule.map((d) => [d.weekday, d.isWorkingDay]),
  );

  const cells = Array.from({ length: daysInMonth }, (_, i) =>
    addDays(firstOfMonth, i),
  );

  const monthLabel = firstOfMonth.toLocaleDateString(intlLocale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  // The column headings are the weekday narrows for the locale (S M T W…,
  // ح ن ث ر…) — derived rather than hand-listed so Arabic reads naturally.
  const narrowWeekday = new Intl.DateTimeFormat(intlLocale, {
    weekday: "narrow",
    timeZone: "UTC",
  });
  const dayInitials = Array.from({ length: 7 }, (_, i) =>
    // 2024-01-07 is a Sunday, matching `Weekday` 0.
    narrowWeekday.format(new Date(Date.UTC(2024, 0, 7 + i))),
  );

  return (
    <Card className={className}>
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="text-base">{monthLabel}</CardTitle>
          <CardDescription>
            {branchName
              ? t("calendar.descriptionAt", { branch: branchName })
              : t("calendar.description")}
          </CardDescription>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={t("calendar.previousMonth")}
            onClick={() => setOffset((o) => o - 1)}
          >
            <ChevronLeft className="size-4 rtl:rotate-180" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOffset(0)}
            disabled={offset === 0}
          >
            {t("calendar.today")}
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={t("calendar.nextMonth")}
            onClick={() => setOffset((o) => o + 1)}
          >
            <ChevronRight className="size-4 rtl:rotate-180" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-7 gap-1.5">
          {dayInitials.map((initial, i) => (
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

            let label: string;

            if (holiday) {
              label = t("calendar.cellHoliday", {
                date: iso,
                reason: holiday.reason,
              });
            } else if (isWorking && day) {
              const limit =
                day.capacityType === "strict"
                  ? t("schedule.limitShortStrict")
                  : t("schedule.limitShortComfort");

              const capacity =
                mode === "session"
                  ? t("calendar.capacitySession", { count: day.capacity, limit })
                  : t("calendar.capacitySlot", { count: day.capacity, limit });

              label = t("calendar.cellWorkingDetail", {
                date: iso,
                capacity,
                start: day.startTime,
                end: day.endTime,
              });
            } else if (isWorking) {
              label = t("calendar.cellWorking", { date: iso });
            } else {
              label = t("calendar.cellOff", { date: iso });
            }

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
            {t("calendar.workingDay")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="size-3 rounded-[4px] border border-dashed bg-muted/40"
              aria-hidden
            />
            {t("calendar.dayOff")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="size-3 rounded-[4px] border border-destructive/40 bg-destructive/10"
              aria-hidden
            />
            {t("calendar.holiday")}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
