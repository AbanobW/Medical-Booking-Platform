export const SITE = {
  name: "Vesita",
  url: "https://vesita.example.com",
  description:
    "Search, compare and book verified doctors, medical labs and radiology centers across Egypt. Instant confirmation, transparent pricing, and cashback on every visit.",
  supportPhone: "16123",
  supportEmail: "care@vesita.example.com",
  currency: "EGP",
} as const;

/**
 * Commercial inputs owned by the business, not by product.
 *
 * These are the placeholders the Business Logic document calls out under
 * "Decisions Owned by the Business". They live in one place so the business can
 * set them without a code hunt.
 */
export const BUSINESS = {
  /**
   * The online booking fee that confirms a booking (§9). The visit fee itself
   * is still paid in cash at the clinic.
   */
  bookingFee: 25,
  /** How long a place is held while the patient pays (§9). Working default. */
  paymentHoldMinutes: 10,
  /** Cancel more than this far ahead and the fee is refunded in full (§8). */
  freeCancellationHours: 24,
  /** How long the bank may take to return a refund — quoted honestly (§9). */
  refundWorkingDays: 5,
} as const;

/** Formats a number as Egyptian Pounds, e.g. `EGP 350`. */
export function formatEGP(amount: number): string {
  return new Intl.NumberFormat("en-EG", {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Compact currency for dashboard tiles, e.g. `EGP 1.2M`. */
export function formatEGPCompact(amount: number): string {
  return new Intl.NumberFormat("en-EG", {
    style: "currency",
    currency: "EGP",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}
