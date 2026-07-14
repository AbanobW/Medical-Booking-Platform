/**
 * Local overlay for data MedPoint returns incompletely.
 *
 * Persists wizard context and profile IDs the API cannot list, so live-mode
 * screens can still render enriched bookings and family profiles.
 */

import type { Booking, BookingStatus } from "@/lib/types";

const STORAGE_KEY = "vesita:medpoint:overlay:v1";

interface OverlayState {
  /** accountId → ordered profile ids (newest last). */
  profileIds: Record<string, string[]>;
  /** accountId → bookings created in this browser via the live write path. */
  bookings: Record<string, OverlayBooking[]>;
}

/** Everything the wizard knows that `GET /bookings` does not return. */
export interface OverlayBookingContext {
  patientId: string;
  patientProfileId: string;
  patientInfo: Booking["patientInfo"];
  providerId: string;
  providerType: Booking["providerType"];
  providerName: string;
  providerNameAr: string;
  providerPhoto: string;
  providerSpecialty: string;
  serviceId: string;
  serviceName: string;
  serviceNameAr: string;
  branchId: string;
  date: string;
  time: string;
  paymentMethod: Booking["paymentMethod"];
  price: number;
  discount: number;
  cashback: number;
  total: number;
  couponCode?: string;
  bookingFee: number;
  capacityType: Booking["capacityType"];
  overCapacity: boolean;
  queueNumber?: number;
  estimatedTime?: string;
  acknowledgement?: Booking["acknowledgement"];
  address: string;
}

export interface OverlayBooking extends OverlayBookingContext {
  id: string;
  reference: string;
  status: BookingStatus;
  paymentStatus: Booking["paymentStatus"];
  createdAt: string;
  holdExpiresAt?: string;
}

function emptyState(): OverlayState {
  return { profileIds: {}, bookings: {} };
}

function readState(): OverlayState {
  if (typeof window === "undefined") return emptyState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as OverlayState;
    return {
      profileIds: parsed.profileIds ?? {},
      bookings: parsed.bookings ?? {},
    };
  } catch {
    return emptyState();
  }
}

function writeState(state: OverlayState): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// ---------------------------------------------------------------------------
// Patient profiles
// ---------------------------------------------------------------------------

export function listCachedProfileIds(accountId: string): string[] {
  return [...(readState().profileIds[accountId] ?? [])];
}

export function cacheProfileId(accountId: string, profileId: string): void {
  const state = readState();
  const ids = state.profileIds[accountId] ?? [];
  if (!ids.includes(profileId)) {
    state.profileIds[accountId] = [...ids, profileId];
    writeState(state);
  }
}

export function uncacheProfileId(accountId: string, profileId: string): void {
  const state = readState();
  const ids = state.profileIds[accountId];
  if (!ids) return;
  state.profileIds[accountId] = ids.filter((id) => id !== profileId);
  writeState(state);
}

// ---------------------------------------------------------------------------
// Bookings
// ---------------------------------------------------------------------------

export function listOverlayBookings(accountId: string): OverlayBooking[] {
  return [...(readState().bookings[accountId] ?? [])];
}

export function getOverlayBooking(accountId: string, id: string): OverlayBooking | undefined {
  return readState().bookings[accountId]?.find((b) => b.id === id);
}

/** Find a booking overlay by id across all accounts in this browser. */
export function findOverlayBookingById(id: string): OverlayBooking | undefined {
  const state = readState();
  for (const list of Object.values(state.bookings)) {
    const hit = list.find((b) => b.id === id);
    if (hit) return hit;
  }
  return undefined;
}

export function saveOverlayBooking(booking: OverlayBooking): void {
  const state = readState();
  const list = state.bookings[booking.patientId] ?? [];
  const index = list.findIndex((b) => b.id === booking.id);
  if (index >= 0) list[index] = booking;
  else list.unshift(booking);
  state.bookings[booking.patientId] = list;
  writeState(state);
}

export function removeOverlayBooking(accountId: string, id: string): void {
  const state = readState();
  const list = state.bookings[accountId];
  if (!list) return;
  state.bookings[accountId] = list.filter((b) => b.id !== id);
  writeState(state);
}

/** Overlay booking as a full domain `Booking` for list/card rendering. */
export function overlayToBooking(overlay: OverlayBooking): Booking {
  return {
    ...overlay,
    hasReview: false,
  };
}

/** Build an overlay record from wizard input + the wire booking id. */
export function createOverlayBooking(
  wireId: string,
  ctx: OverlayBookingContext,
  status: BookingStatus = "held",
): OverlayBooking {
  const suffix = wireId.slice(-6).toUpperCase();
  return {
    ...ctx,
    id: wireId,
    reference: `BK-${suffix}`,
    status,
    paymentStatus: "unpaid",
    createdAt: new Date().toISOString(),
    holdExpiresAt:
      status === "held" || status === "awaiting_payment"
        ? new Date(Date.now() + 10 * 60 * 1000).toISOString()
        : undefined,
  };
}
