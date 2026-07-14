/**
 * Patient profiles against the real MedPoint API.
 *
 * `GET /v1/patient-profiles` 500s on staging, so listing uses the overlay cache
 * of ids created in this browser and fetches each profile by id.
 */

import { ApiError } from "@/lib/api/client";
import { apiRequest } from "@/lib/api/http";
import { toE164Phone, toPatientProfile } from "@/lib/api/medpoint/mappers";
import {
  cacheProfileId,
  listCachedProfileIds,
  uncacheProfileId,
} from "@/lib/api/medpoint/overlay";
import type { WirePatientProfile } from "@/lib/api/medpoint/types";
import type { PatientProfile } from "@/lib/types";
import type { PatientProfileInput } from "@/lib/api/profiles";

async function fetchProfile(id: string, accountId: string): Promise<PatientProfile> {
  const wire = await apiRequest<WirePatientProfile>(`/patient-profiles/${id}`);
  const profile = toPatientProfile(wire, accountId);
  if (wire.user_id && wire.user_id !== accountId) {
    throw new ApiError("Patient profile not found", 404, "profile.notFound");
  }
  return profile;
}

export async function getPatientProfiles(accountId: string): Promise<PatientProfile[]> {
  const ids = listCachedProfileIds(accountId);
  if (ids.length === 0) return [];

  const profiles = await Promise.all(
    ids.map(async (id) => {
      try {
        return await fetchProfile(id, accountId);
      } catch {
        uncacheProfileId(accountId, id);
        return null;
      }
    }),
  );

  return profiles
    .filter((p): p is PatientProfile => p !== null)
    .sort((a, b) => {
      if (a.relationship === "self") return -1;
      if (b.relationship === "self") return 1;
      return a.createdAt.localeCompare(b.createdAt);
    });
}

export async function getPatientProfile(
  id: string,
  accountId: string,
): Promise<PatientProfile> {
  const cached = listCachedProfileIds(accountId);
  if (!cached.includes(id)) {
    throw new ApiError("Patient profile not found", 404, "profile.notFound");
  }
  return fetchProfile(id, accountId);
}

export async function createPatientProfile(
  accountId: string,
  input: PatientProfileInput,
): Promise<PatientProfile> {
  if (input.relationship === "self") {
    const existing = await getPatientProfiles(accountId);
    if (existing.some((p) => p.relationship === "self")) {
      throw new ApiError(
        "This account already has a profile for you. Add this person as a family member instead.",
        409,
        "profile.selfExists",
      );
    }
  }

  const wire = await apiRequest<WirePatientProfile>("/patient-profiles", {
    method: "POST",
    body: {
      user_id: accountId,
      full_name: input.fullName,
      gender: input.gender,
      date_of_birth: input.dateOfBirth,
      relationship: input.relationship,
      phone: toE164Phone(input.phone),
    },
  });

  cacheProfileId(accountId, wire.id);
  return toPatientProfile(wire, accountId);
}

export async function updatePatientProfile(
  id: string,
  accountId: string,
  input: Partial<PatientProfileInput>,
): Promise<PatientProfile> {
  await getPatientProfile(id, accountId);

  const wire = await apiRequest<WirePatientProfile>(`/patient-profiles/${id}`, {
    method: "PATCH",
    body: {
      full_name: input.fullName,
      gender: input.gender,
      date_of_birth: input.dateOfBirth,
      relationship: input.relationship,
      phone: input.phone !== undefined ? toE164Phone(input.phone) : undefined,
    },
  });

  return toPatientProfile(wire, accountId);
}

export async function deletePatientProfile(
  id: string,
  accountId: string,
): Promise<{ id: string }> {
  const profile = await getPatientProfile(id, accountId);
  if (profile.relationship === "self") {
    throw new ApiError(
      "Your own profile cannot be removed.",
      409,
      "profile.cannotRemoveSelf",
    );
  }

  await apiRequest<void>(`/patient-profiles/${id}`, { method: "DELETE" });
  uncacheProfileId(accountId, id);
  return { id };
}
