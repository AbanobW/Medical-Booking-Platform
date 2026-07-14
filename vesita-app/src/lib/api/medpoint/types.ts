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

/** `POST /v1/auth/login` — note the tokens sit *outside* any `data` envelope. */
export interface WireAuthSession {
  access_token: string;
  refresh_token: string | null;
  token_type?: string;
  expires_in?: number;
  user: WireUser;
}

export interface WirePatientProfile extends WireResource {
  type: "PatientProfile";
  full_name: string;
  gender: "male" | "female";
  date_of_birth: string;
  relationship: "self" | "child" | "spouse" | "parent";
  phone: string | null;
  user_id?: string;
}

export interface WireProvider extends WireResource {
  type: "Provider";
  /** `doctor`, `lab`, or `radiology` on the wire. */
  provider_type: string;
  name: string;
  status: string;
}

export interface WireBranch extends WireResource {
  type: "Branch";
  provider_id?: string;
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
