# MedPoint API contract — endpoints, wire shapes, and the gap map

The reference you open when you are about to write or change a mapper.

Sources: `.claude/MedPoint.postman_collection.json` for request shapes (it ships **no
example responses** — that is why every response below was verified by probing live
staging on 2026-07-14), and `vesita-app/src/lib/api/` for what the app actually does with
them.

Read `.claude/INTEGRATION.md` first for the current per-domain status and the registry of
decisions the code embodies around what the API can't do.

---

## 1. Endpoint catalogue

Base: `https://medpoint.intrazero.org/v1` — but **the browser never calls it directly**.
`http.ts:113` builds `${apiBaseUrl()}/v1<path>`, and `next.config.ts`'s `rewrites()` sends
`/api/medpoint/:path*` upstream server-to-server (no CORS headers exist on any MedPoint
response, so a direct browser call would be silently discarded). See INTEGRATION.md.

MedPoint is Apiato-flavoured Laravel, so most of this is generated 5-verb CRUD scaffolding.
**Twenty folders, ~120 requests, and the app uses about twenty of them.** Marking the rest
`unused` plainly is the point of this table — do not go hunting for meaning in `/v1/audits`.

### Auth — `medpoint/auth.ts`

| Endpoint | Status | Body |
|---|---|---|
| `POST /v1/auth/login` | **used** | `{ email, password }` → `WireAuthSession` |
| `POST /v1/auth/register` | **used, ✅ fixed** | `{ full_name, email, password, phone }` → `201` + a token pair. It used to 500 *after* creating the row, so the frontend fell back to logging in with the credentials just submitted; that fallback is deleted (`medpoint/auth.ts` has no `catch` around `register` any more) — a failure now propagates as a genuine 422/5xx. |
| `POST /v1/logout` | **used** | — |
| `POST /v1/auth/refresh-token` | **broken (500)** | — · `RefreshToken::createFrom()` type-hints the base `Request`. `refreshSession()` is written (`medpoint/auth.ts`) but has zero call sites — see INTEGRATION.md's decision #5. |
| `POST /v1/auth/forgot-password` | **used** | `{ email }` — step 1 of password reset |
| `POST /v1/auth/verify-otp` | **used** | `{ email, otp }` — step 2 |
| `POST /v1/auth/reset-password` | **used** | `{ email, otp, password, password_confirmation }` — step 3 |
| `POST /v1/email/verification-notification` | **used** | — · resend the verification link |
| `POST /v1/auth/google` | unused | `{ id_token }` — no Google client configured |
| `POST /v1/auth/phone` | unused | `{ id_token }` |
| `POST /v1/auth/admin/reset-password` · `…/confirm` | unused | admin-only |
| `POST /v1/email/verify/:id/:hash` | unused | link target |

The OTP endpoints serve **password reset only**. Signup returns a token pair and the
account is immediately usable — there is no post-signup OTP screen in the app at all any
more (`/verify` was mock-only and is deleted, not merely bypassed).

### Users & profile — `medpoint/profile.ts`

| Endpoint | Status | Notes |
|---|---|---|
| `GET /v1/profile` | **used** | The signed-in user. Returns `gender` and `birth`… |
| `PUT /v1/profile` | **used** | …but **accepts neither**. Only `name` and `phone` round-trip — `gender`/`birth` go via `PATCH /v1/users/:id`, so the account needs both writers (`session.ts#updateProfile` sequences them). No longer lossy: both fields are genuinely writable, just not through this endpoint. |
| `POST /v1/profile/avatar` · `DELETE /v1/profile/avatar` | **used** | |
| `PATCH /v1/users/:id/password` | **used** | `{ current_password, new_password, new_password_confirmation }`; a wrong password is a 422 on `current_password` |
| `PATCH /v1/users/:id` | **used** | `{ name, gender, birth, current_password, new_password, new_password_confirmation }`. The app sends only `gender` and `birth`: `name` is left to `PUT /v1/profile` so each field has one writer, and the password trio belongs to the endpoint above, which reports a wrong password as a 422 a form can attach to. |
| `GET /v1/users` · `GET|DELETE /v1/users/:id` | unused | admin surface |
| `/v1/users/:id/roles` · `/v1/users/:id/permissions` (GET/POST/PUT/DELETE) | unused | Full RBAC exists on the server; **no role reaches `WireUser`**, so the app can't use it — see INTEGRATION.md's decision #6 (`roleOf()` hard-codes `"patient"`). |

### Roles & permissions

`GET|POST|DELETE /v1/roles`, `/v1/roles/:id`, `/v1/roles/:id/permissions` (GET/POST/PUT/DELETE),
`GET /v1/permissions`, `GET /v1/permissions/:id` — **all unused.** MedPoint ships complete
RBAC that the patient MVP cannot reach, because a new signup gets no role and the user
payload carries none.

### Discovery — `medpoint/providers.ts`

| Endpoint | Status | Notes |
|---|---|---|
| `GET /v1/providers` | **used, degraded** | Every page walked (`medpoint/cache.ts#fetchAllPages`). **Every filter param is silently ignored** — `provider_type=`, `search=`, `q=`, `filter=` all return the same unfiltered page. `page` is the only param that works: **neither `limit` nor `per_page` changes the page size** — the server pins every page at 10 rows regardless, so this is 1 page for 8-9 providers today but will be many more as the dataset grows. |
| `GET /v1/providers/:id` | **used** | |
| `GET /v1/branches` | **used, but not joinable to a provider by id** | Joined to a provider **only** via the real `provider_id` field on the wire (`medpoint/providers.ts#buildCatalog`) — a branch with no `provider_id` is left unattached. Matching by shared/adjacent id is explicitly disallowed in that function's own comment: ids collide across resources (§1.3), so id-matching pairs row N with row N regardless of what they actually are. |
| `GET /v1/services` | **used, but not attributable to a branch at all** | 🔴 **No `branch_id` on read.** `POST /v1/services` accepts `branch_id`; `GET` never returns it. Every live service today is therefore unattached — no provider has a price, and nothing is bookable. This is the single biggest open gap; see BACKEND-GAPS.md §1.2/§1.7. |
| `POST /v1/providers` | unused | `{ type, name, status }` |
| `POST /v1/branches` | unused | `{ provider_id, governorate, area, address, lat, lng, phones[] }` |
| `POST /v1/services` | unused | `{ branch_id, name, category, price, prep_instructions, eligibility_rules[], home_collection }` — **note the spec-shaped fields the GET does not surface** |
| `PATCH`/`DELETE` on all three | unused | ops-managed (§2 Phase 1) |

### Availability — `medpoint/availability.ts`

| Endpoint | Status | Notes |
|---|---|---|
| `GET /v1/slots` | **used, but not attributable** | Every page walked; 1044 rows across 105 ten-row pages as of the last count (`medpoint/cache.ts`'s `MAX_PAGES = 40` cap logs a warning if a list this large is ever hit before its total is reached). No `branch_id` on read — same gap as services. |
| `GET /v1/doctor-sessions` | **used, but not attributable** | Same. Doctor sessions (queue-number model); no `branch_id` either. |
| `POST /v1/slots` | unused | `{ branch_id, service_id, start_datetime, capacity }` |
| `POST /v1/doctor-sessions` | unused | `{ branch_id, provider_id, date, start_time, end_time, max_tickets, capacity_type }` |
| `PATCH`/`DELETE`/`GET :id` on both | unused | |

**There is no endpoint to query availability for a provider over a date range**, and no
hold/expiry concept anywhere. That is why availability is "fetch everything, filter here" —
and today "filter here" finds nothing to attach to any given provider regardless.

### Booking & money — `medpoint/bookings.ts`

| Endpoint | Status | Notes |
|---|---|---|
| `POST /v1/bookings` | **used** | `{ patient_profile_id, branch_id, bookable_type, bookable_id, price_snapshot, booking_fee, source }` — **the request shape is right**; the response is the problem |
| `GET /v1/bookings` · `GET /v1/bookings/:id` | **unusable** | Returns no FKs and no datetime. §3 below. The keystone gap. `getBookings` always returns an empty page; `getBookingById` throws. |
| `POST /v1/payments` | **not called** | `{ booking_id, amount, purpose, gateway }` — its accepted shape has never been confirmed. `beginPayment`/`payBooking` (`medpoint/bookings.ts`) throw a `501` rather than call it, because even success couldn't be reconciled against an unreadable booking. Consequence: only a `cash` (fee-free) booking can complete today. |
| `PATCH`/`DELETE /v1/bookings/:id` | unused | cancel/reschedule throw a `501` — no mechanism handles them |
| `/v1/refunds` (5 verbs) | unused | `{ booking_id, payment_id, amount, reason }` — §8/§9 refunds not wired |
| `/v1/payments` GET/PATCH/DELETE | unused | |

### Patient profiles — `medpoint/profiles.ts`

✅ **Fixed.** The route lived at `/v1/patient-profiles`, was moved to `/v1/me/profiles`
(API-CHANGES.md §3), and 404'd entirely for a period after the move before the redirect
landed. As of this writing it works end to end.

| Endpoint | Status | Notes |
|---|---|---|
| `POST /v1/me/profiles` | **used** | `{ full_name, gender, date_of_birth, relationship, national_id, phone }` — no `user_id`: the owner is always the authenticated account |
| `GET /v1/me/profiles/:id` | **used** | 404s (not 403) if the profile belongs to another account |
| `PATCH` · `DELETE /v1/me/profiles/:id` | **used** | Delete is soft; the account's own SELF profile can't be deleted (422) |
| `GET /v1/me/profiles` | **used** | Lists every profile the account owns, including the auto-created SELF profile |

### Admin — `medpoint/admin.ts`

| Endpoint | Status | Notes |
|---|---|---|
| `GET /v1/users` | **used, admin-gated** | 403 for a non-admin token, surfaced rather than swallowed. No filters (same pattern as `/v1/providers`) |
| `GET /v1/providers` (admin listing) | **used, admin-gated** | Same endpoint discovery reads; admin screens reuse it with a wider status filter applied client-side |
| `GET /v1/coupons` | **used** | Lists real coupons (5 on staging) |
| `DELETE /v1/coupons/:id` | **used** | |
| `POST`/`PATCH /v1/coupons` | unused | The wire coupon (`code`, `coupon_type`, `value`, `scope`, `max_uses`, `used_count`, `expires_at`) has no description, minimum-order or applies-to column — the admin form collects fields this endpoint cannot store |
| `/v1/campaigns`, commission settings | **no endpoint** | Not part of the collection at all |

### Unused entirely

`/v1/reviews`, `/v1/notifications`, `/v1/insurances`, `/v1/wallets`, `/v1/audits` — each a
full 5-verb CRUD folder. Reviews and notifications answer `200` with zero rows but take no
`provider_id`/`patient_id` filter and their wire shape has never been observed populated, so
nothing is decoded from a guess (`engagement.ts`). Insurances/wallets are later-phase per
the business doc (§12, §14); audits is scaffolding. **There is no `/v1/favorites` resource
at all**, which is why `/patient/favorites` — a built, working screen — has nothing to talk
to; `getFavorites`/`getFavoriteIds` return empty and `toggleFavorite` throws.

---

## 2. Wire DTOs

The payloads as Laravel actually sends them. Verbatim from
`vesita-app/src/lib/api/medpoint/types.ts`.

Three conventions bite you every time: **snake_case**, **money as decimal strings**
(`"449.00"`), and **plain dates as full timestamps** (`"2026-08-01T00:00:00.000000Z"`).

```ts
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
  /** Added since first mapped (re-probed 2026-07-16); null on every provider so far. */
  gender?: "male" | "female" | null;
  specialty?: string | null;
  subspecialty?: string | null;
  rating_avg?: number | string | null;
  /** A real 0 (no ratings yet), unlike a null average. */
  rating_count?: number | null;
  syndicate_number?: string | null;
  verified_at?: string | null;
}

export interface WireBranch extends WireResource {
  type: "Branch";
  provider_id?: string;
  /** Added since first mapped; null on every branch so far. */
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
```

Plus `WirePayment` (`booking_id`, `amount`, `purpose`, `gateway`, `status`) and
`WireReview` (`booking_id`, `ratings[]`, `comment`).

### Envelopes

```
success   { "data": {...}, "meta": { "pagination": {...} } }
failure   { "message": "...", "errors": { "email": ["..."] } }
```

`apiRequest<T>` unwraps `data` (`http.ts:188-195`); `apiList<T>` keeps
`meta.pagination` (`WirePagination = { total, count, per_page, current_page, total_pages }`).
**The auth tokens sit outside the `data` envelope** — an easy thing to get wrong.

---

## 3. Domain contracts

What the UI consumes. **This is the contract the backend must eventually satisfy.** All
from `vesita-app/src/lib/types.ts` — quoted, not paraphrased.

### `Booking` — `types.ts:699-777`

```ts
export interface Booking {
  id: string;
  reference: string;
  /** The owning account. */
  patientId: string;
  /**
   * The patient the booking is *for* (§1). Medical and booking history attach
   * here, not to the account.
   */
  patientProfileId: string;
  patientInfo: PatientInfo;
  providerId: string;
  providerType: ProviderRole;
  /** Denormalized for list rendering — a real API would embed or expand these. */
  providerName: string;
  providerNameAr: string;
  providerPhoto: string;
  providerSpecialty: string;
  serviceId: string;
  serviceName: string;
  serviceNameAr: string;
  branchId?: string;
  date: string;
  time: string;
  status: BookingStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  price: number;
  discount: number;
  cashback: number;
  total: number;
  couponCode?: string;
  address: string;
  createdAt: string;
  cancelledAt?: string;
  cancellationReason?: string;
  hasReview: boolean;

  // -- Scheduling (§5) ------------------------------------------------------
  /** Doctors run sessions: the patient gets a queue number, not an exact minute. */
  queueNumber?: number;
  /** The estimated time to be seen, derived from the queue position. */
  estimatedTime?: string;
  capacityType: CapacityType;
  /** True when this place was taken beyond a comfort limit, with consent. */
  overCapacity: boolean;

  // -- Payment hold (§9) ---------------------------------------------------
  /** The online booking fee. The visit fee itself is paid in cash at the clinic. */
  bookingFee: number;
  /** When an active hold lapses. The place is released at this moment. */
  holdExpiresAt?: string;

  // -- Refunds (§8, §9) ----------------------------------------------------
  refundAmount?: number;
  refundedAt?: string;
  /** Why no refund was due — shown to the patient so the outcome is never silent. */
  refundNote?: LocalizedText;

  // -- Outcome -------------------------------------------------------------
  completedAt?: string;
  noShowAt?: string;
  /**
   * The patient arrived but left after a long wait (§8).
   *
   * This is deliberately NOT a missed visit — it counts against the provider's
   * waiting-time reputation, where the responsibility actually lies.
   */
  longWaitReported?: boolean;

  /** Present when the service required preparation / eligibility sign-off. */
  acknowledgement?: Acknowledgement;
}
```

### `BookingStatus` + `ALLOWED_TRANSITIONS` — `types.ts:577-644`

The 9-state machine from §7. **Never assign a status directly — use `canTransition`.**

```ts
export type BookingStatus =
  | "held"
  | "awaiting_payment"
  | "confirmed"
  | "completed"
  | "no_show"
  | "cancelled_by_patient"
  | "cancelled_by_provider"
  | "refund_pending"
  | "refunded";

/** The only transitions the platform permits. Anything else is a bug. */
export const ALLOWED_TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  held: ["awaiting_payment", "confirmed"],
  awaiting_payment: ["confirmed"],
  confirmed: [
    "completed",
    "no_show",
    "cancelled_by_patient",
    "cancelled_by_provider",
  ],
  completed: [],
  no_show: [],
  cancelled_by_patient: ["refund_pending"],
  cancelled_by_provider: ["refund_pending"],
  refund_pending: ["refunded"],
  refunded: [],
};

/** A place is being claimed — the hold counts against capacity while it lives. */
export function isHold(status: BookingStatus): boolean {
  return status === "held" || status === "awaiting_payment";
}

/** Confirmed bookings and live holds both consume a place. */
export function consumesCapacity(status: BookingStatus): boolean {
  return status === "confirmed" || isHold(status);
}
```

The wire sends a bare `status: string` and the app has never seen a value outside this set
in the wild — but the API validates nothing, so treat any incoming status as untrusted.
(Staging returns `no_show`, `walk_in` as a `source`, etc.)

### `Provider` — `types.ts:210-282`

A discriminated union on `.type`.

```ts
export interface ProviderBase {
  id: string;
  type: ProviderRole;
  slug: string;
  name: string;
  nameAr: string;
  photo: string;
  coverImage: string;
  bio: LocalizedText;
  rating: number;
  reviewCount: number;
  /** Entry price — consultation fee, or cheapest test/scan. */
  price: number;
  governorateId: string;
  areaId: string;
  address: string;
  location: GeoPoint;
  phone: string;
  status: ProviderStatus;
  isFeatured: boolean;
  /** Total lifetime bookings — drives the "Most Booked" sort. */
  bookingCount: number;
  waitingTimeMinutes: number;
  joinedAt: string;
  schedule: DaySchedule[];
  branches: Branch[];
  /** Insurance plans accepted here. Empty until the insurance phase (§14). */
  acceptedInsurancePlanIds: string[];
  /** Present only while `status === "suspended"`. */
  suspension?: Suspension;
}

export interface Doctor extends ProviderBase {
  type: "doctor";
  title: string;
  specialtyId: string;
  subSpecialties: string[];
  gender: Gender;
  yearsOfExperience: number;
  degrees: string[];
  languages: string[];
  clinicName: string;
  consultationTypes: ConsultationType[];
}

export interface Lab extends ProviderBase {
  type: "lab";
  accreditation: string[];
  homeSampleCollection: boolean;
  tests: LabTest[];
  packages: ServicePackage[];
}

export interface RadiologyCenter extends ProviderBase {
  type: "radiology";
  accreditation: string[];
  scans: RadiologyScan[];
  packages: ServicePackage[];
}

export type Provider = Doctor | Lab | RadiologyCenter;
```

Against a `WireProvider` of `{ type, id, provider_type, name, status }`. That is the whole
of §1.5 in `BACKEND-GAPS.md` in one glance.

### `TimeSlot` — `types.ts:537-557`

```ts
export interface TimeSlot {
  id: string;
  /** `YYYY-MM-DD`. */
  date: string;
  /** `HH:mm`. */
  time: string;
  isBooked: boolean;
  isAvailable: boolean;
  capacity: number;
  capacityType: CapacityType;
  /** Confirmed bookings plus active holds. */
  taken: number;
  /** `capacity - taken`, floored at zero. */
  remaining: number;
  /**
   * True when capacity is used up. Under a comfort limit the place is still
   * bookable — the patient is told the session is busy and offered the next
   * place with a longer expected wait. Under a strict limit it is not.
   */
  isFull: boolean;
}
```

`CapacityType = "comfort" | "strict"` (`:509`). **The wire says `"soft"`.** See §5 below.

### `PatientProfile` — `types.ts:99-115`

```ts
export interface PatientProfile {
  id: string;
  /** The owning account. Profiles never cross this boundary. */
  accountId: string;
  relationship: Relationship;
  fullName: string;
  /** Screened against a service's gender rules before booking. */
  gender: Gender;
  /** Screened against a service's age rules before booking. */
  dateOfBirth: string;
  phone?: string;
  nationalId?: string;
  createdAt: string;
}
```

### `Service` — `types.ts:463-467`

```ts
export type Service =
  | ConsultationType   // id, kind:"consultation", name, nameAr, description, price, durationMinutes, isActive
  | LabTest            // + category, resultTimeHours, fastingRequired, preparation?, eligibility?
  | RadiologyScan      // + durationMinutes, contrastRequired, preparation?, eligibility?
  | ServicePackage;    // + includes[], originalPrice
```

`preparation?: PreparationInstructions` and `eligibility?: EligibilityRules` are the §3
acknowledgement gate — both now genuinely **optional** on the domain type. **Neither is
fabricated when absent** — see §5. `requiresAcknowledgement`/`hasPreparation` in
`types.ts` already treat `undefined` as "nothing to show", not "nothing to worry about".

---

## 4. The gap map

Domain field the UI needs → wire field that supplies it → what fills the hole today.

### 🔑 `Booking` — the keystone

`WireBooking` supplies **six fields**. The domain `Booking` needs forty. Nothing that
identifies *who*, *where*, *what* or *when*.

There is no overlay any more reconstructing the rest from wizard context — that
localStorage cache was per-browser and is deleted along with the mock. What's left:
`holdBooking` (`medpoint/bookings.ts`) assembles a one-time confirmation from the request
it just sent and the server accepted, and returns it — but this is a **receipt for that
one call**, not a stored record. Nothing else can read a booking back:

| Domain field | Wire | Status |
|---|---|---|
| `status` | `status` | direct, on the receipt only |
| `price` / `total` | `price_snapshot` | `parseMoney`, receipt only |
| `bookingFee` | `booking_fee` | `parseMoney`, receipt only |
| `paymentStatus` | `payment_status` | direct, receipt only |
| `queueNumber` | `queue_number` | direct, receipt only |
| `id` | `id` | direct (but see the hashid collision above) |
| `date`, `time`, `providerId`, `serviceId`, `branchId`, `patientProfileId` | ✗ | known only at creation time, from the request itself — **unrecoverable on any later read** |
| `providerName`/`NameAr`/`Photo`/`Specialty`, `serviceName`/`serviceNameAr` | ✗ | same — assembled once from the `Provider`/`Service` already in hand when `holdBooking` ran |
| `patientInfo`, `address`, `capacityType`, `overCapacity` | ✗ | same |
| `holdExpiresAt` | ✗ | client-side timer, receipt only, nothing server-side enforces it |
| `reference` | ✗ | the wire `id` itself — no separate reference field exists |
| `discount`, `cashback`, `couponCode` | ✗ | always `0`/undefined — coupons cannot be validated against a booking (see `validateCoupon` below) |
| `refund*`, `completedAt`, `noShowAt`, `longWaitReported`, `hasReview` | ✗ | not modelled at all — `getBookings` always returns an empty page, and every lifecycle function (`cancelBooking`, `processRefund`, `markCompleted`, `markNoShow`, `rescheduleBooking`, …) throws a `501` |

The full staging payload, identical on list and detail:

```json
{ "type": "Booking", "id": "…", "status": "no_show", "price_snapshot": "121.00",
  "booking_fee": "0.00", "payment_status": "unpaid", "queue_number": null,
  "source": "walk_in", "created_at": "…", "updated_at": "…" }
```

`?include=provider|service|branch|slot` is accepted (200) but changes nothing, and
`meta.include` is always `[]`.

**"Dr. Hala Mansour — Cardiology, Tue 16 Jul, 10:00" is not derivable from that response.**
That single sentence is why `/patient/bookings`, the patient dashboard, cancel and
reschedule are all empty-state/refuse — not degraded, genuinely empty, because there is no
fallback dataset behind them any more.

### `Provider`

| Domain field | Wire | Status |
|---|---|---|
| `id`, `name`, `type`, `status` | `id`, `name`, `provider_type`, `status` | direct |
| `slug` | ✗ | `slugify(name)` |
| `photo` / `coverImage` / `bio` | ✗ | **`null`** — no generated placeholder any more; the UI renders nothing (or falls back to initials) rather than a fabricated avatar |
| `governorateId` / `areaId` / `address` / `location` / `phone` | via `WireBranch` | joined client-side through the real `provider_id`/`branch_id` fields (not id-matching — see the hashid warning above); **`null` on a fuzzy-match miss**, never a default location |
| `price` | via `WireService` | `min(services.price)` **where a service can be attributed to this provider's branch — which today is none of them** (§1.2/§1.7 in BACKEND-GAPS.md), so `price` is `null` for every live provider |
| `rating` | `rating_avg` | `parseNullableNumber` — real field since 2026-07-16 (BACKEND-GAPS.md §1.5), still `null` on every provider on staging |
| `reviewCount` | `rating_count` | direct — a real `0` (known: no ratings yet) is kept distinct from `null` (unknown) |
| `bookingCount`, `waitingTimeMinutes` | ✗ | **`null`** — no analytics endpoint exists |
| `isFeatured` | ✗ | `false` (a real default — "not featured" is a fact, not a gap) |
| `schedule`, `acceptedInsurancePlanIds` | ✗ | empty array |
| `verifiedAt` | `verified_at` | direct — real field since 2026-07-16, still `null` on every provider |
| Doctor: `specialtyId` | `specialty`, else parsed out of `name` | `specialty` is preferred when non-null via `specialtyIdFromLabel`; every provider still has it null, so `parseProviderName`'s split of `name` remains the load-bearing path. `null` if neither resolves to a specialty this app recognises (never `"general"` as a silent default — see BACKEND-GAPS.md §1.5 for the bug this used to be) |
| Doctor: `gender` | `gender` | direct — real field since 2026-07-16, still `null` on every doctor |
| Doctor: `subSpecialties` | `subspecialty` | `[subspecialty]` if present, else `[]` — the wire sends one value, not a list |
| Doctor: `syndicateNumber` | `syndicate_number` | direct — real field since 2026-07-16, still `null` on every doctor; backs the FAQ's Medical Syndicate verification claim once populated |
| Doctor: `yearsOfExperience` | ✗ | **`null`** |
| Doctor: `clinicName` | ✗ | falls back to the branch name, or `null` |
| Doctor: `title` | ✗ | `"Dr."` — this one *is* a real constant, not a gap; every doctor genuinely carries the title |
| Doctor: `degrees` / `languages` | ✗ | empty array |
| Lab: `homeSampleCollection` | `home_collection` on services | `services.some(...)` — vacuously `false` today since no service attributes to this provider |
| Lab/Radiology: `accreditation`, `packages` | ✗ | empty array |

Consequence: filter-by-specialty and filter-by-gender now correctly exclude everything
they can't confirm (`null !== filterValue`), rather than the previous version's
constants matching every doctor. That's more correct, but the practical result is the
same: the filters can't usefully narrow anything, because the underlying field is unknown
for every provider — `gender` and `specialty` both being real, dedicated fields now doesn't
change that until they're actually populated.

### `Service`

| Domain field | Wire | Status |
|---|---|---|
| `id`, `name`, `price`, `category` | direct | `parseMoney` for price; `category` is `null` if absent |
| `nameAr` | ✗ | falls back to `name` (English shown to Arabic readers — a real, acknowledged gap, not fixable client-side) |
| `description` | ✗ | **`null`** |
| **`preparation`** | `prep_instructions` — a free-text string, not the structured shape the domain wants | Mapped only when non-empty: the text becomes the arrival instruction, nothing else is claimed. `undefined` when absent — never a synthesized "no fasting required, no restrictions" block |
| **`eligibility`** | `eligibility_rules` — **absent from the payload entirely, shape never observed** | `undefined`, unconditionally. Guessing a shape from an array the API has never actually sent would be worse than declaring it unknown |
| `durationMinutes` / `resultTimeHours` / `fastingRequired` / `contrastRequired` | ✗ | **`null`** |

⚠️ The §3 gate depends on `preparation` and `eligibility`, and **the data is not on the
wire.** Probed: `GET /v1/services` returns `"prep_instructions": null` and omits
`eligibility_rules` from the payload entirely. What survives of §3 today: gender and
age screening run for real off the `PatientProfile` (both persist); pregnancy and
excluded-condition rules are declared per-service *when present* and are shown +
acknowledged, never auto-checked, because there is no profile column to check them
against. See BACKEND-GAPS.md §1.7 for why that split is a deliberate scope decision, not
an oversight.

```json
{ "type": "Service", "id": "W6V1Y2Pn83Q7mDEK", "name": "Initial Consultation",
  "category": "consultation", "price": "449.00", "prep_instructions": null,
  "home_collection": false, … }
```

The fields are declared on `WireService` (`medpoint/types.ts:92-93`) and `POST /v1/services`
accepts them, so the schema is right — but no mapper change can restore the gate. It needs
a backend fix: populate both on read, and add `chronic_conditions` / `is_pregnant` to the
patient profile so there is something to screen against.

### `PatientProfile`

| Domain field | Wire | Filled by |
|---|---|---|
| `id`, `fullName`, `gender`, `relationship` | direct | |
| `dateOfBirth` | `date_of_birth` | `toISODateOnly` — **note the user calls it `birth`, the profile calls it `date_of_birth`** |
| `phone` | `phone` | `toLocalPhone` |
| `accountId` | `user_id` | checked, 404s on mismatch (`profiles.ts:23-26`) |
| `nationalId` | `national_id` | direct; optional, 14 digits |

`bloodType`, `chronicConditions`, `isPregnant` and `insurance` are **gone** from the domain
model — the API has no column for any of them, and the forms no longer collect what cannot
be stored. Eligibility screening now runs on `gender` and `dateOfBirth` alone; a service's
pregnancy and excluded-condition rules are still declared, displayed and acknowledged (§3),
they are simply not auto-checked. See `eligibility.ts`.

### `TimeSlot`

Two wire types collapse into one domain type. Live slot ids are **prefixed** so the
booking call can tell them apart again.

| Domain | from `WireSlot` (lab/radiology) | from `WireDoctorSession` (doctor) |
|---|---|---|
| `id` | `` `s:${id}` `` | `` `d:${id}` `` |
| `date` / `time` | split out of `start_datetime` | `date` + `start_time` |
| `capacity` | `capacity` | `max_tickets` |
| `taken` | `booked_count` | `booked_count` |
| `capacityType` | **hard-coded `"strict"`** | `capacity_type` (`"soft"` → `"comfort"`) |

`remaining`, `isFull`, `isAvailable`, `isBooked` are all derived from `capacity - taken`.

---

## 5. Conversion rules

Everything in `medpoint/mappers.ts`. The one file that knows MedPoint's field names —
if the wire format drifts, this is the only file that changes.

| Function | Line | Transform |
|---|---|---|
| `toISODateOnly` | `:42` | `"2026-08-01T00:00:00.000000Z"` → `"2026-08-01"` |
| `parseMoney` | `:48` | `"449.00"` → `449`; `null`/NaN → `0` (the one place `0` is a real fallback, not an unknown-value marker — a genuinely absent price is handled by the *caller* returning `null`, not by this function) |
| `parseNullableNumber` | `:60` | Same string-or-number parsing as `parseMoney`, but `null`/`undefined` stay `null` — for fields where absence means unknown, not zero (`rating_avg`) |
| `toLocalPhone` | `:66` | `+20…` or `0020…` → `0…`; `null` → `""` |
| `toE164Phone` | `:74` | `0…` → `+20…`; already-`+` passes through |
| `roleOf` | `:82` | ⚠️ takes no argument, returns `"patient"` unconditionally. See decision #6 in INTEGRATION.md |
| `genderOf` | `:90` | shared by `toUser` and `toProvider` — `"male"`/`"female"` pass through, anything else → `undefined` |
| `toUser` | `:94` | `birth` → `dateOfBirth`; **`avatar_url` is `null` if the account has none — no generated identicon** |
| `toPatientProfile` | `:116` | **`null` `gender`/`date_of_birth`/`national_id` pass straight through as `null`** — no default; the auto-created SELF profile may genuinely have neither yet |
| `governorateIdOf` / `areaIdOf` | `:141` / `:151` | fuzzy string match against the known governorate/area list; **`null` on a miss** — no longer defaults to `"cairo"`/`"nasr-city"` |
| `specialtyIdFromLabel` | `:190` | free-text label → a known specialty id; **`null` on no match** — used to return the literal string `"general"`, which resolved to nothing and rendered as the invented label "General Practice" (BACKEND-GAPS.md §1.5) |
| `parseProviderName` | `:213` | splits `"Dr. X — Cardiology"` into a display name and a specialty id via `specialtyIdFromLabel`; `null` specialty if there's no dash or the tail doesn't match |
| `toCoord` | `:237` | string-or-number lat/lng → `number \| null`; **`null` unless both coordinates are usable — never a Cairo fallback** |
| `toBranch` | `:243` | prefers a real `name` field (added 2026-07-16, still null on every branch) over `area`/`address`/`id`; `openingHours` is always `null` (no such field on the wire; it used to read `"09:00 – 21:00"`) |
| `toPreparation` | `:276` | `prep_instructions` (free text) → the arrival-instruction line of a `PreparationInstructions`; `undefined` when the text is empty — never a synthesized "no restrictions" block |
| `toEligibility` | `:297` | **always `undefined`** — `eligibility_rules` has never been observed populated on the wire, so nothing is guessed from its shape |
| `wireServiceToConsultation` / `Lab` / `Test` / `Scan` | `:302`/`:315`/`:332` | `price`/`description`/`category`/`durationMinutes`/etc. are `null` where the wire has nothing, never a plausible constant (`30`, `24`, `"General"`) |
| `baseProviderFields` | `:365` | `rating` from `rating_avg` (`parseNullableNumber`), `reviewCount` direct from `rating_count`, `verifiedAt` direct from `verified_at` — all three added 2026-07-16, all still null/0 on staging; `photo`/`bio`/`price`/`waitingTimeMinutes` are still `null`, nothing on the wire for any of them |
| `toProvider` | `:398` | discriminates on `provider_type`; doctor branch prefers the dedicated `specialty`/`gender`/`subspecialty`/`syndicate_number` fields when populated, falling back to `parseProviderName`'s split of `name` for specialty (the load-bearing path today, since `specialty` is still null everywhere); `price` is `Math.min` over attributable services **with a `> 0` guard**, so a provider with zero attributable services (every live provider today) gets `null`, not `0` |
| `capacityTypeOf` | `:480` | `"soft"` (or anything except the literal `"strict"`) → `"comfort"` — used for doctor sessions |
| `slotToTimeSlot` | `:520` | prefixes `s:`; hard-codes `capacityType: "strict"` for lab/radiology slots (an assumption per §5 of the business doc, not something the wire states) |
| `sessionToTimeSlot` | `:536` | prefixes `d:`; capacity type via `capacityTypeOf(wire.capacity_type)` |
| `parseBookableId` | `:550` | ⚠️ **the reverse** — strips the prefix back into `{ bookableType: "Slot" \| "DoctorSession", bookableId }` for the `POST /bookings` body |

### The phone round-trip matters

The API **stores E.164** (`+201234567890`); the app **validates and displays the local
Egyptian form** (`01234567890`). Without `toLocalPhone` on the way in, the API's own saved
number fails the app's own validation — the user opens their profile and is told their
phone number is invalid.

### The slot-id prefix matters

`SLOT_ID_PREFIX = "s:"` / `SESSION_ID_PREFIX = "d:"` (`:355-356`) exist because
`POST /v1/bookings` needs a polymorphic `bookable_type` + `bookable_id`, and by the time
`holdBooking` runs it has only a `TimeSlot.id` in hand. The prefix is how a lab slot is
told apart from a doctor session. **Do not strip or normalize slot ids anywhere between
availability and booking** — `parseBookableId` silently falls back to `"Slot"` for an
unprefixed id, which would book the wrong thing.

---

## 6. Error model

`http.ts` throws `ApiError` (now defined in `src/lib/api/errors.ts`, the sole survivor of
the deleted `client.ts`), carrying a stable `code` that `useApiError()`, `errors.json` and
every toast in the app read the same way regardless of which function raised it — a real
`4xx`/`5xx` from MedPoint, or a domain function refusing outright with a `501` because no
endpoint exists for what was asked.

Laravel sends **no machine-readable error code**, so one is derived from the HTTP status
(`http.ts:60-68`):

```ts
function codeForStatus(status: number, hasMessage: boolean): string | undefined {
  if (status === 401) return "api.unauthenticated";
  if (status === 403) return "api.forbidden";
  if (status === 429) return "api.rateLimited";
  if (status >= 500) return "api.serverError";
  if (status === 0) return "api.networkError";
  if (status === 404 && !hasMessage) return "api.notFound";
  return hasMessage ? undefined : "api.requestFailed";
}
```

**Returning `undefined` is deliberate.** `useApiError` prefers a translated `code` over
`error.message`, so a code is only worth assigning where a generic sentence beats what the
server said. "Unauthenticated." is not a sentence to show a patient. But a business
rejection — "The code is invalid or has expired." — is precise, user-facing, and better
than anything generic. Those keep their message and take no code.

Three more rules:

- **Any 5xx body is discarded** (`:84-88`) and replaced with "The service is temporarily
  unavailable." A 5xx body from MedPoint is a PHP stack trace with file paths
  (`/var/www/MedPoint/…`). That is for the log, never for the user.
- **A 422 with `errors` becomes a `ValidationError`** (`:34-47`) carrying
  `fields: Record<string, string[]>` and a `fieldError(field)` helper, so a form can call
  `setError(field, …)` and put the complaint next to the input it belongs to rather than
  dumping one long toast.
- **A 401 clears the tokens *and* fires `notifyUnauthorized()`** (`:169-177`). Dropping the
  token alone is not enough — React still holds the signed-in user, so the app would keep
  rendering a dashboard whose every request now fails. `AuthProvider` subscribes and sends
  the user to sign in. **There is no refresh-and-retry** — see INTEGRATION.md's decision
  #5 (`refreshSession()` is written but has zero call sites, because the endpoint 500s).

### The open i18n consequence

Because a business rejection keeps the server's own prose, and MedPoint speaks only
English, **Arabic users see English error messages** for exactly the errors that matter
most — the ones explaining why their booking or their code was rejected. Stable
machine-readable error codes from the backend are the fix. This is the last item on the
path to full-live in `INTEGRATION.md`, but it is not cosmetic.
