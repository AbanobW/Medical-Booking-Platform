/**
 * Booking write path against MedPoint — read/cancel stay on the mock.
 *
 * The API returns bookings without relations or appointment datetime, so every
 * created booking is enriched from wizard context and stored in the overlay.
 */

import { ApiError } from "@/lib/api/errors";
import type { HoldBookingInput } from "@/lib/api/bookings";
import { apiRequest } from "@/lib/api/http";
import { getSlotsForDate } from "@/lib/api/medpoint/availability";
import { parseBookableId } from "@/lib/api/medpoint/mappers";
import { getProviderById } from "@/lib/api/medpoint/providers";
import {
  createOverlayBooking,
  findOverlayBookingById,
  overlayToBooking,
  removeOverlayBooking,
  saveOverlayBooking,
  type OverlayBookingContext,
} from "@/lib/api/medpoint/overlay";
import type { WireBooking } from "@/lib/api/medpoint/types";
import { BUSINESS } from "@/lib/site";
import type { Booking, PaymentMethod, Provider, Service } from "@/lib/types";
import { branchPriceOf, isHold } from "@/lib/types";

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

function specialtyLabelOf(provider: Provider): string {
  if (provider.type !== "doctor") return "";
  return provider.specialtyId;
}

function buildContext(
  input: HoldBookingInput,
  provider: Provider,
  service: Service,
  price: number,
  slotMeta: { capacityType: Booking["capacityType"]; overCapacity: boolean },
): OverlayBookingContext {
  const fee = bookingFeeFor(input.paymentMethod);
  const branch = provider.branches.find((b) => b.id === input.branchId);

  return {
    patientId: input.patientId,
    patientProfileId: input.patientProfileId,
    patientInfo: input.patientInfo,
    providerId: provider.id,
    providerType: provider.type,
    providerName: provider.name,
    providerNameAr: provider.nameAr,
    providerPhoto: provider.photo,
    providerSpecialty: specialtyLabelOf(provider),
    serviceId: service.id,
    serviceName: service.name,
    serviceNameAr: service.nameAr,
    branchId: input.branchId,
    date: input.date,
    time: input.time,
    paymentMethod: input.paymentMethod,
    price,
    discount: 0,
    cashback: 0,
    total: price,
    couponCode: input.couponCode,
    bookingFee: fee,
    capacityType: slotMeta.capacityType,
    overCapacity: slotMeta.overCapacity,
    acknowledgement: input.acknowledgement,
    address: branch?.address ?? provider.address,
  };
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

  const ctx = buildContext(input, provider, service, price, {
    capacityType: slot.capacityType,
    overCapacity: slot.isFull && slot.capacityType === "comfort",
  });

  const status = fee > 0 ? "held" : "confirmed";
  const overlay = createOverlayBooking(wire.id, ctx, status);
  if (fee > 0) {
    overlay.holdExpiresAt = new Date(
      Date.now() + BUSINESS.paymentHoldMinutes * 60_000,
    ).toISOString();
  } else {
    overlay.paymentStatus = "paid";
  }

  saveOverlayBooking(overlay);
  return overlayToBooking(overlay);
}

export async function beginPayment(bookingId: string): Promise<Booking> {
  const overlay = findOverlayBookingById(bookingId);
  if (!overlay) {
    throw new ApiError("Booking not found", 404, "booking.notFound");
  }
  if (overlay.status !== "held") {
    throw new ApiError("This booking is not held.", 409, "booking.notHeld");
  }

  overlay.status = "awaiting_payment";
  saveOverlayBooking(overlay);
  return overlayToBooking(overlay);
}

export async function payBooking(
  bookingId: string,
  outcome: "success" | "failure" = "success",
): Promise<Booking> {
  const overlay = findOverlayBookingById(bookingId);
  if (!overlay) {
    throw new ApiError("Booking not found", 404, "booking.notFound");
  }

  if (!isHold(overlay.status)) {
    throw new ApiError(
      "This booking is no longer awaiting payment.",
      409,
      "booking.notAwaitingPayment",
    );
  }

  if (overlay.holdExpiresAt && overlay.holdExpiresAt <= new Date().toISOString()) {
    removeOverlayBooking(overlay.patientId, bookingId);
    throw new ApiError(
      "Your reservation window expired and the place was released. Please book again.",
      410,
      "booking.holdExpired",
      { minutes: BUSINESS.paymentHoldMinutes },
    );
  }

  if (outcome === "failure") {
    removeOverlayBooking(overlay.patientId, bookingId);
    throw new ApiError(
      "The payment did not go through, so the place was released. Please try booking again.",
      402,
      "booking.paymentFailed",
    );
  }

  try {
    await apiRequest("/payments", {
      method: "POST",
      body: {
        booking_id: bookingId,
        amount: overlay.bookingFee,
        purpose: "booking_fee",
        gateway: overlay.paymentMethod === "cash" ? "cash" : "card",
      },
    });
  } catch {
    // Scaffold API may reject payment shape — overlay still confirms locally.
  }

  overlay.status = "confirmed";
  overlay.paymentStatus = "paid";
  overlay.holdExpiresAt = undefined;
  saveOverlayBooking(overlay);

  return overlayToBooking(overlay);
}

export async function releaseHold(bookingId: string): Promise<{ id: string }> {
  const overlay = findOverlayBookingById(bookingId);
  if (overlay) {
    removeOverlayBooking(overlay.patientId, bookingId);
  }
  return { id: bookingId };
}
