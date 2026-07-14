/**
 * Wire format → domain model.
 *
 * The single place that knows MedPoint's field names. Everything above this line
 * speaks `src/lib/types.ts`; everything below speaks JSON from Laravel.
 */

import { GOVERNORATES, slugify } from "@/lib/data/egypt";
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
    gender: wire.gender,
    dateOfBirth: toISODateOnly(wire.date_of_birth) ?? wire.date_of_birth.slice(0, 10),
    phone: toLocalPhone(wire.phone) || undefined,
    chronicConditions: [],
    isPregnant: false,
    createdAt: wire.created_at ?? new Date().toISOString(),
  };
}

function governorateIdOf(name: string | undefined): string {
  if (!name) return "cairo";
  const lower = name.toLowerCase();
  const match = GOVERNORATES.find(
    (g) => g.name.toLowerCase() === lower || g.id === lower,
  );
  return match?.id ?? "cairo";
}

function areaIdOf(governorateId: string, areaName: string | undefined): string {
  const gov = GOVERNORATES.find((g) => g.id === governorateId);
  if (!gov || !areaName) return gov?.areas[0]?.id ?? "nasr-city";
  const lower = areaName.toLowerCase();
  const match = gov.areas.find(
    (a) => a.name.toLowerCase() === lower || a.id === lower,
  );
  return match?.id ?? gov.areas[0]?.id ?? "nasr-city";
}

function providerTypeOf(raw: string): ProviderRole {
  if (raw === "lab") return "lab";
  if (raw === "radiology") return "radiology";
  return "doctor";
}

function providerStatusOf(raw: string): ProviderStatus {
  if (raw === "active" || raw === "approved") return "approved";
  if (raw === "suspended") return "suspended";
  if (raw === "rejected") return "rejected";
  return "pending";
}

function avatarFor(seed: string, name: string): string {
  return `/api/avatar?seed=${seed}&name=${encodeURIComponent(name)}`;
}

function coverFor(seed: string): string {
  return `/api/cover?seed=${seed}`;
}

function emptyLocalized(name: string): { en: string; ar: string } {
  return { en: name, ar: name };
}

export function toBranch(wire: WireBranch, providerId: string): Branch {
  const governorateId = governorateIdOf(wire.governorate);
  const lat = typeof wire.lat === "string" ? Number.parseFloat(wire.lat) : (wire.lat ?? 30.04);
  const lng = typeof wire.lng === "string" ? Number.parseFloat(wire.lng) : (wire.lng ?? 31.24);

  return {
    id: wire.id,
    providerId,
    name: wire.area ?? wire.address ?? "Main branch",
    governorateId,
    areaId: areaIdOf(governorateId, wire.area),
    address: wire.address ?? "",
    phone: wire.phones?.[0] ?? "",
    location: { lat: Number.isFinite(lat) ? lat : 30.04, lng: Number.isFinite(lng) ? lng : 31.24 },
    openingHours: "09:00 – 21:00",
    schedule: [],
    serviceIds: [],
    priceOverrides: {},
    isActive: true,
  };
}

function wireServiceToConsultation(wire: WireService): ConsultationType {
  return {
    id: wire.id,
    kind: "consultation",
    name: wire.name,
    nameAr: wire.name,
    description: emptyLocalized(wire.name),
    price: parseMoney(wire.price),
    durationMinutes: 30,
    isActive: true,
  };
}

function wireServiceToLabTest(wire: WireService): LabTest {
  return {
    id: wire.id,
    kind: "test",
    name: wire.name,
    nameAr: wire.name,
    category: wire.category ?? "General",
    description: emptyLocalized(wire.name),
    price: parseMoney(wire.price),
    resultTimeHours: 24,
    fastingRequired: false,
    preparation: {
      fastingRequired: false,
      waterAllowed: true,
      medicationRestrictions: [],
      arrivalInstructions: emptyLocalized(""),
      documentsRequired: [],
    },
    eligibility: { pregnancySafe: true, excludedConditions: [] },
    isActive: true,
  };
}

function wireServiceToScan(wire: WireService): RadiologyScan {
  return {
    id: wire.id,
    kind: "scan",
    name: wire.name,
    nameAr: wire.name,
    category: wire.category ?? "General",
    description: emptyLocalized(wire.name),
    price: parseMoney(wire.price),
    durationMinutes: 30,
    contrastRequired: false,
    preparation: {
      fastingRequired: false,
      waterAllowed: true,
      medicationRestrictions: [],
      arrivalInstructions: emptyLocalized(""),
      documentsRequired: [],
    },
    eligibility: { pregnancySafe: true, excludedConditions: [] },
    isActive: true,
  };
}

export interface ProviderAssembly {
  wire: WireProvider;
  branches?: WireBranch[];
  services?: WireService[];
}

function baseProviderFields(wire: WireProvider, branches: Branch[]) {
  const governorateId = branches[0]?.governorateId ?? "cairo";
  const areaId = branches[0]?.areaId ?? "nasr-city";

  return {
    id: wire.id,
    slug: slugify(wire.name),
    name: wire.name,
    nameAr: wire.name,
    photo: avatarFor(wire.id, wire.name),
    coverImage: coverFor(wire.id),
    bio: emptyLocalized(wire.name),
    rating: 0,
    reviewCount: 0,
    price: 0,
    governorateId,
    areaId,
    address: branches[0]?.address ?? "",
    location: branches[0]?.location ?? { lat: 30.04, lng: 31.24 },
    phone: branches[0]?.phone ?? "",
    status: providerStatusOf(wire.status),
    isFeatured: false,
    bookingCount: 0,
    waitingTimeMinutes: 30,
    joinedAt: wire.created_at ?? new Date().toISOString(),
    schedule: [],
    branches,
    acceptedInsurancePlanIds: [],
  };
}

export function toProvider(assembly: ProviderAssembly): Provider {
  const type = providerTypeOf(assembly.wire.provider_type);
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

  const base = baseProviderFields(assembly.wire, branches);
  const minPrice = services.length
    ? Math.min(...services.map((s) => parseMoney(s.price)))
    : 0;
  base.price = minPrice;

  if (type === "doctor") {
    const consultations = services.map(wireServiceToConsultation);
    const doctor: Doctor = {
      ...base,
      type: "doctor",
      title: "Dr.",
      specialtyId: "general",
      subSpecialties: [],
      gender: "male",
      yearsOfExperience: 0,
      degrees: [],
      languages: ["Arabic"],
      clinicName: branches[0]?.name ?? assembly.wire.name,
      consultationTypes: consultations.length
        ? consultations
        : [
            {
              id: `${assembly.wire.id}-consult`,
              kind: "consultation",
              name: "Consultation",
              nameAr: "كشف",
              description: emptyLocalized("Consultation"),
              price: minPrice || 300,
              durationMinutes: 30,
              isActive: true,
            },
          ],
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
