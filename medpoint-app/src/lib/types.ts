/**
 * MedPoint domain model.
 *
 * This is the single contract shared by the mock API layer and every feature.
 * It is deliberately shaped like a real REST/JSON backend response so the
 * service layer in `src/lib/api` can later be swapped for `fetch` calls
 * without touching any component.
 */

// ---------------------------------------------------------------------------
// Roles & auth
// ---------------------------------------------------------------------------

/**
 * A free-text field that exists in both languages.
 *
 * Names across the dataset are bilingual via a `nameAr` sibling. Prose —
 * bios, service descriptions, preparation instructions — is bilingual via this
 * shape instead, because those strings are composed from templates and there is
 * no natural "…Ar" field to hang them on.
 *
 * Render with `localized()` / `useDomain().localized()`, never by reading `.en`
 * directly. Admin-authored content created at runtime (coupon and campaign
 * descriptions) stays a plain `string` — an admin types it once, in one
 * language — and `localized()` passes those through unchanged.
 */
export interface LocalizedText {
  en: string;
  ar: string;
}

export type Role = "patient" | "doctor" | "lab" | "radiology" | "admin";

/** The three role types that own a bookable provider profile. */
export type ProviderRole = Extract<Role, "doctor" | "lab" | "radiology">;

export const PROVIDER_ROLES: readonly ProviderRole[] = [
  "doctor",
  "lab",
  "radiology",
] as const;

export const ROLE_LABELS: Record<Role, string> = {
  patient: "Patient",
  doctor: "Doctor",
  lab: "Medical Lab",
  radiology: "Radiology Center",
  admin: "Administrator",
};

export type UserStatus = "active" | "suspended" | "pending";

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  /** Null when the account has no avatar; the UI falls back to initials. */
  avatar: string | null;
  status: UserStatus;
  /** Set for doctor/lab/radiology accounts — links the user to their profile. */
  providerId?: string;
  gender?: Gender;
  /** `birth` on the wire — written via `PATCH /v1/users/:id`, not `PUT /v1/profile`. */
  dateOfBirth?: string;
  createdAt: string;
  lastActiveAt: string;
}

export type Gender = "male" | "female";

// ---------------------------------------------------------------------------
// Patient profiles (Business Logic §1)
//
// An Account owns Patient Profiles. A Booking belongs to a Patient Profile,
// never to the Account directly, so medical and booking history stay coherent
// regardless of who did the booking. Profiles are private to their account and
// are never merged or cross-linked with another account's profiles, even when
// the name or phone number appears to match.
// ---------------------------------------------------------------------------

export type Relationship = "self" | "child" | "spouse" | "parent";

export const RELATIONSHIPS: readonly Relationship[] = [
  "self",
  "child",
  "spouse",
  "parent",
] as const;

export const RELATIONSHIP_LABELS: Record<Relationship, string> = {
  self: "Myself",
  child: "Child",
  spouse: "Spouse",
  parent: "Parent",
};

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

// ---------------------------------------------------------------------------
// Geography
// ---------------------------------------------------------------------------

export interface Area {
  id: string;
  name: string;
  nameAr: string;
  governorateId: string;
}

export interface Governorate {
  id: string;
  name: string;
  nameAr: string;
  /** Approximate centroid — used by the map placeholder. */
  lat: number;
  lng: number;
  areas: Area[];
}

export interface GeoPoint {
  lat: number;
  lng: number;
}

// ---------------------------------------------------------------------------
// Insurance (Business Logic §14 — future phase)
//
// Not part of the MVP. The model reserves space for it now so that switching it
// on later does not disturb existing bookings, providers or profiles: a provider
// declares the plans it accepts, a patient profile carries its insurance info.
// ---------------------------------------------------------------------------

export interface InsurancePlan {
  id: string;
  name: string;
  nameAr: string;
}

export interface InsuranceInfo {
  planId: string;
  policyNumber: string;
  expiresAt: string;
}

/** Master switch for the insurance phase. Flip to `true` to expose it. */
export const INSURANCE_ENABLED = false;

// ---------------------------------------------------------------------------
// Taxonomy
// ---------------------------------------------------------------------------

export interface Specialty {
  id: string;
  name: string;
  nameAr: string;
  /** Lucide icon name, resolved at render time. */
  icon: string;
  description: LocalizedText;
  /**
   * How many doctors practise it — known only where it has been counted, which
   * is `getPopularSpecialties`. The taxonomy itself does not carry a count; it
   * used to sit at a hardcoded `0` waiting for the seed to overwrite it.
   */
  doctorCount?: number;
}

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

export type ProviderStatus = "approved" | "pending" | "rejected" | "suspended";

/**
 * Suspension comes in two forms (§13).
 *
 * `soft` — removed from search, no new bookings, but bookings that already
 * exist are honored. Suits a temporary pause without punishing patients.
 * `hard` — additionally cancels every upcoming booking, refunds them in full,
 * and notifies the affected patients. Used for credential problems or fraud.
 */
export type SuspensionType = "soft" | "hard";

export const SUSPENSION_LABELS: Record<SuspensionType, string> = {
  soft: "Soft — hidden from search, existing bookings honored",
  hard: "Hard — upcoming bookings cancelled and refunded",
};

export interface Suspension {
  type: SuspensionType;
  reason: string;
  suspendedAt: string;
  /** Bookings cancelled as a result of a hard suspension. */
  cancelledBookingCount?: number;
}

/**
 * Fields common to doctors, labs and radiology centers.
 *
 * A field typed `| null` is one the API may not answer. `null` means "not
 * known", and the UI renders it as an em dash — it is never coerced to `0`, to
 * an empty string, or to a plausible default. A zero rating and an unrated
 * provider are different facts and the model keeps them different.
 */
export interface ProviderBase {
  id: string;
  type: ProviderRole;
  slug: string;
  name: string;
  nameAr: string;
  /** No avatar endpoint — null until the API serves one. */
  photo: string | null;
  coverImage: string | null;
  bio: LocalizedText | null;
  /** No reviews endpoint yet: null, not zero. */
  rating: number | null;
  reviewCount: number | null;
  /** Entry price — consultation fee, or cheapest test/scan. */
  price: number | null;
  governorateId: string | null;
  areaId: string | null;
  address: string | null;
  location: GeoPoint | null;
  phone: string | null;
  status: ProviderStatus;
  isFeatured: boolean;
  /** Total lifetime bookings — drives the "Most Booked" sort. */
  bookingCount: number | null;
  waitingTimeMinutes: number | null;
  joinedAt: string;
  /**
   * The provider's default weekly availability.
   *
   * Real availability is always resolved at the *branch* level (§2) — this is
   * the fallback used when a branch does not override it, and the template new
   * branches start from.
   */
  schedule: DaySchedule[];
  /**
   * Every provider operates through one or more branches — a doctor across one
   * or more clinics, a lab or radiology center across many. Services, schedules,
   * pricing and availability all hang off the branch.
   */
  branches: Branch[];
  /** Insurance plans accepted here. Empty until the insurance phase (§14). */
  acceptedInsurancePlanIds: string[];
  /** Present only while `status === "suspended"`. */
  suspension?: Suspension;
  /** Null until ops confirms the listing — backs the FAQ's verification promise. */
  verifiedAt: string | null;
}

export interface Doctor extends ProviderBase {
  type: "doctor";
  title: string;
  /**
   * Resolved id for filtering — from the API's `specialty` field or parsed out of
   * `name`. Null when neither maps to a known specialty.
   */
  specialtyId: string | null;
  /** Raw `specialty` string from the API — shown when `specialtyId` is unknown. */
  specialtyLabel: string | null;
  subSpecialties: string[];
  gender: Gender | null;
  yearsOfExperience: number | null;
  degrees: string[];
  languages: string[];
  clinicName: string | null;
  /** Medical Syndicate registration number — the FAQ's verification claim. */
  syndicateNumber: string | null;
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

/**
 * A branch is an independent operating unit (§2).
 *
 * Because branches operate independently, schedules, services, pricing and
 * capacity are all defined *per branch*, not per provider: a service offered at
 * one branch may not exist at another, and the same service may be priced
 * differently across branches.
 */
export interface Branch {
  id: string;
  providerId: string;
  name: string;
  governorateId: string | null;
  areaId: string | null;
  address: string | null;
  phone: string | null;
  location: GeoPoint | null;
  /** No opening-hours field on the wire — null, never a plausible 09:00–21:00. */
  openingHours: string | null;
  /** Branch-specific working hours, sessions and slots. */
  schedule: DaySchedule[];
  /** IDs of the provider's services actually offered here. */
  serviceIds: string[];
  /** Branch-specific pricing. Falls back to the service's own price. */
  priceOverrides: Record<string, number>;
  isActive: boolean;
}

/**
 * The branch price for a service, falling back to the service's own price.
 *
 * Null when neither is known — a branch that does not override a price it also
 * does not have. Callers must treat that as "no price to show", never as free.
 */
export function branchPriceOf(
  branch: Branch | undefined,
  service: Service,
): number | null {
  return branch?.priceOverrides[service.id] ?? service.price;
}

// ---------------------------------------------------------------------------
// Services (the bookable unit)
// ---------------------------------------------------------------------------

export type ServiceKind = "consultation" | "test" | "scan" | "package";

// ---------------------------------------------------------------------------
// Preparation & eligibility (Business Logic §3)
//
// Lab tests and radiology scans carry requirements a doctor visit does not.
// Where a service carries either, the booking flow MUST show them and require
// an explicit acknowledgement before the booking can be finalized — this is
// what stops a patient arriving un-fasted, or booking a scan they cannot have.
// ---------------------------------------------------------------------------

export interface PreparationInstructions {
  fastingRequired: boolean;
  /** How many hours of fasting. Only meaningful when `fastingRequired`. */
  fastingHours?: number;
  /** Whether water is permitted during the fast. */
  waterAllowed: boolean;
  /** Medicines to pause or continue before the test. */
  medicationRestrictions: LocalizedText[];
  /** When to arrive, what to bring, prior results needed. */
  arrivalInstructions: LocalizedText;
  documentsRequired: LocalizedText[];
}

export interface EligibilityRules {
  /** Restricted to these genders. Empty/undefined = no restriction. */
  genders?: Gender[];
  minAge?: number;
  maxAge?: number;
  /** `false` = unsafe or not permitted during pregnancy. Shown, not auto-checked. */
  pregnancySafe: boolean;
  /** Conditions that make this service inappropriate. Shown, not auto-checked. */
  excludedConditions: string[];
}

/**
 * Only the rules a stored profile can be screened against.
 *
 * `gender` and `dateOfBirth` are the sole clinical facts the API persists on a
 * profile, so they are the only rules that can block a booking outright.
 * `pregnancySafe` and `excludedConditions` are still declared, displayed, and
 * acknowledged (§3) — there is just nothing on file to check them against.
 */
export type EligibilityViolationCode = "gender" | "min_age" | "max_age";

export interface EligibilityViolation {
  code: EligibilityViolationCode;
  message: string;
}

export interface EligibilityResult {
  eligible: boolean;
  violations: EligibilityViolation[];
}

/** True when a service has anything the patient must be shown and acknowledge. */
export function hasPreparation(service: Service): boolean {
  const prep = "preparation" in service ? service.preparation : undefined;
  if (!prep) return false;
  return (
    prep.fastingRequired ||
    prep.medicationRestrictions.length > 0 ||
    prep.documentsRequired.length > 0 ||
    prep.arrivalInstructions.en.length > 0
  );
}

export function hasEligibilityRules(service: Service): boolean {
  const rules = "eligibility" in service ? service.eligibility : undefined;
  if (!rules) return false;
  return (
    (rules.genders?.length ?? 0) > 0 ||
    rules.minAge !== undefined ||
    rules.maxAge !== undefined ||
    !rules.pregnancySafe ||
    rules.excludedConditions.length > 0
  );
}

/** Whether the booking flow must gate this service behind an acknowledgement. */
export function requiresAcknowledgement(service: Service): boolean {
  return hasPreparation(service) || hasEligibilityRules(service);
}

/** A doctor's consultation offering (in-clinic, video, follow-up, home visit). */
export interface ConsultationType {
  id: string;
  kind: "consultation";
  name: string;
  nameAr: string;
  description: LocalizedText | null;
  price: number | null;
  durationMinutes: number | null;
  isActive: boolean;
}

export interface LabTest {
  id: string;
  kind: "test";
  name: string;
  nameAr: string;
  /**
   * Grouping key for the service catalogue ("Hematology", "X-Ray"). This is an
   * identifier, not copy — translate it at render with `useLabels().serviceCategory`.
   */
  category: string | null;
  description: LocalizedText | null;
  price: number | null;
  /** Turnaround time before results are ready. */
  resultTimeHours: number | null;
  fastingRequired: boolean | null;
  /**
   * Undefined when the API did not send rules — never a permissive stand-in.
   *
   * `{ pregnancySafe: true, excludedConditions: [] }` used to be substituted
   * here, which asserted that every scan was safe in pregnancy. Absent rules
   * mean unknown, and `requiresAcknowledgement` treats unknown as "nothing to
   * show", not "nothing to worry about".
   */
  preparation?: PreparationInstructions;
  eligibility?: EligibilityRules;
  isActive: boolean;
}

export interface RadiologyScan {
  id: string;
  kind: "scan";
  name: string;
  nameAr: string;
  /** Grouping key — see `LabTest.category`. */
  category: string | null;
  description: LocalizedText | null;
  price: number | null;
  durationMinutes: number | null;
  contrastRequired: boolean | null;
  /** Absent means unknown — see `LabTest.preparation`. */
  preparation?: PreparationInstructions;
  eligibility?: EligibilityRules;
  isActive: boolean;
}

/** A bundle of tests or scans sold at a discount. */
export interface ServicePackage {
  id: string;
  kind: "package";
  name: string;
  nameAr: string;
  description: LocalizedText;
  /** IDs of the included LabTest / RadiologyScan items. */
  includes: string[];
  price: number;
  originalPrice: number;
  isActive: boolean;
}

export type Service =
  | ConsultationType
  | LabTest
  | RadiologyScan
  | ServicePackage;

// ---------------------------------------------------------------------------
// Availability
// ---------------------------------------------------------------------------

/** 0 = Sunday … 6 = Saturday, matching `Date.prototype.getDay()`. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const WEEKDAY_NAMES: Record<Weekday, string> = {
  0: "Sunday",
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
};

/**
 * How a provider organises their day (§5).
 *
 * `session` — how doctors actually work: an evening clinic, where the patient
 * gets a queue number and an *estimated* time rather than an exact minute.
 * `slot` — how labs and radiology centers work: closer to fixed appointments,
 * because that is how sample collection and scans are organised.
 */
export type SchedulingMode = "session" | "slot";

export function schedulingModeFor(type: ProviderRole): SchedulingMode {
  return type === "doctor" ? "session" : "slot";
}

/**
 * Capacity behaviour (§5).
 *
 * `comfort` — a soft limit. A doctor can usually see one more patient; it just
 * means a longer evening. It may be exceeded knowingly, with the patient's
 * consent.
 * `strict` — a physical limit (e.g. scans a machine can do in a session). It
 * must never be exceeded, including under concurrent booking attempts.
 */
export type CapacityType = "comfort" | "strict";

export const CAPACITY_LABELS: Record<CapacityType, string> = {
  comfort: "Comfort limit — may run over with a longer wait",
  strict: "Strict limit — never exceeded",
};

export interface DaySchedule {
  weekday: Weekday;
  isWorkingDay: boolean;
  /** `HH:mm` 24-hour. */
  startTime: string;
  endTime: string;
  slotDurationMinutes: number;
  /** Breaks carved out of the working window (e.g. prayer / lunch). */
  breaks: { startTime: string; endTime: string }[];
  /** Places available in this session, or per slot for slot-based providers. */
  capacity: number;
  capacityType: CapacityType;
}

/**
 * A concrete bookable place on a concrete date.
 *
 * For a slot-based provider this is a real appointment time. For a session-based
 * doctor it is a session the patient joins, receiving a queue number and an
 * estimated time. Confirmed bookings *and active holds* both consume capacity.
 */
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

export interface Holiday {
  id: string;
  providerId: string;
  date: string;
  reason: string;
}

// ---------------------------------------------------------------------------
// Bookings
// ---------------------------------------------------------------------------

/**
 * The booking state machine (§7).
 *
 * This is the single vocabulary for a booking's status, shared by the UI and
 * the API. A booking is only ever in exactly one state, and only the transitions
 * in `ALLOWED_TRANSITIONS` are permitted.
 */
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

export const BOOKING_STATUSES: readonly BookingStatus[] = [
  "held",
  "awaiting_payment",
  "confirmed",
  "completed",
  "no_show",
  "cancelled_by_patient",
  "cancelled_by_provider",
  "refund_pending",
  "refunded",
] as const;

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  held: "Held",
  awaiting_payment: "Awaiting payment",
  confirmed: "Confirmed",
  completed: "Completed",
  no_show: "Missed visit",
  cancelled_by_patient: "Cancelled by you",
  cancelled_by_provider: "Cancelled by provider",
  refund_pending: "Refund in progress",
  refunded: "Refunded",
};

/** Provider-facing wording — "cancelled by you" means something different here. */
export const BOOKING_STATUS_LABELS_PROVIDER: Record<BookingStatus, string> = {
  ...BOOKING_STATUS_LABELS,
  cancelled_by_patient: "Cancelled by patient",
  cancelled_by_provider: "Cancelled by you",
};

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

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/** A place is being claimed — the hold counts against capacity while it lives. */
export function isHold(status: BookingStatus): boolean {
  return status === "held" || status === "awaiting_payment";
}

export function isCancelled(status: BookingStatus): boolean {
  return (
    status === "cancelled_by_patient" ||
    status === "cancelled_by_provider" ||
    status === "refund_pending" ||
    status === "refunded"
  );
}

/** Confirmed bookings and live holds both consume a place. */
export function consumesCapacity(status: BookingStatus): boolean {
  return status === "confirmed" || isHold(status);
}

export function isTerminal(status: BookingStatus): boolean {
  return ALLOWED_TRANSITIONS[status].length === 0;
}

/** A refund is owed and on its way back to the patient. */
export function isRefundInFlight(status: BookingStatus): boolean {
  return status === "refund_pending" || status === "refunded";
}

export type PaymentMethod = "cash" | "card" | "vodafone_cash" | "instapay";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash at Clinic",
  card: "Credit / Debit Card",
  vodafone_cash: "Vodafone Cash",
  instapay: "InstaPay",
};

export type PaymentStatus = "paid" | "unpaid" | "refunded";

export interface PatientInfo {
  fullName: string;
  phone: string;
  email: string;
  gender: Gender;
  dateOfBirth: string;
  /** Free-text symptoms / reason for the visit. */
  notes?: string;
  /** True when the booking is for a family member rather than the account owner. */
  bookingForSomeoneElse: boolean;
}

/** Recorded when a service required preparation / eligibility sign-off (§3). */
export interface Acknowledgement {
  preparationAccepted: boolean;
  eligibilityConfirmed: boolean;
  acknowledgedAt: string;
}

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
  /**
   * Denormalized for list rendering — a real API would embed or expand these.
   * Both languages are carried, because a booking card must render the
   * provider's name in the reader's language and the booking is the only thing
   * loaded at that point. Read them with `named()`, via `bookingProvider()` /
   * `bookingService()` below.
   */
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

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

export interface Review {
  id: string;
  bookingId: string;
  providerId: string;
  patientId: string;
  patientName: string;
  patientAvatar: string;
  rating: number;
  /** Sub-scores shown on the provider profile breakdown. */
  breakdown: {
    waitingTime: number;
    staff: number;
    cleanliness: number;
    communication: number;
  };
  comment: string;
  createdAt: string;
  isVerified: boolean;
  helpfulCount: number;
  /** Optional provider response. */
  reply?: { comment: string; createdAt: string };
}

// ---------------------------------------------------------------------------
// Engagement
// ---------------------------------------------------------------------------

export interface Favorite {
  id: string;
  patientId: string;
  providerId: string;
  createdAt: string;
}

export type NotificationChannel = "sms" | "email" | "whatsapp" | "browser";

export type NotificationKind =
  | "booking_confirmed"
  | "booking_cancelled"
  | "booking_reminder"
  | "review_request"
  | "promo"
  | "system";

export interface AppNotification {
  id: string;
  userId: string;
  kind: NotificationKind;
  channel: NotificationChannel;
  /** Bilingual — the body interpolates a provider/date/time known only at
   * generation time, so it can't be rebuilt from a message key at render. */
  title: LocalizedText;
  body: LocalizedText;
  isRead: boolean;
  createdAt: string;
  actionUrl?: string;
}

export interface NotificationPreferences {
  sms: boolean;
  email: boolean;
  whatsapp: boolean;
  browser: boolean;
}

// ---------------------------------------------------------------------------
// Admin: monetization
// ---------------------------------------------------------------------------

export type DiscountType = "percentage" | "fixed";

/**
 * A discount code.
 *
 * `/v1/coupons` carries the code, type, value, usage counts and expiry. It has
 * no description and no minimum-order or max-discount column, so those are null
 * rather than a made-up "0" that would read as "no minimum".
 */
export interface Coupon {
  id: string;
  code: string;
  description: string | null;
  discountType: DiscountType;
  discountValue: number;
  minOrderValue: number | null;
  maxDiscount?: number;
  /** `null` = unlimited, which is what the API means by a null `max_uses`. */
  usageLimit: number | null;
  usageCount: number;
  expiresAt: string | null;
  isActive: boolean;
  /** Empty array = applies to every service type. */
  appliesTo: ProviderRole[];
  createdAt: string;
}

export type CampaignStatus = "active" | "scheduled" | "ended";

export interface CashbackCampaign {
  id: string;
  name: string;
  description: string;
  /** Percentage of the booking total returned as wallet credit. */
  percentage: number;
  maxCashback: number;
  startsAt: string;
  endsAt: string;
  appliesTo: ProviderRole[];
  status: CampaignStatus;
  totalIssued: number;
  redeemedCount: number;
}

export interface CommissionSettings {
  doctor: number;
  lab: number;
  radiology: number;
  /** Flat fee added to every booking, in EGP. */
  platformFee: number;
  vatPercentage: number;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

export interface TimeSeriesPoint {
  label: string;
  bookings: number;
  revenue: number;
  cancellations: number;
}

export interface CategoryCount {
  name: string;
  value: number;
}

export interface ProviderStats {
  totalBookings: number | null;
  bookingsChange: number | null;
  revenue: number | null;
  revenueChange: number | null;
  newPatients: number | null;
  newPatientsChange: number | null;
  cancellations: number | null;
  cancellationsChange: number | null;
  averageRating: number | null;
  monthly: TimeSeriesPoint[];
  /** §15 — how full the provider's sessions and slots actually run, as a %. */
  utilizationRate: number | null;
  utilizationChange: number | null;
  /** §15 — average wait, taken from what patients report in their reviews. */
  averageWaitMinutes: number | null;
  cancellationRate: number | null;
  noShowRate: number | null;
}

export interface AdminStats {
  totalUsers: number | null;
  usersChange: number | null;
  totalProviders: number | null;
  providersChange: number | null;
  totalBookings: number | null;
  bookingsChange: number | null;
  totalRevenue: number | null;
  revenueChange: number | null;
  bookingTrends: TimeSeriesPoint[];
  topSpecialties: CategoryCount[];
  topGovernorates: CategoryCount[];
  /** §15 — share of profile views that turn into bookings, as a %. */
  conversionRate: number | null;
  conversionChange: number | null;
  cancellationRate: number | null;
  cancellationRateChange: number | null;
  noShowRate: number | null;
}

export interface PatientStats {
  upcomingCount: number | null;
  completedCount: number | null;
  cancelledCount: number | null;
  totalSpent: number | null;
  cashbackEarned: number | null;
  favoriteCount: number | null;
  reviewCount: number | null;
}

// ---------------------------------------------------------------------------
// Query contracts (mirrors what the future backend would accept)
// ---------------------------------------------------------------------------

export type SortOption =
  | "lowest_price"
  | "highest_rated"
  | "nearest"
  | "earliest_available"
  | "most_booked";

export const SORT_LABELS: Record<SortOption, string> = {
  lowest_price: "Lowest Price",
  highest_rated: "Highest Rated",
  nearest: "Nearest",
  earliest_available: "Earliest Availability",
  most_booked: "Most Booked",
};

export interface SearchFilters {
  /** Free-text across provider name, specialty, test/scan names. */
  q?: string;
  type?: ProviderRole;
  specialtyId?: string;
  /** §4 — narrows within a specialty. */
  subSpecialty?: string;
  governorateId?: string;
  areaId?: string;
  gender?: Gender;
  minRating?: number;
  minPrice?: number;
  maxPrice?: number;
  availableToday?: boolean;
  /** §4/§14 — inert until the insurance phase ships. */
  insurancePlanId?: string;
  sort?: SortOption;
  page?: number;
  pageSize?: number;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Price bounds across the whole catalogue — drives the price slider. */
export const PRICE_RANGE = { min: 0, max: 3000 } as const;
