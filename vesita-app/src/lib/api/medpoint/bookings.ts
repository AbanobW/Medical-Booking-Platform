/**
 * Booking writes against MedPoint.
 *
 * Creation is real: `POST /v1/bookings` accepts the profile, branch, bookable
 * and price, and the server records it. Everything after creation is not.
 *
 * This module used to keep a localStorage "overlay" — the wizard's context
 * (provider, service, date, time, status) written to the browser because
 * `GET /v1/bookings` returns rows with no relations and no appointment
 * datetime. The overlay is gone with the rest of the client-side data: it was
 * per-browser, so a booking vanished on another device, and `payBooking` used to
 * swallow a failed `/v1/payments` call and mark the booking confirmed-and-paid
 * locally regardless — telling a patient they had paid when the API had
 * refused.
 *
 * So: create is live, and the lifecycle beyond it reports that the server cannot
 * carry it yet. See BACKEND-GAPS.md.
 */

import { ApiError } from "@/lib/api/errors";
import type { HoldBookingInput } from "@/lib/api/bookings";
import { apiRequest } from "@/lib/api/http";
import { getSlotsForDate } from "@/lib/api/medpoint/availability";
import { parseBookableId } from "@/lib/api/medpoint/mappers";
import { getProviderById } from "@/lib/api/medpoint/providers";
import type { WireBooking } from "@/lib/api/medpoint/types";
import { BUSINESS } from "@/lib/site";
import type { Booking, PaymentMethod, Provider, Service } from "@/lib/types";
import { branchPriceOf } from "@/lib/types";

function bookingFeeFor(method: PaymentMethod): number {
  return method === "cash" ? 0 : BUSINESS.bookingFee;
}

function findService(provider: Provider, serviceId: string): Service | undefined {
  if (provider.type === "doctor") {
    return provider.consultationTypes.find((s) => s.id === serviceId);
  }
  if (provider.type === "lab") {
    return (
      provider.tests.find((s) => s.id === serviceId) ??
      provider.packages.find((s) => s.id === serviceId)
    );
  }
  return (
    provider.scans.find((s) => s.id === serviceId) ??
    provider.packages.find((s) => s.id === serviceId)
  );
}

/** 501: the server has no way to carry this step, which is not the caller's fault. */
function unsupported(what: string): never {
  throw new ApiError(
    `${what} is not available yet — the API returns bookings without a service, ` +
      "a provider or an appointment time, so a booking cannot be tracked after it is made.",
    501,
    "booking.notSupported",
  );
}

export async function holdBooking(input: HoldBookingInput): Promise<Booking> {
  const provider = await getProviderById(input.providerId);
  if (provider.status !== "approved") {
    throw new ApiError(
      "This provider is not currently accepting bookings.",
      409,
      "booking.providerNotAccepting",
    );
  }

  const branch = provider.branches.find((b) => b.id === input.branchId);
  if (!branch?.isActive) {
    throw new ApiError("Branch not found", 404, "branch.notFound");
  }

  const service = findService(provider, input.serviceId);
  if (!service) {
    throw new ApiError("Service not found", 404, "service.notFound");
  }

  const slots = await getSlotsForDate(input.providerId, input.date, input.branchId);
  const normalizedTime = input.time.slice(0, 5);
  const slot = slots.find((s) => s.time.slice(0, 5) === normalizedTime);
  if (!slot) {
    throw new ApiError(
      "That time is no longer offered. Please pick another.",
      409,
      "booking.slotNoLongerOffered",
    );
  }

  const { bookableType, bookableId } = parseBookableId(slot.id);
  const price = branchPriceOf(branch, service);
  const fee = bookingFeeFor(input.paymentMethod);

  const wire = await apiRequest<WireBooking>("/bookings", {
    method: "POST",
    body: {
      patient_profile_id: input.patientProfileId,
      branch_id: input.branchId,
      bookable_type: bookableType,
      bookable_id: bookableId,
      price_snapshot: price,
      booking_fee: fee,
      source: "web",
    },
  });

  // The server records the booking but echoes almost nothing back, so the
  // confirmation is assembled from what we just sent and it accepted. This is a
  // receipt for one request, not a stored record — it cannot be read back later,
  // which is why every function below refuses rather than pretending.
  return {
    id: wire.id,
    reference: wire.reference ?? wire.id,
    patientId: input.patientId,
    patientProfileId: input.patientProfileId,
    patientInfo: input.patientInfo,
    providerId: provider.id,
    providerType: provider.type,
    providerName: provider.name,
    providerNameAr: provider.nameAr,
    providerPhoto: provider.photo,
    providerSpecialty: provider.type === "doctor" ? provider.specialtyId : null,
    serviceId: service.id,
    serviceName: service.name,
    serviceNameAr: service.nameAr,
    branchId: input.branchId,
    address: branch.address ?? provider.address,
    date: input.date,
    time: input.time,
    paymentMethod: input.paymentMethod,
    price,
    discount: 0,
    cashback: 0,
    total: price,
    couponCode: input.couponCode,
    bookingFee: fee,
    capacityType: slot.capacityType,
    overCapacity: slot.isFull && slot.capacityType === "comfort",
    acknowledgement: input.acknowledgement,
    // A fee means the place is only held until it is paid for.
    status: fee > 0 ? "held" : "confirmed",
    paymentStatus: fee > 0 ? "unpaid" : "paid",
    holdExpiresAt:
      fee > 0
        ? new Date(Date.now() + BUSINESS.paymentHoldMinutes * 60_000).toISOString()
        : undefined,
    createdAt: wire.created_at ?? new Date().toISOString(),
    updatedAt: wire.updated_at ?? new Date().toISOString(),
    hasReview: false,
  } as Booking;
}

export async function beginPayment(_bookingId: string): Promise<Booking> {
  void _bookingId;
  return unsupported("Paying for a booking");
}

export async function payBooking(
  _bookingId: string,
  _outcome: "success" | "failure" = "success",
): Promise<Booking> {
  void _bookingId;
  void _outcome;
  return unsupported("Paying for a booking");
}

export async function releaseHold(_bookingId: string): Promise<{ id: string }> {
  void _bookingId;
  return unsupported("Releasing a hold");
}
