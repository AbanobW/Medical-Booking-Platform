import type { Locale } from "@/i18n/config";
import { GOVERNORATES, SPECIALTIES, ALL_AREAS } from "@/lib/data/egypt";
import type { LocalizedText } from "@/lib/types";

export type { LocalizedText };

/**
 * Locale-aware names for the domain model.
 *
 * Every named entity carries a `nameAr` — specialties, governorates and areas
 * from the static lookup tables in `@/lib/data/egypt`; providers, insurance
 * plans, lab tests and scans from whatever the API returned — so translating a
 * name is a field pick, not a lookup. `named()` is the one place that pick
 * happens, regardless of where the pair came from.
 */

/** Anything in the dataset that ships both names. */
export interface Named {
  name: string;
  nameAr: string;
}

/** Picks the name for the locale, falling back to English if Arabic is blank. */
export function named(entity: Named | undefined | null, locale: Locale): string {
  if (!entity) return "";
  if (locale === "ar") return entity.nameAr || entity.name;
  return entity.name;
}

/**
 * Picks a bilingual free-text field (bio, description) written as `{ en, ar }`.
 * Falls back to English while Arabic copy is missing.
 *
 * Plain strings pass through untouched, so this is also safe on the fields that
 * stay monolingual — coupon and campaign descriptions an admin types at runtime.
 */
export function localized(
  text: LocalizedText | string | undefined | null,
  locale: Locale,
): string {
  if (!text) return "";
  if (typeof text === "string") return text;
  return (locale === "ar" ? text.ar : text.en) || text.en;
}

/**
 * The provider / service names denormalized onto a booking, as `Named` pairs.
 *
 * A booking card renders before any provider is fetched, so the booking carries
 * both languages itself. These just reshape those flat fields so `named()` can
 * take them:
 *
 *     named(bookingProvider(booking))   // "Dr. Nader Kamal" / "د. Nader Kamal"
 */
export function bookingProvider(booking: {
  providerName: string;
  providerNameAr: string;
}): Named {
  return { name: booking.providerName, nameAr: booking.providerNameAr };
}

export function bookingService(booking: {
  serviceName: string;
  serviceNameAr: string;
}): Named {
  return { name: booking.serviceName, nameAr: booking.serviceNameAr };
}

export function getGovernorateName(id: string, locale: Locale): string {
  return named(
    GOVERNORATES.find((g) => g.id === id),
    locale,
  );
}

export function getAreaName(id: string, locale: Locale): string {
  return named(
    ALL_AREAS.find((a) => a.id === id),
    locale,
  );
}

export function getSpecialtyName(id: string, locale: Locale): string {
  return named(
    SPECIALTIES.find((s) => s.id === id),
    locale,
  );
}

/**
 * Insurance plan names have no local lookup: `/v1/insurances` is a live list
 * (`@/lib/api/medpoint/insurance#getInsurancePlans`), not a static table, so
 * there is nothing here to look an id up against synchronously. A caller that
 * already fetched the list resolves a name with `named()` directly against the
 * plan it found, the same way any other `Named` entity is rendered.
 */
