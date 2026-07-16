/**
 * Locale configuration.
 *
 * MedPoint is bilingual: English and Egyptian Arabic. The locale is a user
 * preference stored in a cookie — like the theme — rather than a URL segment.
 * The whole app is client-rendered against a localStorage-backed mock API, so
 * there is no per-locale URL to crawl and nothing to gain from `/[locale]/…`
 * routing; a cookie keeps all 40 existing routes untouched.
 */

export const LOCALES = ["en", "ar"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** Read by the server (`getRequestConfig`) and written by the language toggle. */
export const LOCALE_COOKIE = "medpoint_locale";

/** A year — the preference should outlive the session. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Writing direction per locale. Drives `<html dir>` and the logical CSS. */
export const DIRECTIONS: Record<Locale, "ltr" | "rtl"> = {
  en: "ltr",
  ar: "rtl",
};

/** What each language calls itself — never translated. */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  ar: "العربية",
};

/**
 * The BCP-47 tag handed to `Intl` — and to `next-intl` itself.
 *
 * Egypt uses Western digits in digital products (Vezeeta, Fawry, the banks), so
 * we pin the Latin numbering system rather than letting `ar-EG` default to
 * Arabic-Indic numerals.
 *
 * This tag is what `getRequestConfig` returns as the active locale, which means
 * `next-intl` uses it to build every `IntlMessageFormat` too. That matters: the
 * bare `#` inside an ICU plural is formatted by the message formatter, not by
 * our helpers, so a plain `"ar"` here would render "٣ تقييمات" next to an
 * "EGP 350" — Arabic-Indic in the plurals, Latin everywhere else. Pinning the
 * numbering system on the tag itself keeps the two in agreement.
 *
 * The cost is that `useLocale()` now returns this tag rather than `"ar"`, so
 * anything comparing against `"en"`/`"ar"` must go through `normalizeLocale`.
 */
export const INTL_LOCALES: Record<Locale, string> = {
  en: "en-GB",
  ar: "ar-EG-u-nu-latn",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && LOCALES.includes(value as Locale);
}

/**
 * Maps the BCP-47 tag `useLocale()` hands back (`ar-EG-u-nu-latn`) onto the
 * short locale the app keys everything off (`ar`).
 */
export function normalizeLocale(tag: string): Locale {
  return tag.split("-")[0] === "ar" ? "ar" : "en";
}

export function directionOf(locale: Locale): "ltr" | "rtl" {
  return DIRECTIONS[locale];
}
