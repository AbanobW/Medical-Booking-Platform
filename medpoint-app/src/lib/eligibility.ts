import { now } from "@/lib/time";
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
 * what stops a child booking a service with an adult age floor.
 *
 * Screening covers the rules a profile carries the facts to answer: gender and
 * age. A service's pregnancy and excluded-condition rules are still declared
 * and still shown — `eligibilityDescriptors` renders them and the patient
 * acknowledges them — but they cannot be auto-checked, because the API keeps no
 * pregnancy or chronic-condition field on a profile. Screening what is not on
 * file would mean asking at booking time and trusting the answer; §3's
 * show-and-acknowledge gate already covers that ground honestly.
 *
 * Every reason a patient is shown carries a stable `code` and the values that
 * go into it, so the UI can render it in Arabic as easily as in English. The
 * English `message` remains the fallback for anything not yet translated.
 */

/** Values interpolated into a translated eligibility line. */
export type MessageParams = Record<string, string | number>;

/** A violation carrying everything needed to re-render it in any language. */
export interface TranslatableViolation extends EligibilityViolation {
  /** Resolves against `errors.eligibility.violation.<code>`. */
  params: MessageParams;
}

export interface DetailedEligibilityResult extends EligibilityResult {
  violations: TranslatableViolation[];
}

/** A restriction summarised for display, e.g. on the service card. */
export interface EligibilityDescriptor {
  /** Resolves against `errors.eligibility.rule.<code>`. */
  code:
    | "gendersOnly"
    | "ageRange"
    | "minAge"
    | "maxAge"
    | "noPregnancy"
    | "excludedCondition";
  params: MessageParams;
  /** English fallback — identical to the string `describeEligibility` returns. */
  message: string;
}

export function ageOf(dateOfBirth: string, at: Date = now()): number {
  const dob = new Date(`${dateOfBirth}T00:00:00.000Z`);
  // An unset or malformed date of birth (e.g. an auto-created profile the user
  // has not completed) must not surface as NaN — treat it as no age known.
  if (Number.isNaN(dob.getTime())) return 0;
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
 * Checks a patient profile against a service's eligibility rules, returning the
 * translatable form of each violation.
 *
 * Returns every violation rather than just the first, so the patient is told
 * the whole truth at once instead of discovering a second blocker after fixing
 * the first.
 *
 * `params.service` and `params.condition` are the English names at rest. A
 * component rendering these in Arabic should override them with the localized
 * name (`named(service)`, `L.condition(c)`) before interpolating.
 */
export function evaluateEligibilityDetailed(
  service: Service,
  profile: PatientProfile,
): DetailedEligibilityResult {
  const rules = rulesOf(service);
  if (!rules) return { eligible: true, violations: [] };

  const violations: TranslatableViolation[] = [];
  const age = ageOf(profile.dateOfBirth);

  if (rules.genders?.length && !rules.genders.includes(profile.gender)) {
    violations.push({
      code: "gender",
      message: `${service.name} is only available to ${rules.genders.join(" or ")} patients.`,
      // A violation can only happen when the allowed set excludes the patient,
      // so with two genders in the model the allowed set is a single gender.
      params: { service: service.name, gender: rules.genders[0] },
    });
  }

  if (rules.minAge !== undefined && age < rules.minAge) {
    violations.push({
      code: "min_age",
      message: `${service.name} is for patients aged ${rules.minAge} and over. ${profile.fullName} is ${age}.`,
      params: {
        service: service.name,
        minAge: rules.minAge,
        name: profile.fullName,
        age,
      },
    });
  }

  if (rules.maxAge !== undefined && age > rules.maxAge) {
    violations.push({
      code: "max_age",
      message: `${service.name} is for patients aged ${rules.maxAge} and under. ${profile.fullName} is ${age}.`,
      params: {
        service: service.name,
        maxAge: rules.maxAge,
        name: profile.fullName,
        age,
      },
    });
  }

  // `pregnancySafe` and `excludedConditions` are deliberately not screened here:
  // a profile stores neither, so there is nothing to compare. They reach the
  // patient through `eligibilityDescriptors` and the §3 acknowledgement instead.

  return { eligible: violations.length === 0, violations };
}

/**
 * Checks a patient profile against a service's eligibility rules.
 *
 * The published signature (§3) — `evaluateEligibilityDetailed` is the same call
 * with the translation params kept on the type.
 */
export function evaluateEligibility(
  service: Service,
  profile: PatientProfile,
): EligibilityResult {
  return evaluateEligibilityDetailed(service, profile);
}

/**
 * A service's restrictions, as codes plus their values.
 *
 * The translatable counterpart of `describeEligibility` — same rules, same
 * order, same English wording, but renderable in Arabic.
 */
export function eligibilityDescriptors(service: Service): EligibilityDescriptor[] {
  const rules = rulesOf(service);
  if (!rules) return [];

  const out: EligibilityDescriptor[] = [];

  if (rules.genders?.length === 1) {
    const gender = rules.genders[0];
    out.push({
      code: "gendersOnly",
      params: { gender },
      message: `${gender === "male" ? "Men" : "Women"} only`,
    });
  }
  if (rules.minAge !== undefined && rules.maxAge !== undefined) {
    out.push({
      code: "ageRange",
      params: { minAge: rules.minAge, maxAge: rules.maxAge },
      message: `Ages ${rules.minAge}–${rules.maxAge}`,
    });
  } else if (rules.minAge !== undefined) {
    out.push({
      code: "minAge",
      params: { minAge: rules.minAge },
      message: `Ages ${rules.minAge} and over`,
    });
  } else if (rules.maxAge !== undefined) {
    out.push({
      code: "maxAge",
      params: { maxAge: rules.maxAge },
      message: `Ages ${rules.maxAge} and under`,
    });
  }
  if (!rules.pregnancySafe) {
    out.push({
      code: "noPregnancy",
      params: {},
      message: "Not performed during pregnancy",
    });
  }
  for (const condition of rules.excludedConditions) {
    out.push({
      code: "excludedCondition",
      params: { condition },
      message: `Not suitable with ${condition.toLowerCase()}`,
    });
  }

  return out;
}

/** A plain-language summary of a service's restrictions, for the profile page. */
export function describeEligibility(service: Service): string[] {
  return eligibilityDescriptors(service).map((d) => d.message);
}
