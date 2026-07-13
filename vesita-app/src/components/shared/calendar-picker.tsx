"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { addDays, TODAY, toISODate } from "@/lib/data/seed";
import { formatTime, relativeDay } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { SchedulingMode, TimeSlot } from "@/lib/types";

const WEEKDAY_INITIALS = ["S", "M", "T", "W", "T", "F", "S"];

/** Morning / afternoon / evening — how a doctor's session is actually named. */
export function sessionLabel(time: string): string {
  const hour = Number(time.split(":")[0]);
  if (hour < 12) return "Morning session";
  if (hour < 17) return "Afternoon session";
  return "Evening session";
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
      ? "Fully booked"
      : `${slot.remaining} of ${slot.capacity} places left`;

  const subtitleOf = slotSubtitle ?? defaultSubtitle;

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
            {days[0]?.date.toLocaleDateString("en-GB", {
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
              aria-label="Previous dates"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8 rounded-lg"
              onClick={() => setWeekOffset((w) => w + 1)}
              aria-label="Later dates"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>

        <div className="mb-2 grid grid-cols-7 gap-1.5">
          {WEEKDAY_INITIALS.map((initial, i) => (
            <div
              key={i}
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
                aria-label={`${relativeDay(day.iso)}, ${day.open} slots available`}
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
                <span className="font-medium tabular-nums">{day.dayOfMonth}</span>
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
            {mode === "session" ? "Sessions" : "Available times"} ·{" "}
            {relativeDay(selectedDate)}
          </p>

          {slots.length === 0 || openSlots.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {mode === "session"
                ? "No session on this date. Please choose another day."
                : "No open slots on this date. Please choose another day."}
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
                      "flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                      isSelected
                        ? "border-primary bg-primary/5 shadow-glow"
                        : state === "full"
                          ? "cursor-not-allowed border-dashed text-muted-foreground/60"
                          : "border-border hover:border-primary hover:bg-accent",
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">
                        {sessionLabel(slot.time)} ·{" "}
                        <span className="tabular-nums">{formatTime(slot.time)}</span>
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
                        {state === "full" ? "Full" : "Busy"}
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
                      "flex flex-col items-start gap-0.5 rounded-xl border px-3 py-2.5 text-left transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground shadow-glow"
                        : state === "full"
                          ? "cursor-not-allowed border-dashed text-muted-foreground/40"
                          : "border-border hover:border-primary hover:bg-accent",
                    )}
                  >
                    <span className="flex w-full items-center justify-between gap-2">
                      <span className="text-sm font-medium tabular-nums">
                        {formatTime(slot.time)}
                      </span>
                      {state === "busy" && (
                        <span className="text-[0.65rem] font-medium uppercase tracking-wide text-warning">
                          Busy
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
