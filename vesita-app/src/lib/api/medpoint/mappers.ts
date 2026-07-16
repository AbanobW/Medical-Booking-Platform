/**
 * Wire format → domain model.
 *
 * The single place that knows MedPoint's field names. Everything above this line
 * speaks `src/lib/types.ts`; everything below speaks JSON from Laravel.
 */

import { GOVERNORATES, SPECIALTIES, slugify } from "@/lib/data/egypt";
import type {
  WireBranch,
  WireDoctorSession,
  WirePatientProfile,
  WireProvider,
  WireService,
  WireSlot,
  WireUser,
} from "@/lib/api/medpoint/types";
import type {
  Branch,
  CapacityType,
  ConsultationType,
  Doctor,
  Gender,
  Lab,
  LabTest,
  PatientProfile,
  Provider,
  ProviderRole,
  ProviderStatus,
  RadiologyCenter,
  RadiologyScan,
  Role,
  TimeSlot,
  User,
  UserStatus,
} from "@/lib/types";

/** `2026-08-01T00:00:00.000000Z` → `2026-08-01`. Domain dates are bare. */
export function toISODateOnly(timestamp: string | null | undefined): string | undefined {
  if (!timestamp) return undefined;
  return timestamp.slice(0, 10);
}

/** MedPoint money arrives as `"449.00"`; the app works in numbers. */
export function parseMoney(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function toLocalPhone(phone: string | null): string {
  if (!phone) return "";
  const trimmed = phone.trim();
  if (trimmed.startsWith("+20")) return `0${trimmed.slice(3)}`;
  if (trimmed.startsWith("0020")) return `0${trimmed.slice(4)}`;
  return trimmed;
}

export function toE164Phone(phone: string | undefined): string | undefined {
  if (!phone) return undefined;
  const trimmed = phone.trim();
  if (trimmed.startsWith("+")) return trimmed;
  if (trimmed.startsWith("0")) return `+20${trimmed.slice(1)}`;
  return trimmed;
}

function roleOf(): Role {
  return "patient";
}

function statusOf(status: WireUser["status"]): UserStatus {
  return status === "suspended" || status === "pending" ? status : "active";
}

function genderOf(gender: WireUser["gender"]): Gender | undefined {
  return gender === "male" || gender === "female" ? gender : undefined;
}

export function toUser(wire: WireUser): User {
  return {
    id: wire.id,
    name: wire.name,
    email: wire.email,
    phone: toLocalPhone(wire.phone),
    role: roleOf(),
    avatar: wire.avatar_url ?? `/api/avatar?seed=${wire.id}&name=${encodeURIComponent(wire.name)}`,
    status: statusOf(wire.status),
    gender: genderOf(wire.gender),
    dateOfBirth: toISODateOnly(wire.birth),
    createdAt: wire.created_at ?? new Date().toISOString(),
    lastActiveAt: wire.updated_at ?? wire.created_at ?? new Date().toISOString(),
  };
}

export function isEmailVerified(wire: WireUser): boolean {
  return wire.email_verified_at !== null;
}

export function toPatientProfile(wire: WirePatientProfile, accountId: string): PatientProfile {
  return {
    id: wire.id,
    accountId,
    relationship: wire.relationship,
    fullName: wire.full_name,
    // The backend auto-creates the account's SELF profile at signup with no
    // gender or date of birth yet. Both are nullable on the wire; default so the
    // strict domain model holds and the user can complete the profile later. An
    // empty `dateOfBirth` reads as "unset" — the UI hides age until it is filled.
    gender: genderOf(wire.gender) ?? "male",
    dateOfBirth: toISODateOnly(wire.date_of_birth) ?? "",
    phone: toLocalPhone(wire.phone) || undefined,
    nationalId: wire.national_id || undefined,
    createdAt: wire.created_at ?? new Date().toISOString(),
  };
}

/**
 * Resolve the API's governorate label ("Cairo") to a known id.
 *
 * `null` when it matches nothing. This used to default to `"cairo"`, which
 * silently relocated every unrecognised branch to the capital and made the
 * governorate filter lie.
 */
function governorateIdOf(name: string | undefined): string | null {
  if (!name) return null;
  const lower = name.toLowerCase();
  const match = GOVERNORATES.find(
    (g) => g.name.toLowerCase() === lower || g.id === lower,
  );
  return match?.id ?? null;
}

/** Same contract as `governorateIdOf`: an unmatched area is null, not the first one. */
function areaIdOf(governorateId: string | null, areaName: string | undefined): string | null {
  if (!governorateId || !areaName) return null;
  const gov = GOVERNORATES.find((g) => g.id === governorateId);
  if (!gov) return null;
  const lower = areaName.toLowerCase();
  const match = gov.areas.find(
    (a) => a.name.toLowerCase() === lower || a.id === lower,
  );
  return match?.id ?? null;
}

function providerTypeOf(raw: string): ProviderRole {
  if (raw === "lab") return "lab";
  if (raw === "radiology") return "radiology";
  return "doctor";
}

/** British → app (American) spellings and a few common abbreviations. */
const SPECIALTY_ALIASES: Record<string, string> = {
  paediatrics: "pediatrics",
  "obstetrics & gynaecology": "gynecology",
  gynaecology: "gynecology",
  "ob/gyn": "gynecology",
  obgyn: "gynecology",
  "ear, nose & throat": "ent",
  otolaryngology: "ent",
};

/** Resolve a free-text specialty label ("Paediatrics") to a known specialty id. */
function specialtyIdFromLabel(label: string): string {
  const norm = label.trim().toLowerCase();
  if (!norm) return "general";

  const exact = SPECIALTIES.find(
    (s) => s.id === norm || s.name.toLowerCase() === norm || s.nameAr === label.trim(),
  );
  if (exact) return exact.id;

  if (SPECIALTY_ALIASES[norm]) return SPECIALTY_ALIASES[norm];

  const partial = SPECIALTIES.find(
    (s) => norm.includes(s.name.toLowerCase()) || s.name.toLowerCase().includes(norm),
  );
  return partial?.id ?? "general";
}

/**
 * MedPoint bundles a doctor's title, name and specialty into one string —
 * `"Dr. Karim Fahmy — Paediatrics"`. Split it back into a display name (kept with
 * the "Dr." prefix, as the app's own doctors are) and a resolved specialty id.
 * Labs and radiology centres carry no dash, so their name passes through whole.
 */
export function parseProviderName(rawName: string): {
  name: string;
  specialtyId: string;
} {
  const [head, tail] = rawName.split(/\s+[—–-]\s+/, 2);
  const name = (head ?? rawName).trim() || rawName;
  return {
    name,
    specialtyId: tail ? specialtyIdFromLabel(tail) : "general",
  };
}

function providerStatusOf(raw: string): ProviderStatus {
  if (raw === "active" || raw === "approved") return "approved";
  if (raw === "suspended") return "suspended";
  if (raw === "rejected") return "rejected";
  return "pending";
}

function emptyLocalized(name: string): { en: string; ar: string } {
  return { en: name, ar: name };
}

/** `"30.671000"` → `30.671`. Null unless the API sent a usable number. */
function toCoord(value: number | string | undefined): number | null {
  if (value === undefined || value === null) return null;
  const n = typeof value === "string" ? Number.parseFloat(value) : value;
  return Number.isFinite(n) ? n : null;
}

export function toBranch(wire: WireBranch, providerId: string): Branch {
  const governorateId = governorateIdOf(wire.governorate);
  const lat = toCoord(wire.lat);
  const lng = toCoord(wire.lng);

  return {
    id: wire.id,
    providerId,
    name: wire.area ?? wire.address ?? wire.id,
    governorateId,
    areaId: areaIdOf(governorateId, wire.area),
    address: wire.address ?? null,
    phone: wire.phones?.[0] ?? null,
    // Both or neither: half a coordinate is not a location.
    location: lat !== null && lng !== null ? { lat, lng } : null,
    // The wire carries no opening hours. It used to say "09:00 – 21:00" here,
    // which every branch then displayed as fact.
    openingHours: null,
    schedule: [],
    serviceIds: [],
    priceOverrides: {},
    isActive: true,
  };
}

/**
 * `prep_instructions` is a free-text string on the wire; the domain wants a
 * structured `PreparationInstructions`. There is no honest conversion between
 * the two, so the text becomes the arrival instruction and nothing else is
 * claimed. Null text means no preparation block at all.
 */
function toPreparation(
  wire: WireService,
): PreparationInstructions | undefined {
  const text = wire.prep_instructions?.trim();
  if (!text) return undefined;

  return {
    fastingRequired: false,
    waterAllowed: true,
    medicationRestrictions: [],
    arrivalInstructions: emptyLocalized(text),
    documentsRequired: [],
  };
}

/**
 * `eligibility_rules` arrives as an opaque array the API never documents and, in
 * practice, never populates. Until its shape is known there is nothing to map:
 * returning `undefined` says "unknown", where the old
 * `{ pregnancySafe: true, excludedConditions: [] }` said "safe for everyone".
 */
function toEligibility(wire: WireService): EligibilityRules | undefined {
  void wire;
  return undefined;
}

function wireServiceToConsultation(wire: WireService): ConsultationType {
  return {
    id: wire.id,
    kind: "consultation",
    name: wire.name,
    nameAr: wire.name,
    description: null,
    price: parseMoney(wire.price),
    durationMinutes: null,
    isActive: true,
  };
}

function wireServiceToLabTest(wire: WireService): LabTest {
  return {
    id: wire.id,
    kind: "test",
    name: wire.name,
    nameAr: wire.name,
    category: wire.category ?? null,
    description: null,
    price: parseMoney(wire.price),
    resultTimeHours: null,
    fastingRequired: null,
    preparation: toPreparation(wire),
    eligibility: toEligibility(wire),
    isActive: true,
  };
}

function wireServiceToScan(wire: WireService): RadiologyScan {
  return {
    id: wire.id,
    kind: "scan",
    name: wire.name,
    nameAr: wire.name,
    category: wire.category ?? null,
    description: null,
    price: parseMoney(wire.price),
    durationMinutes: null,
    contrastRequired: null,
    preparation: toPreparation(wire),
    eligibility: toEligibility(wire),
    isActive: true,
  };
}

export interface ProviderAssembly {
  wire: WireProvider;
  branches?: WireBranch[];
  services?: WireService[];
}

/**
 * The fields every provider type shares.
 *
 * Almost all of them are `null`, and that is the honest answer: `/v1/providers`
 * returns `{type, id, provider_type, name, status, created_at, updated_at}` and
 * nothing else. There is no rating, no photo, no bio, no price and no waiting
 * time on the wire — each of those used to be filled with a plausible constant
 * here (`rating: 0`, `waitingTimeMinutes: 30`, a generated avatar), which is
 * exactly the invented data this model no longer carries.
 */
function baseProviderFields(wire: WireProvider, branches: Branch[], displayName: string) {
  const main = branches[0];

  return {
    id: wire.id,
    slug: slugify(displayName),
    name: displayName,
    nameAr: displayName,
    photo: null,
    coverImage: null,
    bio: null,
    rating: null,
    reviewCount: null,
    price: null,
    // A provider's location is its main branch's; null when it has no branch.
    governorateId: main?.governorateId ?? null,
    areaId: main?.areaId ?? null,
    address: main?.address ?? null,
    location: main?.location ?? null,
    phone: main?.phone ?? null,
    status: providerStatusOf(wire.status),
    isFeatured: false,
    bookingCount: null,
    waitingTimeMinutes: null,
    joinedAt: wire.created_at ?? new Date().toISOString(),
    schedule: [],
    branches,
    acceptedInsurancePlanIds: [],
  };
}

export function toProvider(assembly: ProviderAssembly): Provider {
  const type = providerTypeOf(assembly.wire.provider_type);
  const { name: displayName, specialtyId } = parseProviderName(assembly.wire.name);
  const branches = (assembly.branches ?? []).map((b) =>
    toBranch(b, assembly.wire.id),
  );

  const services = assembly.services ?? [];
  for (const svc of services) {
    const branch = branches.find((b) => b.id === svc.branch_id);
    if (branch && !branch.serviceIds.includes(svc.id)) {
      branch.serviceIds.push(svc.id);
    }
  }

  const base = baseProviderFields(assembly.wire, branches, displayName);

  // The entry price is the cheapest service we can prove belongs to this
  // provider. With no services attributed, the price is unknown — null, not 0.
  // `0` rendered as "0 ج.م.", telling the patient the visit was free.
  const prices = services.map((s) => parseMoney(s.price)).filter((p) => p > 0);
  base.price = prices.length ? Math.min(...prices) : null;

  if (type === "doctor") {
    const doctor: Doctor = {
      ...base,
      type: "doctor",
      title: "Dr.",
      specialtyId,
      subSpecialties: [],
      gender: null,
      yearsOfExperience: null,
      degrees: [],
      languages: [],
      clinicName: branches[0]?.name ?? null,
      // No stand-in consultation. A doctor with no attributable service has
      // nothing bookable, and the booking flow must say so rather than offer an
      // invented "Consultation, 300 EGP" that exists on no price list.
      consultationTypes: services.map(wireServiceToConsultation),
    };
    return doctor;
  }

  if (type === "lab") {
    const lab: Lab = {
      ...base,
      type: "lab",
      accreditation: [],
      homeSampleCollection: services.some((s) => s.home_collection),
      tests: services.map(wireServiceToLabTest),
      packages: [],
    };
    return lab;
  }

  const center: RadiologyCenter = {
    ...base,
    type: "radiology",
    accreditation: [],
    scans: services.map(wireServiceToScan),
    packages: [],
  };
  return center;
}

// ---------------------------------------------------------------------------
// Availability
// ---------------------------------------------------------------------------

/** Prefix live slot ids so holdBooking can tell Slot from DoctorSession apart. */
export const SLOT_ID_PREFIX = "s:";
export const SESSION_ID_PREFIX = "d:";

function capacityTypeOf(raw: string | undefined): CapacityType {
  return raw === "strict" ? "strict" : "comfort";
}

function slotCapacity(wire: WireSlot): { capacity: number; taken: number } {
  const capacity = wire.capacity ?? 1;
  const taken = wire.booked_count ?? 0;
  return { capacity, taken };
}

function sessionCapacity(wire: WireDoctorSession): { capacity: number; taken: number } {
  const capacity = wire.max_tickets ?? 1;
  const taken = wire.booked_count ?? 0;
  return { capacity, taken };
}

function buildTimeSlot(
  id: string,
  date: string,
  time: string,
  capacity: number,
  taken: number,
  capacityType: CapacityType,
): TimeSlot {
  const remaining = Math.max(0, capacity - taken);
  const isFull = remaining <= 0;
  return {
    id,
    date,
    time: time.slice(0, 5),
    isBooked: isFull,
    isAvailable: remaining > 0,
    capacity,
    capacityType,
    taken,
    remaining,
    isFull,
  };
}

export function slotToTimeSlot(wire: WireSlot): TimeSlot | null {
  const start = wire.start_datetime;
  if (!start) return null;
  const date = toISODateOnly(start) ?? start.slice(0, 10);
  const time = start.includes("T") ? start.slice(11, 16) : "09:00";
  const { capacity, taken } = slotCapacity(wire);
  return buildTimeSlot(
    `${SLOT_ID_PREFIX}${wire.id}`,
    date,
    time,
    capacity,
    taken,
    "strict",
  );
}

export function sessionToTimeSlot(wire: WireDoctorSession): TimeSlot | null {
  const date = toISODateOnly(wire.date) ?? wire.date?.slice(0, 10);
  if (!date || !wire.start_time) return null;
  const { capacity, taken } = sessionCapacity(wire);
  return buildTimeSlot(
    `${SESSION_ID_PREFIX}${wire.id}`,
    date,
    wire.start_time,
    capacity,
    taken,
    capacityTypeOf(wire.capacity_type),
  );
}

export function parseBookableId(slotId: string): {
  bookableType: "Slot" | "DoctorSession";
  bookableId: string;
} {
  if (slotId.startsWith(SLOT_ID_PREFIX)) {
    return { bookableType: "Slot", bookableId: slotId.slice(SLOT_ID_PREFIX.length) };
  }
  if (slotId.startsWith(SESSION_ID_PREFIX)) {
    return {
      bookableType: "DoctorSession",
      bookableId: slotId.slice(SESSION_ID_PREFIX.length),
    };
  }
  return { bookableType: "Slot", bookableId: slotId };
}
