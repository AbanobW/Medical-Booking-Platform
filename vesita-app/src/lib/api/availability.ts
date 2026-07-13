import { db } from "@/lib/api/client";
import { addDays, TODAY, toISODate } from "@/lib/data/seed";
import {
  consumesCapacity,
  isHold,
  schedulingModeFor,
  type Booking,
  type Branch,
  type DaySchedule,
  type Provider,
  type TimeSlot,
  type Weekday,
} from "@/lib/types";

/**
 * Availability and capacity (Business Logic §5, §6, Appendix A).
 *
 * Availability is always resolved at the *branch* level. Capacity is the single
 * source of truth for how many places exist, and confirmed bookings *and active
 * holds* both count against it — so a place is never double-sold, and never
 * stranded once a hold lapses.
 */

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTime(total: number): string {
  const h = Math.floor(total / 60);
  return `${String(h).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** Right now, as the deterministic dataset understands it. */
function nowISO(): string {
  return new Date().toISOString();
}

/**
 * Releases holds whose reservation window has lapsed (§9).
 *
 * A lapsed hold is *discarded*, not left half-alive: the place returns to
 * capacity immediately and the patient can simply try again. There is no
 * half-paid, half-held state that lingers.
 *
 * Every read of availability and every booking attempt sweeps first, so an
 * expired hold can never block a place it no longer owns.
 */
export function releaseExpiredHolds(): number {
  const state = db();
  const now = nowISO();

  const before = state.bookings.length;
  state.bookings = state.bookings.filter(
    (b) => !(isHold(b.status) && b.holdExpiresAt !== undefined && b.holdExpiresAt <= now),
  );
  return before - state.bookings.length;
}

/** Bookings that currently consume a place at this branch, date and time. */
export function bookingsHolding(
  branchId: string,
  date: string,
  time: string,
): Booking[] {
  return db().bookings.filter(
    (b) =>
      b.branchId === branchId &&
      b.date === date &&
      b.time === time &&
      consumesCapacity(b.status),
  );
}

export function branchOf(provider: Provider, branchId?: string): Branch | undefined {
  if (!branchId) return provider.branches[0];
  return provider.branches.find((b) => b.id === branchId);
}

export function scheduleFor(branch: Branch, date: string): DaySchedule | undefined {
  const weekday = new Date(`${date}T00:00:00.000Z`).getUTCDay() as Weekday;
  const day = branch.schedule.find((d) => d.weekday === weekday);
  return day?.isWorkingDay ? day : undefined;
}

function onHoliday(providerId: string, date: string): boolean {
  return db().holidays.some((h) => h.providerId === providerId && h.date === date);
}

/**
 * Expands a branch's weekly schedule into concrete bookable places for a date.
 *
 * For a session-based doctor this yields one entry per session (the patient
 * joins the session and receives a queue number). For a slot-based lab or
 * radiology center it yields one entry per appointment slot.
 */
export function slotsForBranch(
  provider: Provider,
  branch: Branch,
  date: string,
): TimeSlot[] {
  releaseExpiredHolds();

  const day = scheduleFor(branch, date);
  if (!day) return [];
  if (!branch.isActive) return [];
  if (onHoliday(provider.id, date)) return [];

  // A soft-suspended provider takes no new bookings, but honors existing ones.
  if (provider.status !== "approved") return [];

  const mode = schedulingModeFor(provider.type);
  const start = timeToMinutes(day.startTime);
  const end = timeToMinutes(day.endTime);

  const times: string[] =
    mode === "session"
      ? [day.startTime]
      : Array.from(
          { length: Math.max(0, Math.floor((end - start) / day.slotDurationMinutes)) },
          (_, i) => minutesToTime(start + i * day.slotDurationMinutes),
        ).filter(
          (time) =>
            !day.breaks.some(
              (b) =>
                timeToMinutes(time) >= timeToMinutes(b.startTime) &&
                timeToMinutes(time) < timeToMinutes(b.endTime),
            ),
        );

  return times.map((time) => {
    const taken = bookingsHolding(branch.id, date, time).length;
    const remaining = Math.max(0, day.capacity - taken);
    const isFull = taken >= day.capacity;

    return {
      id: `${branch.id}-${date}-${time}`,
      date,
      time,
      taken,
      capacity: day.capacity,
      capacityType: day.capacityType,
      remaining,
      isFull,
      isBooked: isFull,
      // Under a comfort limit a full session is still bookable — the patient is
      // simply told it is busy and offered the next place with a longer wait.
      // Under a strict limit, full means full.
      isAvailable: day.capacityType === "comfort" ? true : !isFull,
    };
  });
}

/** The place a patient would take at this session, and where they'd sit in it. */
export function queuePositionFor(
  branchId: string,
  date: string,
  time: string,
): number {
  return bookingsHolding(branchId, date, time).length + 1;
}

/** Estimated time to be seen, from the session start and the queue position. */
export function estimatedTimeFor(
  day: DaySchedule,
  queueNumber: number,
): string {
  return minutesToTime(
    timeToMinutes(day.startTime) + (queueNumber - 1) * day.slotDurationMinutes,
  );
}

/**
 * The next bookable place at or after a date — what we offer the patient who
 * loses the race for the last place, so they always get a next step and never
 * a dead end (§6).
 */
export function nextAvailableSlot(
  provider: Provider,
  branch: Branch,
  fromDate: string,
  options: { skip?: { date: string; time: string }; days?: number } = {},
): TimeSlot | undefined {
  const { skip, days = 30 } = options;
  const start = new Date(`${fromDate}T00:00:00.000Z`);

  for (let i = 0; i < days; i++) {
    const date = toISODate(addDays(start, i));

    for (const slot of slotsForBranch(provider, branch, date)) {
      if (skip && slot.date === skip.date && slot.time === skip.time) continue;
      // A strictly-full place is not a place. A comfort-limited one still is.
      if (slot.capacityType === "strict" && slot.isFull) continue;
      return slot;
    }
  }
  return undefined;
}

/** The earliest date this provider has anything open — powers the search sort. */
export function earliestAvailability(provider: Provider): string | undefined {
  const today = toISODate(TODAY);

  for (const branch of provider.branches) {
    const slot = nextAvailableSlot(provider, branch, today, { days: 14 });
    if (slot) return `${slot.date} ${slot.time}`;
  }
  return undefined;
}
