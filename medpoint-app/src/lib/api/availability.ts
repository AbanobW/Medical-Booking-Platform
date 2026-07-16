/**
 * Time helpers shared by the booking screens.
 *
 * What used to be here — `slotsForBranch`, `releaseExpiredHolds`,
 * `queuePositionFor`, `nextAvailableSlot` — generated availability by walking a
 * schedule template and subtracting the mock's bookings. It produced slots that
 * existed nowhere but in the browser.
 *
 * Real availability comes from `/v1/slots` and `/v1/doctor-sessions` via
 * `medpoint/availability`, and capacity is the server's to enforce. Only the
 * pure clock arithmetic survives, because it belongs to no dataset.
 */

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTime(total: number): string {
  const h = Math.floor(total / 60);
  return `${String(h).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export {
  getAvailability,
  getSlotsForDate,
  getNextSlots,
  clearAvailabilityCache,
} from "@/lib/api/medpoint/availability";
