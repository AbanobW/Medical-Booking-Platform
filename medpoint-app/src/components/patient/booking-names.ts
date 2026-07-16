"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";

import { useLabels } from "@/lib/i18n/use-labels";
import type { Booking } from "@/lib/types";

/**
 * The names to show on a booking card.
 *
 * A booking carries denormalized *English* names (`providerName`,
 * `serviceName`) — a receipt written at the moment it was made — and that
 * snapshot is now the whole story. This hook used to reach into the seeded
 * dataset for the provider and read its `nameAr`, which only worked because
 * every provider was already in the browser. With the data behind an API there
 * is no synchronous map to consult, and fetching per card to translate a label
 * would cost a request per row.
 *
 * So the receipt renders. Service names still translate where the app ships a
 * key for them; a provider's name renders as it was recorded.
 */
export interface BookingNames {
  provider: string;
  service: string;
  /** Doctor → specialty; lab / radiology → the provider type. */
  specialty: string;
}

export function useBookingNames(booking: Booking): BookingNames {
  const L = useLabels();
  const t = useTranslations("patient");

  return useMemo(() => {
    // Consultations and packages come from a fixed template list, so they have a
    // translation key. Anything else renders as recorded.
    const key = `serviceName.${booking.serviceName}`;
    const service = t.has(key) ? t(key) : booking.serviceName;

    return {
      provider: booking.providerName,
      service,
      specialty: L.providerType(booking.providerType),
    };
  }, [booking, L, t]);
}
