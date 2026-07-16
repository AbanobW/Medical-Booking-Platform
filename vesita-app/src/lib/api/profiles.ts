import { isLiveCapability } from "@/lib/api/capabilities";
import { ApiError, db, makeId, request } from "@/lib/api/client";
import * as liveProfiles from "@/lib/api/medpoint/profiles";
import { evaluateEligibility } from "@/lib/eligibility";
import type {
  EligibilityResult,
  Gender,
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
  if (isLiveCapability("profiles")) {
    return liveProfiles.getPatientProfiles(accountId);
  }

  return request(() =>
    db()
      .patientProfiles.filter((p) => p.accountId === accountId)
      .sort((a, b) => {
        if (a.relationship === "self") return -1;
        if (b.relationship === "self") return 1;
        return a.createdAt.localeCompare(b.createdAt);
      }),
  );
}

export function getPatientProfile(
  id: string,
  accountId: string,
): Promise<PatientProfile> {
  if (isLiveCapability("profiles")) {
    return liveProfiles.getPatientProfile(id, accountId);
  }

  return request(() => {
    const profile = db().patientProfiles.find((p) => p.id === id);
    if (!profile || profile.accountId !== accountId) {
      throw new ApiError("Patient profile not found", 404, "profile.notFound");
    }
    return profile;
  });
}

/** Exactly what `POST`/`PATCH /v1/me/profiles` accept — see `medpoint/profiles`. */
export interface PatientProfileInput {
  relationship: Relationship;
  fullName: string;
  gender: Gender;
  dateOfBirth: string;
  phone?: string;
  nationalId?: string;
}

export function createPatientProfile(
  accountId: string,
  input: PatientProfileInput,
): Promise<PatientProfile> {
  if (isLiveCapability("profiles")) {
    return liveProfiles.createPatientProfile(accountId, input);
  }

  return request(() => {
    const state = db();

    if (
      input.relationship === "self" &&
      state.patientProfiles.some(
        (p) => p.accountId === accountId && p.relationship === "self",
      )
    ) {
      throw new ApiError(
        "This account already has a profile for you. Add this person as a family member instead.",
        409,
        "profile.selfExists",
      );
    }

    const profile: PatientProfile = {
      id: makeId("pp"),
      accountId,
      ...input,
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
  if (isLiveCapability("profiles")) {
    return liveProfiles.updatePatientProfile(id, accountId, input);
  }

  return request(() => {
    const profile = db().patientProfiles.find((p) => p.id === id);
    if (!profile || profile.accountId !== accountId) {
      throw new ApiError("Patient profile not found", 404, "profile.notFound");
    }

    Object.assign(profile, input);

    return profile;
  });
}

export function deletePatientProfile(
  id: string,
  accountId: string,
): Promise<{ id: string }> {
  if (isLiveCapability("profiles")) {
    return liveProfiles.deletePatientProfile(id, accountId);
  }

  return request(() => {
    const state = db();
    const profile = state.patientProfiles.find((p) => p.id === id);

    if (!profile || profile.accountId !== accountId) {
      throw new ApiError("Patient profile not found", 404, "profile.notFound");
    }
    if (profile.relationship === "self") {
      throw new ApiError(
        "Your own profile cannot be removed.",
        409,
        "profile.cannotRemoveSelf",
      );
    }

    const bookings = state.bookings.filter((b) => b.patientProfileId === id).length;
    if (bookings > 0) {
      throw new ApiError(
        `${profile.fullName} has ${bookings} booking${bookings === 1 ? "" : "s"} on record. ` +
          "Medical and booking history belongs to the profile, so it cannot be removed.",
        409,
        "profile.hasBookings",
        { name: profile.fullName, count: bookings },
      );
    }

    state.patientProfiles = state.patientProfiles.filter((p) => p.id !== id);
    return { id };
  });
}

export function checkEligibility(
  service: Service,
  profileId: string,
  accountId: string,
): Promise<EligibilityResult> {
  if (isLiveCapability("profiles")) {
    return liveProfiles
      .getPatientProfile(profileId, accountId)
      .then((profile) => evaluateEligibility(service, profile));
  }

  return request(() => {
    const profile = db().patientProfiles.find((p) => p.id === profileId);
    if (!profile || profile.accountId !== accountId) {
      throw new ApiError("Patient profile not found", 404, "profile.notFound");
    }
    return evaluateEligibility(service, profile);
  });
}
