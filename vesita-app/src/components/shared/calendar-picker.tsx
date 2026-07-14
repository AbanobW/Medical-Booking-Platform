"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { INTL_LOCALES } from "@/i18n/config";
import { addDays, TODAY, toISODate } from "@/lib/data/seed";
import { useFormat } from "@/lib/i18n/use-format";
import { cn } from "@/lib/utils";
import type { SchedulingMode, TimeSlot } from "@/lib/types";

/** Sunday-first, matching `Date#getUTCDay()`. */
const WEEKDAY_KEYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

/** Morning / afternoon / evening — how a doctor's session is actually named. */
type SessionKey = "morning" | "afternoon" | "evening";

function sessionKey(time: string): SessionKey {
  const hour = Number(time.split(":")[0]);
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

/**
 * English-only — kept for non-React callers. Inside a component, translate
 * `sessionKey(time)` through `common.calendar.session.*` instead.
 */
export function sessionLabel(time: string): string {
  const key = sessionKey(time);
  return key === "morning"
    ? "Morning session"
    : key === "afternoon"
      ? "Afternoon session"
      : "Evening session";
}

/** A strict limit that is used up is unbookable. A comfort limit is merely busy. */
function slotState(slot: TimeSlot): "open" | "busy" | "full" {
  if (!slot.isFull) return "open";
  return slot.capacityType === "strict" ? "full" : "busy";
}

/**
 * Date + time slot picker.
 *
 * Availability is keyed by ISO date (`Record<string, TimeSlot[]>`), exactly as
 * `getAvailability()` returns it. Dates with no open slots are disabled rather
 * than hidden, so the shape of a provider's week stays legible.
 *
 * Capacity is surfaced honestly (§5): a slot-based place shows how many places
 * are left; a session-based one is a session the patient joins, so the caller
 * supplies the queue estimate through `slotSubtitle`.
 */
export function CalendarPicker({
  availability,
  selectedDate,
  onSelectDate,
  selectedTime,
  onSelectTime,
  isLoading,
  mode = "slot",
  slotSubtitle,
  className,
}: {
  availability: Record<string, TimeSlot[]>;
  selectedDate?: string;
  onSelectDate: (date: string) => void;
  selectedTime?: string;
  onSelectTime?: (time: string) => void;
  isLoading?: boolean;
  /** `session` renders joinable sessions; `slot` renders appointment times. */
  mode?: SchedulingMode;
  /** Extra line under a place — the queue estimate, or places remaining. */
  slotSubtitle?: (slot: TimeSlot) => string;
  className?: string;
}) {
  const t = useTranslations("common");
  const { formatTime, relativeDay, formatNumber, locale } = useFormat();

  // Which 28-day window we're showing, as an offset in weeks from today.
  const [weekOffset, setWeekOffset] = useState(0);

  const days = useMemo(() => {
    return Array.from({ length: 28 }, (_, i) => {
      const date = addDays(TODAY, i + weekOffset * 28);
      const iso = toISODate(date);
      const slots = availability[iso] ?? [];
      const open = slots.filter((s) => s.isAvailable).length;

      return {
        iso,
        date,
        dayOfMonth: date.getUTCDate(),
        weekday: date.getUTCDay(),
        open,
        isDisabled: open === 0,
      };
    });
  }, [availability, weekOffset]);

  const slots = selectedDate ? (availability[selectedDate] ?? []) : [];
  const openSlots = slots.filter((s) => s.isAvailable);

  // Pad the first row so the 1st lands under the right weekday column.
  const leadingBlanks = days.length > 0 ? days[0].weekday : 0;

  const defaultSubtitle = (slot: TimeSlot): string =>
    slot.capacityType === "strict" && slot.isFull
      ? t("calendar.fullyBooked")
      : t("calendar.placesLeft", {
          remaining: formatNumber(slot.remaining),
          capacity: formatNumber(slot.capacity),
        });

  const subtitleOf = slotSubtitle ?? defaultSubtitle;

  /** Narrow weekday letters, Sunday-first — `Intl` gives us both languages. */
  const weekdayInitials = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(INTL_LOCALES[locale], {
      weekday: "narrow",
      timeZone: "UTC",
    });
    // 2024-01-07 is a Sunday.
    return WEEKDAY_KEYS.map((_, i) =>
      formatter.format(new Date(Date.UTC(2024, 0, 7 + i))),
    );
  }, [locale]);

  if (isLoading) {
    return (
      <div className={cn("space-y-6", className)}>
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      <div className="rounded-2xl border bg-card p-4 shadow-soft">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-medium">
            {days[0]?.date.toLocaleDateString(INTL_LOCALES[locale], {
              month: "long",
              year: "numeric",
              timeZone: "UTC",
            })}
          </p>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-8 rounded-lg"
              onClick={() => setWeekOffset((w) => Math.max(0, w - 1))}
              disabled={weekOffset === 0}
              aria-label={t("calendar.previousDates")}
            >
              <ChevronLeft className="size-4 rtl:rotate-180" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8 rounded-lg"
              onClick={() => setWeekOffset((w) => w + 1)}
              aria-label={t("calendar.laterDates")}
            >
              <ChevronRight className="size-4 rtl:rotate-180" />
            </Button>
          </div>
        </div>

        <div className="mb-2 grid grid-cols-7 gap-1.5">
          {weekdayInitials.map((initial, i) => (
            <div
              key={WEEKDAY_KEYS[i]}
              className="text-center text-xs font-medium text-muted-foreground"
              aria-hidden
            >
              {initial}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: leadingBlanks }, (_, i) => (
            <div key={`blank-${i}`} />
          ))}

          {days.map((day) => {
            const isSelected = day.iso === selectedDate;

            return (
              <button
                key={day.iso}
                type="button"
                disabled={day.isDisabled}
                onClick={() => onSelectDate(day.iso)}
                aria-label={t("calendar.dayAvailability", {
                  day: relativeDay(day.iso),
                  count: day.open,
                })}
                aria-pressed={isSelected}
                className={cn(
                  "flex aspect-square flex-col items-center justify-center rounded-xl border text-sm transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground shadow-glow"
                    : day.isDisabled
                      ? "cursor-not-allowed border-transparent text-muted-foreground/40"
                      : "border-border hover:border-primary hover:bg-accent",
                )}
              >
                <span className="font-medium tabular-nums">
                  {formatNumber(day.dayOfMonth)}
                </span>
                {/* A dot is the availability cue; disabled days simply have none. */}
                {!day.isDisabled && (
                  <span
                    className={cn(
                      "mt-0.5 size-1 rounded-full",
                      isSelected ? "bg-primary-foreground" : "bg-success",
                    )}
                    aria-hidden
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {selectedDate && onSelectTime && (
        <div className="rounded-2xl border bg-card p-4 shadow-soft">
          <p className="mb-3 text-sm font-medium">
            {mode === "session"
              ? t("calendar.sessions")
              : t("calendar.availableTimes")}{" "}
            · {relativeDay(selectedDate)}
          </p>

          {slots.length === 0 || openSlots.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {mode === "session"
                ? t("calendar.noSessions")
                : t("calendar.noSlots")}
            </p>
          ) : mode === "session" ? (
            <div className="space-y-2">
              {slots.map((slot) => {
                const state = slotState(slot);
                const isSelected = slot.time === selectedTime;

                return (
                  <button
                    key={slot.id}
                    type="button"
                    disabled={state === "full"}
                    onClick={() => onSelectTime(slot.time)}
                    aria-pressed={isSelected}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-start transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                      isSelected
                        ? "border-primary bg-primary/5 shadow-glow"
                        : state === "full"
                          ? "cursor-not-allowed border-dashed text-muted-foreground/60"
                          : "border-border hover:border-primary hover:bg-accent",
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">
                        {t(`calendar.session.${sessionKey(slot.time)}`)} ·{" "}
                        <span className="tabular-nums ltr-nums">
                          {formatTime(slot.time)}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {subtitleOf(slot)}
                      </span>
                    </span>

                    {state !== "open" && (
                      <Badge
                        variant={state === "full" ? "outline" : "secondary"}
                        className="shrink-0"
                      >
                        {state === "full" ? t("calendar.full") : t("calendar.busy")}
                      </Badge>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {slots.map((slot) => {
                const state = slotState(slot);
                const isSelected = slot.time === selectedTime;

                return (
                  <button
                    key={slot.id}
                    type="button"
                    disabled={state === "full"}
                    onClick={() => onSelectTime(slot.time)}
                    aria-pressed={isSelected}
                    className={cn(
                      "flex flex-col items-start gap-0.5 rounded-xl border px-3 py-2.5 text-start transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground shadow-glow"
                        : state === "full"
                          ? "cursor-not-allowed border-dashed text-muted-foreground/40"
                          : "border-border hover:border-primary hover:bg-accent",
                    )}
                  >
                    <span className="flex w-full items-center justify-between gap-2">
                      <span className="text-sm font-medium tabular-nums ltr-nums">
                        {formatTime(slot.time)}
                      </span>
                      {state === "busy" && (
                        <span className="text-[0.65rem] font-medium uppercase tracking-wide text-warning">
                          {t("calendar.busy")}
                        </span>
                      )}
                    </span>
                    <span
                      className={cn(
                        "text-[0.7rem]",
                        isSelected
                          ? "text-primary-foreground/80"
                          : "text-muted-foreground",
                      )}
                    >
                      {subtitleOf(slot)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
