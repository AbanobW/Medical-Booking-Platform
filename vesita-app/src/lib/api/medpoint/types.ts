/**
 * The MedPoint wire format, exactly as the API sends it.
 *
 * These are deliberately *not* the app's domain types. They are snake_case, they
 * send money as decimal strings ("449.00") and dates as full ISO timestamps even
 * when the field is a plain date. Keeping them separate means the wire format can
 * drift without leaking into `src/lib/types.ts` — `mappers.ts` is the one place
 * that has to change.
 *
 * Every shape here was verified against the live staging API, not inferred from
 * the Postman collection (which ships no example responses).
 */

/** Every MedPoint resource carries its class name and a hashed id. */
interface WireResource {
  /** "User", "Provider", "Booking", … */
  type: string;
  /**
   * A hashid, NOT a globally unique key.
   *
   * The backend encodes every model's row id with the same salt, so `Provider`
   * row 1, `Service` row 1 and `Booking` row 1 all come back as the *same*
   * string. An id is only meaningful together with its resource type — never
   * use one as a cross-resource key or a React list key on mixed collections.
   */
  id: string;
  created_at?: string;
  updated_at?: string;
  readable_created_at?: string;
  readable_updated_at?: string;
}

export interface WireCoupon extends WireResource {
  type: "Coupon";
  code: string;
  /** "fixed" | "percentage". */
  coupon_type?: string;
  /** Decimal string, e.g. "50.00". */
  value?: number | string;
  /** "global" — who the coupon applies to. Not an on/off switch. */
  scope?: string;
  /** `null` means unlimited. */
  max_uses?: number | null;
  max_uses_per_user?: number | null;
  used_count?: number;
  expires_at?: string | null;
}

export interface WireInsurance extends WireResource {
  type: "Insurance";
  /** One name only — no separate Arabic field on the wire. */
  plan_name: string;
  policy_number?: string | null;
}

export interface WireUser extends WireResource {
  type: "User";
  name: string;
  email: string;
  email_verified_at: string | null;
  phone: string | null;
  phone_verified_at: string | null;
  avatar_url: string | null;
  gender: "male" | "female" | null;
  /** Date of birth. The API calls it `birth`. */
  birth: string | null;
  status: "active" | "suspended" | "pending";
  auth_provider: string | null;
}

/**
 * The response every login path returns — `register`, `login`, `phone`, `google`.
 * The tokens sit *outside* any `data` envelope.
 *
 * `refresh_token` is now real on every path (it used to come back `""` on
 * register/phone/google) and it *rotates*: each one is single-use, so the new
 * value from every response must replace the stored one. `needs_phone` is `true`
 * until the account has a verified phone — gate anything requiring a number on it.
 */
export interface WireAuthSession {
  access_token: string;
  refresh_token: string | null;
  token_type?: string;
  expires_in?: number;
  /** First response for a freshly created account. */
  is_new_user?: boolean;
  /** `true` until the account has a *verified* phone number. */
  needs_phone?: boolean;
  user: WireUser;
}

export interface WirePatientProfile extends WireResource {
  type: "PatientProfile";
  full_name: string;
  /** `null` on a freshly auto-created SELF profile the user has not completed. */
  gender: "male" | "female" | null;
  /** `null` on a freshly auto-created SELF profile the user has not completed. */
  date_of_birth: string | null;
  relationship: "self" | "child" | "spouse" | "parent";
  phone: string | null;
  /** Moved onto the profile from the account; the account no longer carries it. */
  national_id?: string | null;
  /** No longer sent to create — the owner is always the authenticated account. */
  user_id?: string;
}

export interface WireProvider extends WireResource {
  type: "Provider";
  /** `doctor`, `lab`, or `radiology` on the wire. */
  provider_type: string;
  name: string;
  status: string;
  /**
   * Added since the provider was first mapped (re-probed 2026-07-16) — a real
   * dedicated field, where before the specialty was only ever glued into
   * `name` ("Dr. X — Cardiology"). Every provider on staging still has this
   * `null`, so `parseProviderName`'s split of `name` remains the load-bearing
   * path; this is read first and preferred once it's populated.
   */
  gender?: "male" | "female" | null;
  specialty?: string | null;
  subspecialty?: string | null;
  /** Decimal string or number; `null` until the provider has any ratings. */
  rating_avg?: number | string | null;
  /** A real `0` is a fact (no ratings yet), not an unknown — unlike `rating_avg`. */
  rating_count?: number | null;
  /** Doctors only in practice; null until Medical Syndicate registration is recorded. */
  syndicate_number?: string | null;
  /** Null until ops confirms the listing — see the FAQ's verification promise. */
  verified_at?: string | null;
}

export interface WireBranch extends WireResource {
  type: "Branch";
  provider_id?: string;
  /** Added since first mapped; `null` on every branch seen so far. */
  name?: string | null;
  governorate?: string;
  area?: string;
  address?: string;
  lat?: number | string;
  lng?: number | string;
  phones?: string[];
}

export interface WireService extends WireResource {
  type: "Service";
  branch_id?: string;
  name: string;
  category?: string;
  price?: number | string;
  prep_instructions?: string | null;
  eligibility_rules?: unknown[];
  home_collection?: boolean;
}

export interface WireSlot extends WireResource {
  type: "Slot";
  branch_id?: string;
  service_id?: string;
  start_datetime?: string;
  capacity?: number;
  booked_count?: number;
}

export interface WireDoctorSession extends WireResource {
  type: "DoctorSession";
  branch_id?: string;
  provider_id?: string;
  date?: string;
  start_time?: string;
  end_time?: string;
  max_tickets?: number;
  booked_count?: number;
  capacity_type?: string;
}

export interface WireBooking extends WireResource {
  type: "Booking";
  status: string;
  price_snapshot?: number | string;
  booking_fee?: number | string;
  payment_status?: string;
  queue_number?: number | null;
  source?: string;
}

export interface WirePayment extends WireResource {
  type: "Payment";
  booking_id?: string;
  amount?: number | string;
  purpose?: string;
  gateway?: string;
  status?: string;
}

export interface WireReview extends WireResource {
  type: "Review";
  booking_id?: string;
  ratings?: unknown[];
  comment?: string | null;
}

/** A type-scoped cache key — hashids collide across resource types. */
export function wireKey(type: string, id: string): string {
  return `${type}:${id}`;
}
