import { now, toISODate } from "@/lib/time";

/** Presentation helpers shared across the app. */

const DAY_MS = 86_400_000;

export function initialsOf(name: string): string {
  const words = name
    .replace(/^(Dr\.?|Prof\.?)\s+/i, "")
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/** `2026-07-13` → `Mon, 13 Jul 2026`. */
export function formatDate(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** `2026-07-13` → `13 Jul`. */
export function formatDateShort(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/** `14:30` → `2:30 PM`. */
export function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

/**
 * Human-friendly day label relative to the app's "today".
 * Returns "Today" / "Tomorrow" / "Yesterday", else a short date.
 */
export function relativeDay(iso: string): string {
  const date = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  const today = new Date(`${toISODate(now())}T00:00:00Z`);
  const days = Math.round((date.getTime() - today.getTime()) / DAY_MS);

  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  return formatDateShort(iso);
}

/** "3 days ago", "in 2 weeks" — for timestamps. */
export function timeAgo(isoTimestamp: string): string {
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

  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  for (const [unit, ms] of units) {
    if (abs >= ms) {
      return formatter.format(Math.round(diff / ms), unit);
    }
  }
  return "just now";
}

/** `45` → `45 min`, `90` → `1h 30m`. */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** Signed percentage for stat-card deltas: `12.4` → `+12.4%`. */
export function formatDelta(value: number): string {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}
