import { TODAY } from "@/lib/data/seed";
import type {
  EligibilityResult,
  EligibilityRules,
  EligibilityViolation,
  PatientProfile,
  Service,
} from "@/lib/types";

/**
 * Eligibility screening (Business Logic §3).
 *
 * A service may restrict who can book it. The booking flow must not let a
 * patient finalize a booking for a profile that fails these rules — this is
 * what stops a pregnant patient booking a CT scan, or a child booking a service
 * with an adult age floor.
 */

export function ageOf(dateOfBirth: string, at: Date = TODAY): number {
  const dob = new Date(`${dateOfBirth}T00:00:00.000Z`);
  let age = at.getUTCFullYear() - dob.getUTCFullYear();

  const monthDelta = at.getUTCMonth() - dob.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && at.getUTCDate() < dob.getUTCDate())) {
    age -= 1;
  }
  return Math.max(0, age);
}

function rulesOf(service: Service): EligibilityRules | undefined {
  return "eligibility" in service ? service.eligibility : undefined;
}

/**
 * Checks a patient profile against a service's eligibility rules.
 *
 * Returns every violation rather than just the first, so the patient is told
 * the whole truth at once instead of discovering a second blocker after fixing
 * the first.
 */
export function evaluateEligibility(
  service: Service,
  profile: PatientProfile,
): EligibilityResult {
  const rules = rulesOf(service);
  if (!rules) return { eligible: true, violations: [] };

  const violations: EligibilityViolation[] = [];
  const age = ageOf(profile.dateOfBirth);

  if (rules.genders?.length && !rules.genders.includes(profile.gender)) {
    violations.push({
      code: "gender",
      message: `${service.name} is only available to ${rules.genders.join(" or ")} patients.`,
    });
  }

  if (rules.minAge !== undefined && age < rules.minAge) {
    violations.push({
      code: "min_age",
      message: `${service.name} is for patients aged ${rules.minAge} and over. ${profile.fullName} is ${age}.`,
    });
  }

  if (rules.maxAge !== undefined && age > rules.maxAge) {
    violations.push({
      code: "max_age",
      message: `${service.name} is for patients aged ${rules.maxAge} and under. ${profile.fullName} is ${age}.`,
    });
  }

  if (!rules.pregnancySafe && profile.isPregnant) {
    violations.push({
      code: "pregnancy",
      message: `${service.name} is not performed during pregnancy.`,
    });
  }

  for (const condition of rules.excludedConditions) {
    if (profile.chronicConditions.includes(condition)) {
      violations.push({
        code: "condition",
        message: `${service.name} is not suitable for patients with ${condition.toLowerCase()}.`,
      });
    }
  }

  return { eligible: violations.length === 0, violations };
}

/** A plain-language summary of a service's restrictions, for the profile page. */
export function describeEligibility(service: Service): string[] {
  const rules = rulesOf(service);
  if (!rules) return [];

  const out: string[] = [];

  if (rules.genders?.length === 1) {
    out.push(`${rules.genders[0] === "male" ? "Men" : "Women"} only`);
  }
  if (rules.minAge !== undefined && rules.maxAge !== undefined) {
    out.push(`Ages ${rules.minAge}–${rules.maxAge}`);
  } else if (rules.minAge !== undefined) {
    out.push(`Ages ${rules.minAge} and over`);
  } else if (rules.maxAge !== undefined) {
    out.push(`Ages ${rules.maxAge} and under`);
  }
  if (!rules.pregnancySafe) {
    out.push("Not performed during pregnancy");
  }
  for (const condition of rules.excludedConditions) {
    out.push(`Not suitable with ${condition.toLowerCase()}`);
  }

  return out;
}
