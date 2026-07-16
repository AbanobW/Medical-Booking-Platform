/**
 * Patient profiles against the real MedPoint API.
 *
 * These live under `/v1/me/profiles` (the old `/v1/patient-profiles` paths are
 * gone and now 404). The list endpoint works, so profiles come straight from the
 * server — including the SELF profile the backend creates automatically at
 * signup, which no client-side cache would ever know about. The owner is always
 * the authenticated account, so no `user_id` is sent, and another account's
 * profile answers 404 ("not yours"), not 403.
 */

import { ApiError } from "@/lib/api/client";
import { apiList, apiRequest } from "@/lib/api/http";
import { toE164Phone, toPatientProfile } from "@/lib/api/medpoint/mappers";
import type { WirePatientProfile } from "@/lib/api/medpoint/types";
import type { PatientProfile } from "@/lib/types";
import type { PatientProfileInput } from "@/lib/api/profiles";

/** A 404 here means "not yours or not there" — surface it as a missing profile. */
function notFound(): ApiError {
  return new ApiError("Patient profile not found", 404, "profile.notFound");
}

export async function getPatientProfiles(accountId: string): Promise<PatientProfile[]> {
  const { items } = await apiList<WirePatientProfile>("/me/profiles");

  return items
    .map((wire) => toPatientProfile(wire, accountId))
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
  try {
    const wire = await apiRequest<WirePatientProfile>(`/me/profiles/${id}`);
    return toPatientProfile(wire, accountId);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) throw notFound();
    throw error;
  }
}

export async function createPatientProfile(
  accountId: string,
  input: PatientProfileInput,
): Promise<PatientProfile> {
  // The backend auto-creates the account's SELF profile at signup and rejects a
  // second one. Catch it here so the user gets a clear message instead of a
  // raw validation error.
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

  const wire = await apiRequest<WirePatientProfile>("/me/profiles", {
    method: "POST",
    body: {
      // No `user_id`: the owner is the authenticated account (a body field is
      // never trusted as the owner). Anything sent is ignored server-side.
      full_name: input.fullName,
      gender: input.gender,
      date_of_birth: input.dateOfBirth,
      relationship: input.relationship,
      national_id: input.nationalId,
      phone: toE164Phone(input.phone),
    },
  });

  return toPatientProfile(wire, accountId);
}

export async function updatePatientProfile(
  id: string,
  accountId: string,
  input: Partial<PatientProfileInput>,
): Promise<PatientProfile> {
  try {
    const wire = await apiRequest<WirePatientProfile>(`/me/profiles/${id}`, {
      method: "PATCH",
      body: {
        full_name: input.fullName,
        gender: input.gender,
        date_of_birth: input.dateOfBirth,
        relationship: input.relationship,
        national_id: input.nationalId,
        phone: input.phone !== undefined ? toE164Phone(input.phone) : undefined,
      },
    });

    return toPatientProfile(wire, accountId);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) throw notFound();
    throw error;
  }
}

export async function deletePatientProfile(
  id: string,
  accountId: string,
): Promise<{ id: string }> {
  const profile = await getPatientProfile(id, accountId);
  if (profile.relationship === "self") {
    // The SELF profile cannot be removed — the server enforces this with a 422.
    throw new ApiError(
      "Your own profile cannot be removed.",
      409,
      "profile.cannotRemoveSelf",
    );
  }

  // A soft delete server-side; the record is retained but no longer active.
  try {
    await apiRequest<void>(`/me/profiles/${id}`, { method: "DELETE" });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) throw notFound();
    throw error;
  }
  return { id };
}
