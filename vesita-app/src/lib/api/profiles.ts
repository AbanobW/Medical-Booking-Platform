/**
 * Patient profiles (Business Logic §1).
 *
 * An account owns its profiles. Every query is scoped by `accountId` and never
 * widens: profiles are private to the account that created them and are never
 * automatically linked to another account, even when a name or phone number
 * appears to match. The server enforces this too — another account's profile
 * answers 404, not 403.
 *
 * A thin seam over `medpoint/profiles` so screens import from `@/lib/api/*`
 * rather than the wire layer.
 */

import * as live from "@/lib/api/medpoint/profiles";
import { evaluateEligibility } from "@/lib/eligibility";
import type {
  EligibilityResult,
  Gender,
  PatientProfile,
  Relationship,
  Service,
} from "@/lib/types";

export {
  getPatientProfiles,
  getPatientProfile,
  createPatientProfile,
  updatePatientProfile,
  deletePatientProfile,
} from "@/lib/api/medpoint/profiles";

/** Exactly what `POST`/`PATCH /v1/me/profiles` accept — see `medpoint/profiles`. */
export interface PatientProfileInput {
  relationship: Relationship;
  fullName: string;
  gender: Gender;
  dateOfBirth: string;
  phone?: string;
  nationalId?: string;
}

export async function checkEligibility(
  service: Service,
  profileId: string,
  accountId: string,
): Promise<EligibilityResult> {
  const profile: PatientProfile = await live.getPatientProfile(profileId, accountId);
  return evaluateEligibility(service, profile);
}
