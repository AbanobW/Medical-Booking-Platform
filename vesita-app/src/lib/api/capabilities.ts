/**
 * Per-capability routing for the hybrid live/mock backend.
 *
 * `NEXT_PUBLIC_API_MODE=live` does not flip the whole app at once — each domain
 * is enabled only when MedPoint can actually serve it. Anything disabled here
 * falls back to the seeded mock so screens never go blank.
 *
 * See `BACKEND-GAPS.md` for why each flag is on or off.
 */

import { isLive } from "@/lib/api/config";

export type LiveCapability =
  | "auth"
  | "profiles"
  | "discovery"
  | "availability"
  | "bookingWrite"
  | "bookingRead"
  | "favorites"
  | "reviews"
  | "notifications";

/**
 * Which capabilities hit MedPoint when `NEXT_PUBLIC_API_MODE=live`.
 *
 * Flip a flag to `true` only once the staging API can serve that flow end-to-end
 * (or the documented degraded path is acceptable).
 */
const LIVE_CAPABILITIES: Record<LiveCapability, boolean> = {
  auth: true,
  /** `GET /v1/patient-profiles` 500s — list uses overlay cache; CRUD is live. */
  profiles: true,
  /** Thin Provider payload; filters run client-side on fetched pages. */
  discovery: true,
  /** Slots + doctor-sessions fetched and filtered client-side. */
  availability: true,
  /** `POST /bookings` + `POST /payments`; enriched via overlay. */
  bookingWrite: true,
  /** Booking responses lack FKs and appointment datetime — read stays mock. */
  bookingRead: false,
  /** No `/v1/favorites` resource on MedPoint. */
  favorites: false,
  reviews: false,
  notifications: false,
};

/** True when this capability should call MedPoint instead of the mock. */
export function isLiveCapability(cap: LiveCapability): boolean {
  if (!isLive()) return false;
  return LIVE_CAPABILITIES[cap];
}

/** All capabilities and whether they are live — for diagnostics. */
export function liveCapabilityMap(): Readonly<Record<LiveCapability, boolean>> {
  if (!isLive()) {
    return Object.fromEntries(
      Object.keys(LIVE_CAPABILITIES).map((k) => [k, false]),
    ) as Record<LiveCapability, boolean>;
  }
  return { ...LIVE_CAPABILITIES };
}
