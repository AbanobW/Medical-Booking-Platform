"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";

import { findService } from "@/lib/api/bookings";
import { DB } from "@/lib/data/seed";
import { useDomain } from "@/lib/i18n/use-format";
import { useLabels } from "@/lib/i18n/use-labels";
import type { Booking, Provider } from "@/lib/types";

/**
 * A booking carries denormalized *English* names (`providerName`,
 * `serviceName`) — a receipt written at the moment it was made. They are the
 * only thing the record knows, so to render a booking in Arabic we have to go
 * back to the entity the booking points at, where `nameAr` lives.
 *
 * The lookup is a synchronous map over the deterministic dataset, so a card
 * still renders in one pass (no per-card fetch, no hydration mismatch), and the
 * English snapshot stays the fallback if the provider ever disappears.
 */
const PROVIDERS_BY_ID: Map<string, Provider> = new Map(
  DB.providers.map((provider) => [provider.id, provider]),
);

export interface BookingNames {
  provider: string;
  service: string;
  /** Doctor → specialty; lab / radiology → the provider type. */
  specialty: string;
}

export function useBookingNames(booking: Booking): BookingNames {
  const { named, getSpecialtyName } = useDomain();
  const L = useLabels();
  const t = useTranslations("patient");

  return useMemo(() => {
    const provider = PROVIDERS_BY_ID.get(booking.providerId);
    const service = provider
      ? findService(provider, booking.serviceId)
      : undefined;

    // Lab tests and radiology scans ship `nameAr`. Consultations and packages
    // don't — they come from a fixed template list, so they are translated by
    // name here instead.
    let serviceName = booking.serviceName;
    if (service && "nameAr" in service) {
      serviceName = named(service);
    } else {
      const key = `serviceName.${booking.serviceName}`;
      if (t.has(key)) serviceName = t(key);
    }

    return {
      provider: provider ? named(provider) : booking.providerName,
      service: serviceName,
      specialty:
        provider?.type === "doctor"
          ? getSpecialtyName(provider.specialtyId)
          : L.providerType(booking.providerType),
    };
  }, [booking, named, getSpecialtyName, L, t]);
}
