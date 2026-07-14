import type { Locale } from "@/i18n/config";
import {
  GOVERNORATES,
  INSURANCE_PLANS,
  SPECIALTIES,
  ALL_AREAS,
} from "@/lib/data/egypt";
import type { LocalizedText } from "@/lib/types";

export type { LocalizedText };

/**
 * Locale-aware names for the domain model.
 *
 * The dataset already carries `nameAr` on every named entity — providers,
 * specialties, governorates, areas, insurance plans, lab tests and scans — so
 * translating a name is a field pick, not a lookup. `named()` is the one place
 * that pick happens.
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

export function getInsurancePlanName(id: string, locale: Locale): string {
  return named(
    INSURANCE_PLANS.find((p) => p.id === id),
    locale,
  );
}
