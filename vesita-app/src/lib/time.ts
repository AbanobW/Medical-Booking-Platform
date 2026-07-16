/**
 * The clock.
 *
 * This replaces the seeded dataset's `TODAY`, which was pinned to
 * 2026-07-13 so that a generated dataset would hydrate identically on the
 * server and the client. Nothing is generated any more — every date on screen
 * comes from the API — so "now" is simply now.
 *
 * `now()` is a function, not a constant: a module-level `new Date()` would
 * freeze at the moment the bundle was first evaluated and slowly drift for the
 * life of the tab.
 *
 * Hydration: anything derived from `now()` must be computed in a client
 * component (inside an effect, an event handler, or a `useAsync` load), never
 * during a server render that the client will re-render. Server and client
 * evaluate `now()` at different instants, and a date that crosses midnight
 * between the two would mismatch.
 */

export function now(): Date {
  return new Date();
}

/** `2026-07-16T09:00:00.000Z` → `2026-07-16`. Domain dates are bare. */
export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function todayISO(): string {
  return toISODate(now());
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}
