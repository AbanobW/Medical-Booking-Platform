import { ApiError, db, makeId, request } from "@/lib/api/client";
import { evaluateEligibility } from "@/lib/eligibility";
import type {
  EligibilityResult,
  Gender,
  InsuranceInfo,
  PatientProfile,
  Relationship,
  Service,
} from "@/lib/types";

/**
 * Patient profiles (Business Logic §1).
 *
 * An account owns its profiles. Every query here is scoped by `accountId` and
 * never widens: profiles are private to the account that created them and are
 * never automatically linked to another account, even when a name or phone
 * number appears to match. Two accounts describing the same real person stay
 * two separate records.
 */

export function getPatientProfiles(accountId: string): Promise<PatientProfile[]> {
  return request(() =>
    db()
      .patientProfiles.filter((p) => p.accountId === accountId)
      // "Self" first, then the rest in the order they were added.
      .sort((a, b) => {
        if (a.relationship === "self") return -1;
        if (b.relationship === "self") return 1;
        return a.createdAt.localeCompare(b.createdAt);
      }),
  );
}

/** Reads one profile, refusing to cross the account boundary. */
export function getPatientProfile(
  id: string,
  accountId: string,
): Promise<PatientProfile> {
  return request(() => {
    const profile = db().patientProfiles.find((p) => p.id === id);
    if (!profile || profile.accountId !== accountId) {
      throw new ApiError("Patient profile not found", 404);
    }
    return profile;
  });
}

export interface PatientProfileInput {
  relationship: Relationship;
  fullName: string;
  gender: Gender;
  dateOfBirth: string;
  phone?: string;
  bloodType?: string;
  chronicConditions: string[];
  isPregnant: boolean;
  insurance?: InsuranceInfo;
}

export function createPatientProfile(
  accountId: string,
  input: PatientProfileInput,
): Promise<PatientProfile> {
  return request(() => {
    const state = db();

    // An account has exactly one "self".
    if (
      input.relationship === "self" &&
      state.patientProfiles.some(
        (p) => p.accountId === accountId && p.relationship === "self",
      )
    ) {
      throw new ApiError(
        "This account already has a profile for you. Add this person as a family member instead.",
        409,
      );
    }

    const profile: PatientProfile = {
      id: makeId("pp"),
      accountId,
      ...input,
      // Only a female profile can be flagged pregnant.
      isPregnant: input.gender === "female" && input.isPregnant,
      createdAt: new Date().toISOString(),
    };

    state.patientProfiles.push(profile);
    return profile;
  });
}

export function updatePatientProfile(
  id: string,
  accountId: string,
  input: Partial<PatientProfileInput>,
): Promise<PatientProfile> {
  return request(() => {
    const profile = db().patientProfiles.find((p) => p.id === id);
    if (!profile || profile.accountId !== accountId) {
      throw new ApiError("Patient profile not found", 404);
    }

    Object.assign(profile, input);
    if (profile.gender === "male") profile.isPregnant = false;

    return profile;
  });
}

/**
 * Removes a profile.
 *
 * Booking history attaches to the profile, so a profile with bookings is never
 * silently destroyed — the history would go with it.
 */
export function deletePatientProfile(
  id: string,
  accountId: string,
): Promise<{ id: string }> {
  return request(() => {
    const state = db();
    const profile = state.patientProfiles.find((p) => p.id === id);

    if (!profile || profile.accountId !== accountId) {
      throw new ApiError("Patient profile not found", 404);
    }
    if (profile.relationship === "self") {
      throw new ApiError("Your own profile cannot be removed.", 409);
    }

    const bookings = state.bookings.filter((b) => b.patientProfileId === id).length;
    if (bookings > 0) {
      throw new ApiError(
        `${profile.fullName} has ${bookings} booking${bookings === 1 ? "" : "s"} on record. ` +
          "Medical and booking history belongs to the profile, so it cannot be removed.",
        409,
      );
    }

    state.patientProfiles = state.patientProfiles.filter((p) => p.id !== id);
    return { id };
  });
}

/**
 * Screens a profile against a service's eligibility rules (§3).
 *
 * Exposed as its own call so the booking flow can check *before* the patient
 * invests in choosing a date and time.
 */
export function checkEligibility(
  service: Service,
  profileId: string,
  accountId: string,
): Promise<EligibilityResult> {
  return request(() => {
    const profile = db().patientProfiles.find((p) => p.id === profileId);
    if (!profile || profile.accountId !== accountId) {
      throw new ApiError("Patient profile not found", 404);
    }
    return evaluateEligibility(service, profile);
  });
}
