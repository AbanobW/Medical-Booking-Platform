"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";

import type {
  BookingStatus,
  CapacityType,
  Gender,
  PaymentMethod,
  PaymentStatus,
  Relationship,
  Role,
  ProviderRole,
  SortOption,
  SuspensionType,
  UserStatus,
} from "@/lib/types";

/**
 * Translated replacements for the `*_LABELS` maps in `@/lib/types`.
 *
 * Those constants stay where they are — they're the canonical English wording
 * and are still used by non-React code and the seed. In the UI, reach for these
 * instead, so a status badge reads the same way in both languages.
 *
 *     const L = useLabels();
 *     L.bookingStatus(booking.status)      // "Confirmed" / "مؤكد"
 *
 * `bookingStatusProvider` exists for the same reason the constant does: to a
 * provider, "cancelled by you" means something different than it does to a
 * patient.
 */
export function useLabels() {
  const t = useTranslations("domain");

  return useMemo(
    () => ({
      role: (role: Role) => t(`role.${role}`),
      providerType: (type: ProviderRole) => t(`providerType.${type}`),
      relationship: (r: Relationship) => t(`relationship.${r}`),
      gender: (g: Gender) => t(`gender.${g}`),
      bookingStatus: (s: BookingStatus) => t(`bookingStatus.${s}`),
      bookingStatusProvider: (s: BookingStatus) =>
        t(`bookingStatusProvider.${s}`),
      paymentMethod: (m: PaymentMethod) => t(`paymentMethod.${m}`),
      paymentStatus: (s: PaymentStatus) => t(`paymentStatus.${s}`),
      userStatus: (s: UserStatus) => t(`userStatus.${s}`),
      suspension: (s: SuspensionType) => t(`suspension.${s}`),
      capacity: (c: CapacityType) => t(`capacity.${c}`),
      sort: (s: SortOption) => t(`sort.${s}`),
      /**
       * Chronic conditions are stored on the profile as their English string —
       * that string is the identifier, so it must not be translated at rest.
       * Translate only at render.
       */
      condition: (condition: string) => t(`condition.${condition}`),
      /**
       * A lab test / scan grouping key ("Hematology", "CT Scan"). Also an
       * identifier at rest — it's the value the catalogue filters on.
       */
      serviceCategory: (category: string) =>
        t.has(`serviceCategory.${category}`)
          ? t(`serviceCategory.${category}`)
          : category,
      /**
       * A doctor's subspecialty. Stored on the provider as its English string,
       * with no `nameAr` in the dataset, so it is translated at render only.
       */
      subSpecialty: (value: string) =>
        t.has(`subSpecialty.${value}`) ? t(`subSpecialty.${value}`) : value,
      /**
       * Credentials, all closed sets stored in English on the provider —
       * "Consultant", "MRCP (UK)", "French", "ISO 15189". Same rule as above:
       * the stored string is the identifier, translated only at render.
       */
      doctorTitle: (value: string) =>
        t.has(`doctorTitle.${value}`) ? t(`doctorTitle.${value}`) : value,
      degree: (value: string) =>
        t.has(`degree.${value}`) ? t(`degree.${value}`) : value,
      language: (value: string) =>
        t.has(`language.${value}`) ? t(`language.${value}`) : value,
      accreditation: (value: string) =>
        t.has(`accreditation.${value}`) ? t(`accreditation.${value}`) : value,
    }),
    [t],
  );
}
