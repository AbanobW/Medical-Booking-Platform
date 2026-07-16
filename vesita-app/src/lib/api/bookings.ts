/**
 * Bookings.
 *
 * Creating a booking is real — `POST /v1/bookings`, via `medpoint/bookings`.
 * Reading one back is not, and that shapes this whole module.
 *
 * `GET /v1/bookings` returns rows with no provider, no service and no
 * appointment datetime. There is no way to tell which booking is whose, what it
 * was for, or when it is — so there is no list to show, no status to advance,
 * and nothing to cancel or refund against.
 *
 * All of that used to run on the seeded dataset: the nine-state lifecycle,
 * capacity arithmetic, coupon validation and refunds executed in the browser
 * over 620 generated bookings and persisted to localStorage. It looked like a
 * working booking system and was a simulation of one. It is gone.
 *
 * What survives is the part that is genuinely ours: the domain rules — what
 * "upcoming" means, what the fee is, when cancellation is still free. Those are
 * pure functions over a booking and stay correct wherever the booking came from.
 *
 * Restoring the rest needs a bookings payload with foreign keys and a datetime;
 * see BACKEND-GAPS.md.
 */

import { ApiError } from "@/lib/api/errors";
import * as live from "@/lib/api/medpoint/bookings";
import { BUSINESS } from "@/lib/site";
import { todayISO } from "@/lib/time";
import {
  isHold,
  type Acknowledgement,
  type Booking,
  type BookingStatus,
  type Coupon,
  type Paginated,
  type PatientInfo,
  type PaymentMethod,
  type Provider,
  type Service,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Domain rules — pure, and true of any booking
// ---------------------------------------------------------------------------

/** A booking is "upcoming" if it hasn't happened yet and is still alive. */
export function isUpcoming(booking: Booking): boolean {
  return (
    booking.date >= todayISO() &&
    (booking.status === "confirmed" || isHold(booking.status))
  );
}

export function findService(provider: Provider, serviceId: string): Service | undefined {
  const pool: Service[] =
    provider.type === "doctor"
      ? provider.consultationTypes
      : provider.type === "lab"
        ? [...provider.tests, ...provider.packages]
        : [...provider.scans, ...provider.packages];

  return pool.find((s) => s.id === serviceId);
}

/** Cash is paid at the clinic; anything online carries the platform's fee. */
export function bookingFeeFor(method: PaymentMethod): number {
  return method === "cash" ? 0 : BUSINESS.bookingFee;
}

function hoursUntil(booking: Booking): number {
  const at = new Date(`${booking.date}T${booking.time}:00Z`).getTime();
  return (at - Date.now()) / 3_600_000;
}

/** Whether cancelling now still qualifies for a full refund of the fee (§8). */
export function isWithinFreeCancellation(booking: Booking): boolean {
  return hoursUntil(booking) >= BUSINESS.freeCancellationHours;
}

// ---------------------------------------------------------------------------
// Errors the booking flow raises
// ---------------------------------------------------------------------------

/**
 * Raised when a place cannot simply be taken (§6, Appendix A).
 *
 * The patient never sees a bare error — they always get a clear outcome and a
 * next step. Capacity is the server's to enforce now; this type stays because
 * the booking flow is written to present it.
 */
export class CapacityError extends ApiError {
  constructor(
    message: string,
    readonly capacityType: Booking["capacityType"],
    readonly queuePosition?: number,
    readonly estimatedTime?: string,
    readonly nextSlot?: { date: string; time: string },
  ) {
    super(message, 409, "booking.capacity");
    this.name = "CapacityError";
  }
}

/** Raised when a profile fails a service's eligibility rules (§3). */
export class EligibilityError extends ApiError {
  constructor(
    message: string,
    readonly violations: string[],
  ) {
    super(message, 422, "booking.ineligible");
    this.name = "EligibilityError";
  }
}

function notSupported(what: string): ApiError {
  return new ApiError(
    `${what} is not available yet — the API returns bookings without a service, ` +
      "a provider or an appointment time, so a booking cannot be tracked after it is made.",
    501,
    "booking.notSupported",
  );
}

// ---------------------------------------------------------------------------
// Pricing & coupons
// ---------------------------------------------------------------------------

export interface PriceQuote {
  price: number;
  discount: number;
  cashback: number;
  total: number;
  coupon?: Coupon;
}

/**
 * The outcome of checking a coupon.
 *
 * `message` is the English wording and stays the fallback; `code` resolves
 * against `errors.coupon.*` so the same outcome can be shown in Arabic.
 */
export interface CouponResult {
  valid: boolean;
  message: string;
  /** Resolves against `errors.coupon.<code>`. */
  code: string;
  params?: Record<string, string | number>;
  discount: number;
  coupon?: Coupon;
}

/**
 * `/v1/coupons` lists real coupons, but a coupon cannot be *applied*: whether
 * one is valid depends on the provider type and order total of a booking, and
 * there is no validate endpoint. Deciding it in the browser would let anyone
 * mint a discount by editing the request, so no coupon is accepted rather than
 * one being honoured on a client's say-so.
 */
export async function validateCoupon(
  code: string,
  _price: number,
  _providerType: Provider["type"],
): Promise<CouponResult> {
  void _price;
  void _providerType;
  return {
    valid: false,
    message: "Coupons cannot be applied yet.",
    code: "notSupported",
    params: { code },
    discount: 0,
  };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export interface BookingQuery {
  patientId?: string;
  /** Booking history belongs to the profile, not the account (§1). */
  patientProfileId?: string;
  providerId?: string;
  branchId?: string;
  status?: BookingStatus;
  /** "upcoming" | "past" — a convenience filter for the patient dashboard. */
  when?: "upcoming" | "past";
  q?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Always empty, and deliberately so.
 *
 * A wire booking carries no service, provider or datetime, so a row cannot be
 * turned into anything a patient could read — not even "an appointment, some
 * time". An empty list is the truthful rendering of that.
 */
export async function getBookings(query: BookingQuery = {}): Promise<Paginated<Booking>> {
  return {
    items: [],
    total: 0,
    page: query.page ?? 1,
    pageSize: query.pageSize ?? 12,
    totalPages: 1,
  };
}

export async function getBookingById(_id: string): Promise<Booking> {
  void _id;
  throw notSupported("Opening a booking");
}

// ---------------------------------------------------------------------------
// Write path
// ---------------------------------------------------------------------------

export interface HoldBookingInput {
  patientId: string;
  patientProfileId: string;
  providerId: string;
  branchId: string;
  serviceId: string;
  date: string;
  time: string;
  patientInfo: PatientInfo;
  paymentMethod: PaymentMethod;
  couponCode?: string;
  acknowledgement?: Acknowledgement;
  /**
   * The patient has been told the session is busy and has accepted the longer
   * wait. Only ever honoured under a comfort limit — a strict limit is never
   * exceeded, whatever the patient consents to.
   */
  acceptOverCapacity?: boolean;
}

/** The only door into a booking. */
export const holdBooking = live.holdBooking;
export const createBooking = live.holdBooking;
export const beginPayment = live.beginPayment;
export const payBooking = live.payBooking;
export const releaseHold = live.releaseHold;

// ---------------------------------------------------------------------------
// Lifecycle — no endpoint carries any of it
// ---------------------------------------------------------------------------

export async function cancelBooking(_id: string, _reason: string): Promise<Booking> {
  void _id;
  void _reason;
  throw notSupported("Cancelling a booking");
}

export async function cancelByProvider(_id: string, _reason: string): Promise<Booking> {
  void _id;
  void _reason;
  throw notSupported("Cancelling a booking");
}

export async function cancelSession(
  _providerId: string,
  _branchId: string,
  _date: string,
  _time: string,
  _reason: string,
): Promise<{ cancelled: number }> {
  void _providerId;
  void _branchId;
  void _date;
  void _time;
  void _reason;
  throw notSupported("Cancelling a session");
}

export async function processRefund(_id: string): Promise<Booking> {
  void _id;
  throw notSupported("Refunding a booking");
}

export async function markCompleted(_id: string): Promise<Booking> {
  void _id;
  throw notSupported("Completing a booking");
}

export async function markNoShow(_id: string): Promise<Booking> {
  void _id;
  throw notSupported("Recording a missed visit");
}

export async function reportLongWait(_id: string): Promise<Booking> {
  void _id;
  throw notSupported("Reporting a long wait");
}

export async function rescheduleBooking(
  _id: string,
  _date: string,
  _time: string,
): Promise<Booking> {
  void _id;
  void _date;
  void _time;
  throw notSupported("Rescheduling a booking");
}

export async function updateBookingStatus(
  _id: string,
  _status: BookingStatus,
): Promise<Booking> {
  void _id;
  void _status;
  throw notSupported("Changing a booking's status");
}
