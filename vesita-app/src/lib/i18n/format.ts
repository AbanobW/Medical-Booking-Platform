import { INTL_LOCALES, type Locale } from "@/i18n/config";
import { now, toISODate } from "@/lib/time";

/**
 * Locale-aware presentation helpers — the bilingual replacement for
 * `@/lib/format` and the currency helpers in `@/lib/site`.
 *
 * These are pure functions taking an explicit locale. Components don't call
 * them directly: `useFormat()` (client) and `getFormat()` (server) bind the
 * locale once and hand back this same set of names, so a call site keeps
 * reading `formatDate(iso)` rather than threading a locale through by hand.
 */

const DAY_MS = 86_400_000;

function intl(locale: Locale): string {
  return INTL_LOCALES[locale];
}

/** `2026-07-13` → `Mon, 13 Jul 2026` / `الإثنين، ١٣ يوليو ٢٠٢٦` (Latin digits). */
export function formatDate(iso: string, locale: Locale): string {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString(
    intl(locale),
    {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    },
  );
}

/** `2026-07-13` → `13 Jul`. */
export function formatDateShort(iso: string, locale: Locale): string {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString(
    intl(locale),
    { day: "numeric", month: "short", timeZone: "UTC" },
  );
}

/** `14:30` → `2:30 PM` / `٢:٣٠ م`. */
export function formatTime(time: string, locale: Locale): string {
  const [h, m] = time.split(":").map(Number);
  const date = new Date(Date.UTC(2000, 0, 1, h, m));
  return date.toLocaleTimeString(intl(locale), {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  });
}

/**
 * Human-friendly day label relative to the app's "today".
 *
 * `Intl.RelativeTimeFormat` with `numeric: "auto"` produces "today" /
 * "tomorrow" / "yesterday" in English and اليوم / غدًا / أمس in Arabic without
 * us hand-maintaining either list. Anything further out falls back to a date.
 */
export function relativeDay(iso: string, locale: Locale): string {
  const date = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  const today = new Date(`${toISODate(now())}T00:00:00Z`);
  const days = Math.round((date.getTime() - today.getTime()) / DAY_MS);

  if (days >= -1 && days <= 1) {
    const label = new Intl.RelativeTimeFormat(intl(locale), {
      numeric: "auto",
    }).format(days, "day");
    // English yields lowercase ("today"); the UI uses these as labels.
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  return formatDateShort(iso, locale);
}

/** "3 days ago", "in 2 weeks" — for timestamps. */
export function timeAgo(isoTimestamp: string, locale: Locale): string {
  const then = new Date(isoTimestamp).getTime();
  const diff = then - now().getTime();
  const abs = Math.abs(diff);

  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 365 * DAY_MS],
    ["month", 30 * DAY_MS],
    ["week", 7 * DAY_MS],
    ["day", DAY_MS],
    ["hour", 3_600_000],
    ["minute", 60_000],
  ];

  const formatter = new Intl.RelativeTimeFormat(intl(locale), {
    numeric: "auto",
  });

  for (const [unit, ms] of units) {
    if (abs >= ms) {
      return formatter.format(Math.round(diff / ms), unit);
    }
  }

  return locale === "ar" ? "الآن" : "just now";
}

/** `45` → `45 min` / `٤٥ دقيقة`; `90` → `1h 30m` / `ساعة و٣٠ دقيقة`. */
export function formatDuration(minutes: number, locale: Locale): string {
  const n = (value: number) => formatNumber(value, locale);

  if (locale === "ar") {
    if (minutes < 60) return `${n(minutes)} دقيقة`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    // Arabic has a dual form: 1 → ساعة, 2 → ساعتان, 3+ → N ساعات.
    const hours = h === 1 ? "ساعة" : h === 2 ? "ساعتان" : `${n(h)} ساعات`;
    return m ? `${hours} و${n(m)} دقيقة` : hours;
  }

  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** Signed percentage for stat-card deltas: `12.4` → `+12.4%`. */
export function formatDelta(value: number, locale: Locale): string {
  return new Intl.NumberFormat(intl(locale), {
    style: "percent",
    signDisplay: "exceptZero",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value / 100);
}

/**
 * What an unknown value looks like.
 *
 * The API leaves a great deal unanswered — a provider has no rating, no photo
 * and often no attributable price. Every one of those used to arrive here as a
 * plausible number (`0`), and `formatEGP(0)` rendered "0 ج.م.", which told the
 * patient the visit was free. An unknown value is now `null` all the way down
 * and prints as a dash: the reader can tell "we don't know" from "it is zero".
 *
 * An em dash rather than a hyphen — it reads as "no value" in both scripts and
 * does not look like a minus sign next to a currency.
 */
export const DASH = "—";

/**
 * Formats a number as Egyptian Pounds, e.g. `EGP 350` / `‏350 ج.م.‏`.
 *
 * `null` is an unknown price, not a free one — see `DASH`.
 */
export function formatEGP(amount: number | null | undefined, locale: Locale): string {
  if (amount === null || amount === undefined) return DASH;
  return new Intl.NumberFormat(intl(locale), {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Compact currency for dashboard tiles, e.g. `EGP 1.2M`. */
export function formatEGPCompact(
  amount: number | null | undefined,
  locale: Locale,
): string {
  if (amount === null || amount === undefined) return DASH;
  return new Intl.NumberFormat(intl(locale), {
    style: "currency",
    currency: "EGP",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount);
}

export function formatNumber(value: number | null | undefined, locale: Locale): string {
  if (value === null || value === undefined) return DASH;
  return new Intl.NumberFormat(intl(locale)).format(value);
}

/** Any value the API did not answer, for a plain text slot. */
export function orDash(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return DASH;
  return String(value);
}

/**
 * Initials for an avatar fallback. Arabic has no case, and the honorifics
 * differ, so the prefix strip is locale-agnostic and covers both.
 */
export function initialsOf(name: string): string {
  const words = name
    .replace(/^(Dr\.?|Prof\.?|د\.|أ\.د\.|الدكتور|الأستاذ)\s*/i, "")
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
