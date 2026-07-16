"use client";

import { useLocale } from "next-intl";
import { useMemo } from "react";

import { normalizeLocale, type Locale } from "@/i18n/config";
import * as F from "@/lib/i18n/format";
import * as D from "@/lib/i18n/domain";
import type { Named, LocalizedText } from "@/lib/i18n/domain";

/**
 * The active locale, normalized back to `"en"` / `"ar"`.
 *
 * `useLocale()` returns the full BCP-47 tag (`ar-EG-u-nu-latn`) — see
 * `INTL_LOCALES` — so never compare its result to `"ar"` directly.
 */
export function useAppLocale(): Locale {
  return normalizeLocale(useLocale());
}

/**
 * True when the UI is right-to-left.
 *
 * Reach for this instead of `useLocale() === "ar"` anywhere a *physical* prop
 * has to be mirrored by hand — a Sheet's `side`, a motion offset — i.e. the
 * places CSS logical properties can't reach.
 */
export function useIsRtl(): boolean {
  return useAppLocale() === "ar";
}

/**
 * Locale-bound formatters and domain names.
 *
 * The point of these hooks is that they hand back the *same names* the app
 * already uses, with the locale pre-applied:
 *
 *     const { formatDate, formatEGP } = useFormat();
 *     formatDate(booking.date)          // unchanged at the call site
 *
 * So converting a component is a one-line import swap plus one destructure —
 * not an edit to every call. `initialsOf` and `formatDelta` are re-exported
 * unchanged so a file can pull everything from one place.
 */
export function useFormat() {
  const locale = normalizeLocale(useLocale());

  return useMemo(
    () => ({
      locale,
      formatDate: (iso: string) => F.formatDate(iso, locale),
      formatDateShort: (iso: string) => F.formatDateShort(iso, locale),
      formatTime: (time: string) => F.formatTime(time, locale),
      relativeDay: (iso: string) => F.relativeDay(iso, locale),
      timeAgo: (iso: string) => F.timeAgo(iso, locale),
      formatDuration: (minutes: number) => F.formatDuration(minutes, locale),
      formatDelta: (value: number) => F.formatDelta(value, locale),
      // Nullable, like the functions they wrap: an unknown value prints as a
      // dash, so a call site passes `null` straight through.
      formatEGP: (amount: number | null | undefined) => F.formatEGP(amount, locale),
      formatEGPCompact: (amount: number | null | undefined) =>
        F.formatEGPCompact(amount, locale),
      formatNumber: (value: number | null | undefined) =>
        F.formatNumber(value, locale),
      initialsOf: F.initialsOf,
    }),
    [locale],
  );
}

/** Locale-bound domain names. Same call-site-preserving trick as `useFormat`. */
export function useDomain() {
  const locale = normalizeLocale(useLocale());

  return useMemo(
    () => ({
      locale,
      /** Name of any entity carrying `{ name, nameAr }` — provider, test, scan… */
      named: (entity: Named | undefined | null) => D.named(entity, locale),
      /** The provider name denormalized onto a booking. */
      bookingProviderName: (booking: {
        providerName: string;
        providerNameAr: string;
      }) => D.named(D.bookingProvider(booking), locale),
      /** The service name denormalized onto a booking. */
      bookingServiceName: (booking: {
        serviceName: string;
        serviceNameAr: string;
      }) => D.named(D.bookingService(booking), locale),
      /** A bilingual free-text field written as `{ en, ar }`. */
      localized: (text: LocalizedText | string | undefined | null) =>
        D.localized(text, locale),
      getGovernorateName: (id: string) => D.getGovernorateName(id, locale),
      getAreaName: (id: string) => D.getAreaName(id, locale),
      getSpecialtyName: (id: string) => D.getSpecialtyName(id, locale),
    }),
    [locale],
  );
}
