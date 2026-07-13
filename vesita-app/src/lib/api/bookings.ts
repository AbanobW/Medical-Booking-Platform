import {
  branchOf,
  estimatedTimeFor,
  nextAvailableSlot,
  queuePositionFor,
  releaseExpiredHolds,
  scheduleFor,
  slotsForBranch,
} from "@/lib/api/availability";
import {
  ApiError,
  db,
  makeId,
  makeReference,
  paginate,
  request,
} from "@/lib/api/client";
import { SPECIALTIES } from "@/lib/data/egypt";
import { TODAY, toISODate } from "@/lib/data/seed";
import { evaluateEligibility } from "@/lib/eligibility";
import { BUSINESS } from "@/lib/site";
import {
  branchPriceOf,
  canTransition,
  isCancelled,
  isHold,
  requiresAcknowledgement,
  schedulingModeFor,
  type Acknowledgement,
  type Booking,
  type BookingStatus,
  type CapacityType,
  type Coupon,
  type Paginated,
  type PatientInfo,
  type PaymentMethod,
  type Provider,
  type Service,
  type TimeSlot,
} from "@/lib/types";

const TODAY_ISO = toISODate(TODAY);

/** A booking is "upcoming" if it hasn't happened yet and is still alive. */
export function isUpcoming(booking: Booking): boolean {
  return (
    booking.date >= TODAY_ISO &&
    (booking.status === "confirmed" || isHold(booking.status))
  );
}

function specialtyLabelOf(provider: Provider): string {
  if (provider.type === "doctor") {
    return SPECIALTIES.find((s) => s.id === provider.specialtyId)?.name ?? "General";
  }
  return provider.type === "lab" ? "Medical Laboratory" : "Radiology Center";
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

// ---------------------------------------------------------------------------
// Capacity conflicts (§6, Appendix A)
// ---------------------------------------------------------------------------

/**
 * Raised when a place cannot simply be taken.
 *
 * The patient never sees a bare error — they always get a clear outcome and a
 * next step. Under a *comfort* limit the session is merely busy: we surface the
 * queue position and the longer wait, and the patient decides. Under a *strict*
 * limit the session is genuinely full: we offer the next session or slot.
 */
export class CapacityError extends ApiError {
  constructor(
    message: string,
    readonly kind: "comfort_busy" | "strict_full",
    readonly detail: {
      capacityType: CapacityType;
      /** Where the patient would land if they accept a busy session. */
      queueNumber?: number;
      estimatedTime?: string;
      /** The next place we can actually offer, when this one is full. */
      nextSlot?: TimeSlot;
    },
  ) {
    super(message, 409);
    this.name = "CapacityError";
  }
}

/** Raised when the selected profile may not have this service (§3). */
export class EligibilityError extends ApiError {
  constructor(
    message: string,
    readonly violations: { code: string; message: string }[],
  ) {
    super(message, 422);
    this.name = "EligibilityError";
  }
}

// ---------------------------------------------------------------------------
// Coupons & pricing
// ---------------------------------------------------------------------------

export interface PriceQuote {
  price: number;
  discount: number;
  cashback: number;
  total: number;
  coupon?: Coupon;
}

/** Validates a coupon against the order and returns the resulting discount. */
export function validateCoupon(
  code: string,
  price: number,
  providerType: Provider["type"],
): Promise<{ valid: boolean; message: string; discount: number; coupon?: Coupon }> {
  return request(() => {
    const coupon = db().coupons.find(
      (c) => c.code.toUpperCase() === code.trim().toUpperCase(),
    );

    if (!coupon) {
      return { valid: false, message: "This coupon code does not exist.", discount: 0 };
    }
    if (!coupon.isActive) {
      return { valid: false, message: "This coupon is no longer active.", discount: 0 };
    }
    if (coupon.expiresAt < new Date().toISOString()) {
      return { valid: false, message: "This coupon has expired.", discount: 0 };
    }
    if (coupon.usageCount >= coupon.usageLimit) {
      return { valid: false, message: "This coupon has reached its usage limit.", discount: 0 };
    }
    if (coupon.appliesTo.length > 0 && !coupon.appliesTo.includes(providerType)) {
      return {
        valid: false,
        message: `This coupon only applies to ${coupon.appliesTo.join(", ")} bookings.`,
        discount: 0,
      };
    }
    if (price < coupon.minOrderValue) {
      return {
        valid: false,
        message: `Requires a minimum order of EGP ${coupon.minOrderValue}.`,
        discount: 0,
      };
    }

    let discount =
      coupon.discountType === "percentage"
        ? Math.round((price * coupon.discountValue) / 100)
        : coupon.discountValue;

    if (coupon.maxDiscount !== undefined) {
      discount = Math.min(discount, coupon.maxDiscount);
    }
    // A discount can never take the amount payable below zero (§12).
    discount = Math.min(discount, price);

    return {
      valid: true,
      message: `Coupon applied — you saved EGP ${discount}.`,
      discount,
      coupon,
    };
  });
}

/** Active cashback for a booking, honouring the campaign cap. */
function cashbackFor(price: number, providerType: Provider["type"]): number {
  const now = new Date().toISOString();
  const campaign = db().campaigns.find(
    (c) =>
      c.status === "active" &&
      c.startsAt <= now &&
      c.endsAt >= now &&
      (c.appliesTo.length === 0 || c.appliesTo.includes(providerType)),
  );
  if (!campaign) return 0;

  return Math.min(
    Math.round((price * campaign.percentage) / 100),
    campaign.maxCashback,
  );
}

/** The online booking fee. Cash-at-clinic bookings carry no online fee (§9). */
export function bookingFeeFor(method: PaymentMethod): number {
  return method === "cash" ? 0 : BUSINESS.bookingFee;
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

export function getBookings(query: BookingQuery = {}): Promise<Paginated<Booking>> {
  return request(() => {
    releaseExpiredHolds();

    const {
      patientId,
      patientProfileId,
      providerId,
      branchId,
      status,
      when,
      q,
      page = 1,
      pageSize = 10,
    } = query;

    let results = db().bookings;

    if (patientId) results = results.filter((b) => b.patientId === patientId);
    if (patientProfileId)
      results = results.filter((b) => b.patientProfileId === patientProfileId);
    if (providerId) results = results.filter((b) => b.providerId === providerId);
    if (branchId) results = results.filter((b) => b.branchId === branchId);
    if (status) results = results.filter((b) => b.status === status);
    if (when === "upcoming") results = results.filter(isUpcoming);
    if (when === "past") results = results.filter((b) => !isUpcoming(b));

    if (q) {
      const term = q.toLowerCase();
      results = results.filter((b) =>
        [b.reference, b.providerName, b.serviceName, b.patientInfo.fullName]
          .join(" ")
          .toLowerCase()
          .includes(term),
      );
    }

    // Upcoming: soonest first. Everything else: most recent first.
    const sorted = [...results].sort((a, b) => {
      const key = (x: Booking) => `${x.date} ${x.time}`;
      return when === "upcoming"
        ? key(a).localeCompare(key(b))
        : key(b).localeCompare(key(a));
    });

    return paginate(sorted, page, pageSize);
  });
}

export function getBookingById(id: string): Promise<Booking> {
  return request(() => {
    const booking = db().bookings.find((b) => b.id === id);
    if (!booking) throw new ApiError("Booking not found", 404);
    return booking;
  });
}

// ---------------------------------------------------------------------------
// Creating a booking: hold → pay → confirm (§7, §9)
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

function notify(
  userId: string,
  kind: "booking_confirmed" | "booking_cancelled" | "booking_reminder" | "system",
  title: string,
  body: string,
  actionUrl = "/patient/bookings",
) {
  db().notifications.unshift({
    id: makeId("ntf"),
    userId,
    kind,
    // WhatsApp is the channel our users actually read (§11).
    channel: "whatsapp",
    title,
    body,
    isRead: false,
    createdAt: new Date().toISOString(),
    actionUrl,
  });
}

/**
 * Claims a place and holds it while the patient completes the booking.
 *
 * This is the only door into a booking. It resolves the whole of Appendix A:
 * capacity is checked against confirmed bookings *plus* live holds, exactly one
 * caller can take the last place, and the loser is handed a real next step
 * rather than an error.
 */
export function holdBooking(input: HoldBookingInput): Promise<Booking> {
  return request(() => {
    const state = db();

    // Sweep lapsed holds first, so an abandoned checkout never blocks a place.
    releaseExpiredHolds();

    const provider = state.providers.find((p) => p.id === input.providerId);
    if (!provider) throw new ApiError("Provider not found", 404);
    if (provider.status !== "approved") {
      throw new ApiError("This provider is not currently accepting bookings.", 409);
    }

    const branch = branchOf(provider, input.branchId);
    if (!branch || !branch.isActive) throw new ApiError("Branch not found", 404);

    const service = findService(provider, input.serviceId);
    if (!service) throw new ApiError("Service not found", 404);
    if (!branch.serviceIds.includes(service.id)) {
      throw new ApiError("This service is not offered at the selected branch.", 409);
    }

    const profile = state.patientProfiles.find(
      (p) => p.id === input.patientProfileId,
    );
    if (!profile || profile.accountId !== input.patientId) {
      throw new ApiError("Patient profile not found", 404);
    }

    // §3 — a booking is never finalized for a profile that fails the rules,
    // nor without the acknowledgement when one is required.
    const eligibility = evaluateEligibility(service, profile);
    if (!eligibility.eligible) {
      throw new EligibilityError(
        `${profile.fullName} is not eligible for ${service.name}.`,
        eligibility.violations,
      );
    }

    if (requiresAcknowledgement(service)) {
      const ack = input.acknowledgement;
      if (!ack?.preparationAccepted || !ack.eligibilityConfirmed) {
        throw new ApiError(
          "The preparation instructions and eligibility rules must be acknowledged before booking.",
          422,
        );
      }
    }

    const day = scheduleFor(branch, input.date);
    if (!day) {
      throw new ApiError("This branch is not open on the selected date.", 409);
    }

    // -- Capacity ----------------------------------------------------------
    const slot = slotsForBranch(provider, branch, input.date).find(
      (s) => s.time === input.time,
    );
    if (!slot) {
      throw new ApiError("That time is no longer offered. Please pick another.", 409);
    }

    const mode = schedulingModeFor(provider.type);

    if (slot.isFull) {
      const next = nextAvailableSlot(provider, branch, input.date, {
        skip: { date: input.date, time: input.time },
      });

      // A strict limit is physical — it is never exceeded, for anyone.
      if (slot.capacityType === "strict") {
        throw new CapacityError(
          "This session is now full. Here is the next available time.",
          "strict_full",
          { capacityType: "strict", nextSlot: next },
        );
      }

      // A comfort limit may be exceeded knowingly — but only with consent.
      if (!input.acceptOverCapacity) {
        const queueNumber = queuePositionFor(branch.id, input.date, input.time);
        throw new CapacityError(
          "This session is busy. You can still book — the wait will be longer.",
          "comfort_busy",
          {
            capacityType: "comfort",
            queueNumber,
            estimatedTime: estimatedTimeFor(day, queueNumber),
            nextSlot: next,
          },
        );
      }
    }

    // The same profile must not unintentionally hold two places at once.
    const conflict = state.bookings.find(
      (b) =>
        b.patientProfileId === input.patientProfileId &&
        b.date === input.date &&
        b.time === input.time &&
        (b.status === "confirmed" || isHold(b.status)),
    );
    if (conflict) {
      throw new ApiError(
        `${profile.fullName} already has a booking at this time.`,
        409,
      );
    }

    // -- Pricing (branch-specific) -----------------------------------------
    const price = branchPriceOf(branch, service);

    let discount = 0;
    let couponCode: string | undefined;
    if (input.couponCode) {
      const coupon = state.coupons.find(
        (c) => c.code.toUpperCase() === input.couponCode!.toUpperCase(),
      );
      if (coupon?.isActive && price >= coupon.minOrderValue) {
        discount =
          coupon.discountType === "percentage"
            ? Math.round((price * coupon.discountValue) / 100)
            : coupon.discountValue;
        if (coupon.maxDiscount !== undefined) {
          discount = Math.min(discount, coupon.maxDiscount);
        }
        discount = Math.min(discount, price);
        couponCode = coupon.code;
        coupon.usageCount += 1;
      }
    }

    // -- Queue position (§5) -----------------------------------------------
    const queueNumber =
      mode === "session"
        ? queuePositionFor(branch.id, input.date, input.time)
        : undefined;

    const fee = bookingFeeFor(input.paymentMethod);
    const now = new Date();

    const booking: Booking = {
      id: makeId("bkg"),
      reference: makeReference(),
      patientId: input.patientId,
      patientProfileId: profile.id,
      patientInfo: input.patientInfo,
      providerId: provider.id,
      providerType: provider.type,
      providerName: provider.name,
      providerPhoto: provider.photo,
      providerSpecialty: specialtyLabelOf(provider),
      serviceId: service.id,
      serviceName: service.name,
      branchId: branch.id,
      date: input.date,
      time: input.time,

      // A fee means the place is only held until it is paid; no fee means the
      // booking is confirmed outright.
      status: fee > 0 ? "held" : "confirmed",
      holdExpiresAt:
        fee > 0
          ? new Date(now.getTime() + BUSINESS.paymentHoldMinutes * 60_000).toISOString()
          : undefined,

      paymentMethod: input.paymentMethod,
      paymentStatus: "unpaid",
      price,
      discount,
      cashback: cashbackFor(price - discount, provider.type),
      total: price - discount,
      couponCode,
      bookingFee: fee,

      queueNumber,
      estimatedTime: queueNumber ? estimatedTimeFor(day, queueNumber) : undefined,
      capacityType: slot.capacityType,
      overCapacity: slot.isFull && slot.capacityType === "comfort",

      address: branch.address,
      createdAt: now.toISOString(),
      hasReview: false,
      acknowledgement: input.acknowledgement,
    };

    state.bookings.unshift(booking);

    // Only a confirmed booking counts towards the provider's totals — a hold
    // may still evaporate.
    if (booking.status === "confirmed") {
      provider.bookingCount += 1;
      notify(
        booking.patientId,
        "booking_confirmed",
        "Booking confirmed",
        confirmationBody(booking),
      );
    }

    return booking;
  });
}

function confirmationBody(booking: Booking): string {
  const who =
    booking.queueNumber !== undefined
      ? `You are number ${booking.queueNumber} in the queue, expected around ${booking.estimatedTime}.`
      : `Your slot is at ${booking.time}.`;

  return `Your booking for ${booking.patientInfo.fullName} with ${booking.providerName} on ${booking.date} is confirmed. ${who}`;
}

/**
 * Pays the booking fee and confirms the held place (§9).
 *
 * The outcomes are strict: payment succeeds and the booking is confirmed, or
 * the place is released and the held booking is discarded. There is no
 * half-paid, half-held state.
 */
export function payBooking(
  bookingId: string,
  outcome: "success" | "failure" = "success",
): Promise<Booking> {
  return request(() => {
    const state = db();
    const booking = state.bookings.find((b) => b.id === bookingId);
    if (!booking) throw new ApiError("Booking not found", 404);

    if (!isHold(booking.status)) {
      throw new ApiError("This booking is no longer awaiting payment.", 409);
    }

    // The window may have lapsed while the patient was on the payment page.
    if (booking.holdExpiresAt && booking.holdExpiresAt <= new Date().toISOString()) {
      state.bookings = state.bookings.filter((b) => b.id !== bookingId);
      throw new ApiError(
        "Your reservation window expired and the place was released. Please book again.",
        410,
      );
    }

    if (outcome === "failure") {
      // Payment failed → the place is released and the hold is discarded.
      state.bookings = state.bookings.filter((b) => b.id !== bookingId);
      throw new ApiError(
        "The payment did not go through, so the place was released. Please try booking again.",
        402,
      );
    }

    booking.status = "confirmed";
    booking.paymentStatus = "paid";
    booking.holdExpiresAt = undefined;

    const provider = state.providers.find((p) => p.id === booking.providerId);
    if (provider) provider.bookingCount += 1;

    notify(
      booking.patientId,
      "booking_confirmed",
      "Booking confirmed",
      confirmationBody(booking),
    );

    return booking;
  });
}

/** Moves a hold into `AWAITING_PAYMENT` as the patient enters the payment step. */
export function beginPayment(bookingId: string): Promise<Booking> {
  return request(() => {
    const booking = db().bookings.find((b) => b.id === bookingId);
    if (!booking) throw new ApiError("Booking not found", 404);

    if (booking.status !== "held") {
      throw new ApiError("This booking is not held.", 409);
    }

    booking.status = "awaiting_payment";
    return booking;
  });
}

/** Abandons a hold and returns the place to capacity immediately. */
export function releaseHold(bookingId: string): Promise<{ id: string }> {
  return request(() => {
    const state = db();
    const booking = state.bookings.find((b) => b.id === bookingId);

    if (booking && isHold(booking.status)) {
      state.bookings = state.bookings.filter((b) => b.id !== bookingId);
    }
    return { id: bookingId };
  });
}

// ---------------------------------------------------------------------------
// Cancellation, refunds & outcomes (§8)
// ---------------------------------------------------------------------------

/** Hours between now and the session — drives the free-cancellation window. */
function hoursUntil(booking: Booking): number {
  const at = new Date(`${booking.date}T${booking.time}:00.000Z`).getTime();
  return (at - Date.now()) / 3_600_000;
}

/** Whether cancelling now still qualifies for a full refund of the fee (§8). */
export function isWithinFreeCancellation(booking: Booking): boolean {
  return hoursUntil(booking) >= BUSINESS.freeCancellationHours;
}

export function cancelBooking(id: string, reason: string): Promise<Booking> {
  return request(() => {
    const state = db();
    const booking = state.bookings.find((b) => b.id === id);
    if (!booking) throw new ApiError("Booking not found", 404);

    // A live hold is simply discarded — there is nothing to cancel.
    if (isHold(booking.status)) {
      state.bookings = state.bookings.filter((b) => b.id !== id);
      return { ...booking, status: "cancelled_by_patient" as BookingStatus };
    }

    if (!canTransition(booking.status, "cancelled_by_patient")) {
      throw new ApiError(
        `A ${booking.status.replace(/_/g, " ")} booking cannot be cancelled.`,
        409,
      );
    }

    booking.status = "cancelled_by_patient";
    booking.cancelledAt = new Date().toISOString();
    booking.cancellationReason = reason;

    const feePaid = booking.paymentStatus === "paid" && booking.bookingFee > 0;

    if (feePaid && isWithinFreeCancellation(booking)) {
      // Cancelled inside the free window — refunded in full, automatically.
      booking.status = "refund_pending";
      booking.refundAmount = booking.bookingFee;
    } else if (feePaid) {
      // Cancelled very late — the fee is forfeit, per the stated policy. The
      // patient is told plainly rather than left wondering.
      booking.refundAmount = 0;
      booking.refundNote = `Cancelled less than ${BUSINESS.freeCancellationHours} hours before the appointment, so the booking fee is not refunded.`;
    }

    notify(
      booking.patientId,
      "booking_cancelled",
      "Booking cancelled",
      `Your booking with ${booking.providerName} on ${booking.date} has been cancelled.` +
        (booking.status === "refund_pending"
          ? ` Your booking fee will be returned within ${BUSINESS.refundWorkingDays} working days.`
          : ""),
    );

    return booking;
  });
}

/**
 * The provider (or operations) cancels a booking.
 *
 * Any fee already paid is refunded in full, automatically — the platform
 * absorbs the cost. A patient is never left out of pocket for something the
 * provider caused.
 */
export function cancelByProvider(id: string, reason: string): Promise<Booking> {
  return request(() => {
    const state = db();
    const booking = state.bookings.find((b) => b.id === id);
    if (!booking) throw new ApiError("Booking not found", 404);

    if (!canTransition(booking.status, "cancelled_by_provider")) {
      throw new ApiError(
        `A ${booking.status.replace(/_/g, " ")} booking cannot be cancelled.`,
        409,
      );
    }

    applyProviderCancellation(booking, reason);
    return booking;
  });
}

/** Shared by provider cancellation, session cancellation and hard suspension. */
export function applyProviderCancellation(booking: Booking, reason: string): void {
  booking.status = "cancelled_by_provider";
  booking.cancelledAt = new Date().toISOString();
  booking.cancellationReason = reason;

  // Whenever a fee was paid, it comes back in full — no window, no conditions.
  if (booking.paymentStatus === "paid" && booking.bookingFee > 0) {
    booking.status = "refund_pending";
    booking.refundAmount = booking.bookingFee;
  }

  notify(
    booking.patientId,
    "booking_cancelled",
    "Your appointment was cancelled",
    `${booking.providerName} had to cancel your appointment on ${booking.date}. ${reason} ` +
      (booking.refundAmount
        ? `Your booking fee is being refunded in full. `
        : "") +
      "You can rebook at a time that suits you.",
    `/booking`,
  );
}

/**
 * A provider cancels an entire session — a doctor who falls ill, say.
 *
 * Every affected booking is cancelled on the provider's behalf and refunded.
 * Patients are deliberately *not* moved to another session: that would overload
 * the next session and confuse people about their new time. Rebooking is always
 * the patient's choice.
 */
export function cancelSession(
  providerId: string,
  branchId: string,
  date: string,
  time: string,
  reason: string,
): Promise<{ cancelled: number }> {
  return request(() => {
    const state = db();

    const affected = state.bookings.filter(
      (b) =>
        b.providerId === providerId &&
        b.branchId === branchId &&
        b.date === date &&
        b.time === time &&
        (b.status === "confirmed" || isHold(b.status)),
    );

    for (const booking of affected) {
      if (isHold(booking.status)) {
        // Not yet a real booking — just let the place go.
        state.bookings = state.bookings.filter((b) => b.id !== booking.id);
        continue;
      }
      applyProviderCancellation(booking, reason);
    }

    return { cancelled: affected.length };
  });
}

/** Completes the refund and returns the money to the patient's method (§9). */
export function processRefund(id: string): Promise<Booking> {
  return request(() => {
    const booking = db().bookings.find((b) => b.id === id);
    if (!booking) throw new ApiError("Booking not found", 404);

    if (!canTransition(booking.status, "refunded")) {
      throw new ApiError("There is no refund pending on this booking.", 409);
    }

    booking.status = "refunded";
    booking.paymentStatus = "refunded";
    booking.refundedAt = new Date().toISOString();

    notify(
      booking.patientId,
      "system",
      "Refund completed",
      `Your booking fee for ${booking.providerName} has been refunded to your original payment method. ` +
        `Your bank may take up to ${BUSINESS.refundWorkingDays} working days to show it.`,
    );

    return booking;
  });
}

export function markCompleted(id: string): Promise<Booking> {
  return request(() => {
    const booking = db().bookings.find((b) => b.id === id);
    if (!booking) throw new ApiError("Booking not found", 404);

    if (!canTransition(booking.status, "completed")) {
      throw new ApiError("Only a confirmed booking can be completed.", 409);
    }

    booking.status = "completed";
    booking.completedAt = new Date().toISOString();
    // The visit fee is settled in cash at the clinic.
    booking.paymentStatus = "paid";

    return booking;
  });
}

/**
 * Records a missed visit (§8).
 *
 * A missed visit means strictly *the patient did not arrive*. Only provider
 * staff can record one, and only after the session has ended — this prevents the
 * record from being misused against a patient who is merely still waiting.
 */
export function markNoShow(id: string): Promise<Booking> {
  return request(() => {
    const booking = db().bookings.find((b) => b.id === id);
    if (!booking) throw new ApiError("Booking not found", 404);

    if (!canTransition(booking.status, "no_show")) {
      throw new ApiError("Only a confirmed booking can be marked as missed.", 409);
    }

    if (hoursUntil(booking) > 0) {
      throw new ApiError(
        "A missed visit can only be recorded after the session has ended.",
        409,
      );
    }

    booking.status = "no_show";
    booking.noShowAt = new Date().toISOString();
    return booking;
  });
}

/**
 * The patient arrived but left after a long wait (§8).
 *
 * This is emphatically not a missed visit. It counts against the provider's
 * waiting-time reputation, where the responsibility actually lies — turning our
 * most sensitive situation into a quality signal about the provider.
 */
export function reportLongWait(id: string): Promise<Booking> {
  return request(() => {
    const state = db();
    const booking = state.bookings.find((b) => b.id === id);
    if (!booking) throw new ApiError("Booking not found", 404);

    if (booking.status === "no_show") {
      throw new ApiError(
        "This visit is recorded as missed. Please contact support to correct it.",
        409,
      );
    }

    booking.longWaitReported = true;

    const provider = state.providers.find((p) => p.id === booking.providerId);
    if (provider) {
      // Feed the signal straight into the provider's waiting-time reputation.
      provider.waitingTimeMinutes = Math.round(
        provider.waitingTimeMinutes * 1.05 + 2,
      );
    }

    return booking;
  });
}

export function rescheduleBooking(
  id: string,
  date: string,
  time: string,
): Promise<Booking> {
  return request(() => {
    const state = db();
    releaseExpiredHolds();

    const booking = state.bookings.find((b) => b.id === id);
    if (!booking) throw new ApiError("Booking not found", 404);

    if (booking.status !== "confirmed" && !isHold(booking.status)) {
      throw new ApiError("Only a live booking can be rescheduled.", 409);
    }

    const provider = state.providers.find((p) => p.id === booking.providerId);
    if (!provider) throw new ApiError("Provider not found", 404);

    const branch = branchOf(provider, booking.branchId);
    if (!branch) throw new ApiError("Branch not found", 404);

    const day = scheduleFor(branch, date);
    const slot = slotsForBranch(provider, branch, date).find((s) => s.time === time);

    if (!day || !slot) {
      throw new ApiError("That time is not available. Please pick another.", 409);
    }

    // The new place must respect capacity exactly as a fresh booking would.
    if (slot.isFull && slot.capacityType === "strict") {
      throw new CapacityError(
        "That session is full. Please pick another time.",
        "strict_full",
        {
          capacityType: "strict",
          nextSlot: nextAvailableSlot(provider, branch, date),
        },
      );
    }

    booking.date = date;
    booking.time = time;

    if (schedulingModeFor(provider.type) === "session") {
      const queueNumber = queuePositionFor(branch.id, date, time);
      booking.queueNumber = queueNumber;
      booking.estimatedTime = estimatedTimeFor(day, queueNumber);
    }

    notify(
      booking.patientId,
      "booking_confirmed",
      "Booking rescheduled",
      `Your appointment with ${booking.providerName} is now on ${date} at ${time}.`,
    );

    return booking;
  });
}

/**
 * Provider-side status transitions, guarded by the state machine (§7).
 *
 * Anything not in `ALLOWED_TRANSITIONS` is rejected rather than silently
 * applied — the states are the contract.
 */
export function updateBookingStatus(
  id: string,
  status: BookingStatus,
  reason = "Cancelled by the provider",
): Promise<Booking> {
  switch (status) {
    case "completed":
      return markCompleted(id);
    case "no_show":
      return markNoShow(id);
    case "cancelled_by_provider":
      return cancelByProvider(id, reason);
    case "cancelled_by_patient":
      return cancelBooking(id, reason);
    case "refunded":
      return processRefund(id);
    default:
      return Promise.reject(
        new ApiError(`A booking cannot be moved to "${status}" directly.`, 409),
      );
  }
}

/** Kept for the cash-at-clinic path, which confirms without an online fee. */
export const createBooking = holdBooking;

export { isCancelled, isHold };
