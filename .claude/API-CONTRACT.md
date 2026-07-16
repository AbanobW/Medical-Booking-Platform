# MedPoint API contract — endpoints, wire shapes, and the gap map

The reference you open when you are about to write or change a mapper.

Sources: `.claude/MedPoint.postman_collection.json` for request shapes (it ships **no
example responses** — that is why every response below was verified by probing live
staging on 2026-07-14), and `vesita-app/src/lib/api/` for what the app actually does with
them.

Read `.claude/INTEGRATION.md` first for the capability state and the workaround registry.

---

## 1. Endpoint catalogue

Base: `https://medpoint.intrazero.org/v1` — but **the browser never calls it directly**.
`http.ts:111-122` builds `/api/medpoint/v1/<path>`, and `next.config.ts:41-48` rewrites
that upstream. See workaround #2.

MedPoint is Apiato-flavoured Laravel, so most of this is generated 5-verb CRUD scaffolding.
**Twenty folders, ~120 requests, and the app uses about twenty of them.** Marking the rest
`unused` plainly is the point of this table — do not go hunting for meaning in `/v1/audits`.

### Auth — `medpoint/auth.ts`

| Endpoint | Status | Body |
|---|---|---|
| `POST /v1/auth/login` | **used** | `{ email, password }` → `WireAuthSession` |
| `POST /v1/auth/register` | **used, ✅ now fixed** | `{ full_name, email, password, phone }` → `201` + a token pair. It used to 500 *after* creating the row; **workaround #1 is now dead code — delete it** (`medpoint/auth.ts:73-80`). |
| `POST /v1/logout` | **used** | — |
| `POST /v1/auth/refresh-token` | **broken (500)** | — · `RefreshToken::createFrom()` type-hints the base `Request`. Workaround #3. |
| `POST /v1/auth/forgot-password` | **used** | `{ email }` — step 1 of password reset |
| `POST /v1/auth/verify-otp` | **used** | `{ email, otp }` — step 2 |
| `POST /v1/auth/reset-password` | **used** | `{ email, otp, password, password_confirmation }` — step 3 |
| `POST /v1/email/verification-notification` | **used** | — · resend the verification link |
| `POST /v1/auth/google` | unused | `{ id_token }` — no Google client configured |
| `POST /v1/auth/phone` | unused | `{ id_token }` |
| `POST /v1/auth/admin/reset-password` · `…/confirm` | unused | admin-only |
| `POST /v1/email/verify/:id/:hash` | unused | link target |

The OTP endpoints serve **password reset only**. A live signup already returns a token pair
and the account is immediately usable, so it skips `/verify` entirely
(`session.ts:141-143`, `requiresOtpAfterSignup()` → `!isLive()`).

### Users & profile — `medpoint/profile.ts`

| Endpoint | Status | Notes |
|---|---|---|
| `GET /v1/profile` | **used** | The signed-in user. Returns `gender` and `birth`… |
| `PUT /v1/profile` | **used** | …but **accepts neither**. Only `name` and `phone` round-trip — `gender`/`birth` go via `PATCH /v1/users/:id`, so the account needs both writers. Workaround #10 is no longer lossy. |
| `POST /v1/profile/avatar` · `DELETE /v1/profile/avatar` | **used** | |
| `PATCH /v1/users/:id/password` | **used** | `{ current_password, new_password, new_password_confirmation }`; a wrong password is a 422 on `current_password` |
| `PATCH /v1/users/:id` | **used** | `{ name, gender, birth, current_password, new_password, new_password_confirmation }`. The app sends only `gender` and `birth`: `name` is left to `PUT /v1/profile` so each field has one writer, and the password trio belongs to the endpoint above, which reports a wrong password as a 422 a form can attach to. |
| `GET /v1/users` · `GET|DELETE /v1/users/:id` | unused | admin surface |
| `/v1/users/:id/roles` · `/v1/users/:id/permissions` (GET/POST/PUT/DELETE) | unused | Full RBAC exists on the server; **no role reaches `WireUser`**, so the app can't use it. Workaround #11. |

### Roles & permissions

`GET|POST|DELETE /v1/roles`, `/v1/roles/:id`, `/v1/roles/:id/permissions` (GET/POST/PUT/DELETE),
`GET /v1/permissions`, `GET /v1/permissions/:id` — **all unused.** MedPoint ships complete
RBAC that the patient MVP cannot reach, because a new signup gets no role and the user
payload carries none.

### Discovery — `medpoint/providers.ts`

| Endpoint | Status | Notes |
|---|---|---|
| `GET /v1/providers` | **used, degraded** | All pages pulled at `limit=50`. **Every filter param is silently ignored** — `provider_type=`, `search=`, `q=`, `filter=` all return the same unfiltered page. Only `page` and `limit` work; `per_page` does not. |
| `GET /v1/providers/:id` | **used** | |
| `GET /v1/branches` | **used** | All pages; joined to providers by `provider_id` in the browser |
| `GET /v1/services` | **used** | All pages; joined to branches by `branch_id` |
| `POST /v1/providers` | unused | `{ type, name, status }` |
| `POST /v1/branches` | unused | `{ provider_id, governorate, area, address, lat, lng, phones[] }` |
| `POST /v1/services` | unused | `{ branch_id, name, category, price, prep_instructions, eligibility_rules[], home_collection }` — **note the spec-shaped fields the GET does not surface** |
| `PATCH`/`DELETE` on all three | unused | ops-managed (§2 Phase 1) |

### Availability — `medpoint/availability.ts`

| Endpoint | Status | Notes |
|---|---|---|
| `GET /v1/slots` | **used, degraded** | All pages at `limit=100`, then filtered client-side by branch and date. Lab/radiology places. |
| `GET /v1/doctor-sessions` | **used, degraded** | Same. Doctor sessions (queue-number model). |
| `POST /v1/slots` | unused | `{ branch_id, service_id, start_datetime, capacity }` |
| `POST /v1/doctor-sessions` | unused | `{ branch_id, provider_id, date, start_time, end_time, max_tickets, capacity_type }` |
| `PATCH`/`DELETE`/`GET :id` on both | unused | |

**There is no endpoint to query availability for a provider over a date range**, and no
hold/expiry concept anywhere. That is why availability is "fetch everything, filter here".

### Booking & money — `medpoint/bookings.ts`

| Endpoint | Status | Notes |
|---|---|---|
| `POST /v1/bookings` | **used** | `{ patient_profile_id, branch_id, bookable_type, bookable_id, price_snapshot, booking_fee, source }` — **the request shape is right**; the response is the problem |
| `GET /v1/bookings` · `GET /v1/bookings/:id` | **unusable** | Returns no FKs and no datetime. §3 below. The keystone gap. |
| `POST /v1/payments` | **used, failure swallowed** | `{ booking_id, amount, purpose, gateway }` — ⚠️ a rejection is caught and ignored (`bookings.ts:209-221`). Workaround #6. |
| `PATCH`/`DELETE /v1/bookings/:id` | unused | cancel/reschedule stay on the mock |
| `/v1/refunds` (5 verbs) | unused | `{ booking_id, payment_id, amount, reason }` — §8/§9 refunds not wired |
| `/v1/payments` GET/PATCH/DELETE | unused | |

### Patient profiles — `medpoint/profiles.ts`

🔴 **The whole route now 404s on every verb** — `{"message": "The route v1/patient-profiles
could not be found."}`. This is a regression against the documented behaviour below, and it
kills the live booking flow: a booking belongs to a patient profile (§1) and the wizard
opens by choosing one. Fix this before anything else on the roadmap.

| Endpoint | Status | Notes |
|---|---|---|
| `POST /v1/patient-profiles` | 🔴 **404** (was: used) | `{ user_id, full_name, gender, date_of_birth, relationship, phone }` |
| `GET /v1/patient-profiles/:id` | 🔴 **404** (was: used) | Was the only way the app could read a profile — the basis of workaround #4 |
| `PATCH` · `DELETE /v1/patient-profiles/:id` | 🔴 **404** (was: used) | |
| `GET /v1/patient-profiles` | 🔴 **404** (was: 500) | Previously `ListPatientProfilesTask::{closure}(): Argument #1 ($query) must be of type Eloquent\Builder, PatientProfile given`. Both bugs need fixing: the route, then the list. |

### Unused entirely

`/v1/reviews`, `/v1/notifications`, `/v1/coupons`, `/v1/insurances`, `/v1/wallets`,
`/v1/audits` — each a full 5-verb CRUD folder. Reviews and notifications are deferred MVP
scope; coupons/insurances/wallets are later-phase per the business doc (§12, §14); audits
is scaffolding. **There is no `/v1/favorites` resource at all**, which is why
`/patient/favorites` — a built, working screen — has nothing to talk to.

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
  | LabTest            // + category, resultTimeHours, fastingRequired, preparation, eligibility
  | RadiologyScan      // + durationMinutes, contrastRequired, preparation, eligibility
  | ServicePackage;    // + includes[], originalPrice
```

`preparation: PreparationInstructions` and `eligibility: EligibilityRules` are the §3
acknowledgement gate. **In live mode both are synthesized empty** — see §5.

---

## 4. The gap map

Domain field the UI needs → wire field that supplies it → what fills the hole today.

### 🔑 `Booking` — the keystone

`WireBooking` supplies **six fields**. The domain `Booking` needs forty. Nothing that
identifies *who*, *where*, *what* or *when*.

| Domain field | Wire | Filled by |
|---|---|---|
| `status` | `status` | direct |
| `price` / `total` | `price_snapshot` | `parseMoney` |
| `bookingFee` | `booking_fee` | `parseMoney` |
| `paymentStatus` | `payment_status` | direct |
| `queueNumber` | `queue_number` | direct |
| `id` | `id` | direct (but see hashids, workaround #7) |
| **`date`** | ✗ | **overlay** (wizard input) |
| **`time`** | ✗ | **overlay** |
| **`providerId`** | ✗ | **overlay** |
| **`serviceId`** | ✗ | **overlay** |
| **`branchId`** | ✗ | **overlay** |
| **`patientProfileId`** | ✗ | **overlay** |
| `providerName` / `NameAr` / `Photo` / `Specialty` | ✗ | overlay |
| `serviceName` / `serviceNameAr` | ✗ | overlay |
| `patientInfo`, `address`, `capacityType`, `overCapacity` | ✗ | overlay |
| `holdExpiresAt` | ✗ | overlay (client-side 10-min timer) |
| `reference` | ✗ | derived: `` `BK-${wireId.slice(-6).toUpperCase()}` `` |
| `discount`, `cashback`, `couponCode` | ✗ | overlay (always `0` / undefined live) |
| `refund*`, `completedAt`, `noShowAt`, `longWaitReported`, `hasReview` | ✗ | not modelled live |

The full staging payload, identical on list and detail:

```json
{ "type": "Booking", "id": "…", "status": "no_show", "price_snapshot": "121.00",
  "booking_fee": "0.00", "payment_status": "unpaid", "queue_number": null,
  "source": "walk_in", "created_at": "…", "updated_at": "…" }
```

`?include=provider|service|branch|slot` is accepted (200) but changes nothing, and
`meta.include` is always `[]`.

**"Dr. Hala Mansour — Cardiology, Tue 16 Jul, 10:00" is not derivable from that response.**
That single sentence is why `bookingRead: false`, why `overlay.ts` exists, and why
`/patient/bookings`, the patient dashboard, cancel and reschedule all stay on the mock.

### `Provider`

| Domain field | Wire | Filled by |
|---|---|---|
| `id`, `name`, `type`, `status` | `id`, `name`, `provider_type`, `status` | direct |
| `slug` | ✗ | `slugify(name)` |
| `photo` / `coverImage` | ✗ | generated `/api/avatar?seed=…`, `/api/cover?seed=…` |
| `governorateId` / `areaId` / `address` / `location` / `phone` | via `WireBranch` | joined client-side; **fuzzy-matched, defaults to `cairo`/`nasr-city`** |
| `price` | via `WireService` | `min(services.price)` |
| `rating`, `reviewCount`, `bookingCount`, `isFeatured` | ✗ | **hard-coded `0` / `false`** |
| `waitingTimeMinutes` | ✗ | hard-coded `30` |
| `bio`, `schedule`, `acceptedInsurancePlanIds` | ✗ | empty |
| Doctor: `specialtyId` | ✗ (glued into `name`) | **hard-coded `"general"`** |
| Doctor: `gender` | ✗ | **hard-coded `"male"`** |
| Doctor: `title` / `yearsOfExperience` / `degrees` / `subSpecialties` | ✗ | `"Dr."` / `0` / `[]` / `[]` |
| Lab: `homeSampleCollection` | `home_collection` on services | `services.some(...)` |
| Lab/Radiology: `accreditation`, `packages` | ✗ | empty |

Consequence: **live-mode filter-by-specialty, filter-by-gender and sort-by-rating all
match against constants.** They cannot work. That is not a mapper bug — the data is not
on the wire.

### `Service`

| Domain field | Wire | Filled by |
|---|---|---|
| `id`, `name`, `price`, `category` | direct | `parseMoney` for price |
| `nameAr` | ✗ | falls back to `name` (English shown to Arabic readers) |
| `description` | ✗ | `{ en: name, ar: name }` |
| **`preparation`** | `prep_instructions` **exists on the wire type but is not read** | **synthesized empty** |
| **`eligibility`** | `eligibility_rules` **exists but is not read** | **synthesized empty** |
| `durationMinutes` / `resultTimeHours` / `fastingRequired` / `contrastRequired` | ✗ | `30` / `24` / `false` / `false` |

⚠️ The §3 gate depends on `preparation` and `eligibility`, and **the data is not on the
wire.** Probed: `GET /v1/services` returns `"prep_instructions": null` and omits
`eligibility_rules` from the payload entirely.

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
| `toISODateOnly` | `:39` | `"2026-08-01T00:00:00.000000Z"` → `"2026-08-01"` |
| `parseMoney` | `:45` | `"449.00"` → `449`; `null`/NaN → `0` |
| `toLocalPhone` | `:52` | `+20…` or `0020…` → `0…`; `null` → `""` |
| `toE164Phone` | `:60` | `0…` → `+20…`; already-`+` passes through |
| `roleOf` | `:68` | ⚠️ takes no argument, returns `"patient"`. Workaround #11. |
| `toUser` | `:80` | `birth` → `dateOfBirth`; avatar falls back to a generated URL |
| `toPatientProfile` | `:100` | defaults a null `gender`/`date_of_birth` — the auto-created SELF profile has neither |
| `governorateIdOf` / `areaIdOf` | `:115` / `:124` | fuzzy string match; ⚠️ **defaults to `"cairo"` / `"nasr-city"` on a miss** |
| `toBranch` | `:159` | lat/lng parsed from string-or-number; defaults to `30.04, 31.24` (Cairo) |
| `wireServiceToConsultation` | `:181` | |
| `wireServiceToLabTest` | `:194` | ⚠️ synthesizes empty `preparation` + `eligibility` |
| `wireServiceToScan` | `:217` | ⚠️ same |
| `toProvider` | `:277` | discriminates on `provider_type`; hard-codes most of the card |
| `slotToTimeSlot` | `:398` | prefixes `s:`; forces `capacityType: "strict"` |
| `sessionToTimeSlot` | `:414` | prefixes `d:` |
| `parseBookableId` | `:428` | ⚠️ **the reverse** — strips the prefix back into `{ bookableType: "Slot" \| "DoctorSession", bookableId }` for the `POST /bookings` body |

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

`http.ts` throws the *same* `ApiError` the mock throws, carrying the same stable `code`,
so `useApiError()`, `errors.json` and every toast in the app work without knowing which
backend answered.

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
  the user to sign in. **There is no refresh-and-retry** (workaround #3).

### The open i18n consequence

Because a business rejection keeps the server's own prose, and MedPoint speaks only
English, **Arabic users see English error messages** for exactly the errors that matter
most — the ones explaining why their booking or their code was rejected. Stable
machine-readable error codes from the backend are the fix. This is the last item on the
path to full-live in `INTEGRATION.md`, but it is not cosmetic.
