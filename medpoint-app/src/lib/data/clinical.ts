/**
 * Clinical vocabulary (Business Logic §3).
 *
 * This file used to *generate* preparation instructions and eligibility rules
 * from a test's name and category — inventing, for every lab in the country,
 * that a Fasting Blood Sugar needs a 12-hour fast and that an MRI excludes a
 * pacemaker. Plausible, and authored here rather than by the provider who
 * actually performs the scan. Those generators are gone with the seeded
 * catalogue they fed; prep and eligibility now come from the service itself
 * (`prep_instructions` / `eligibility_rules` on the wire) or are absent.
 *
 * What remains is a vocabulary, not data: the list a provider picks from when
 * declaring which conditions rule their service out.
 */

/**
 * Common chronic conditions a service may exclude.
 *
 * These strings are IDENTIFIERS — they are matched against
 * `EligibilityRules.excludedConditions`. Never translate them at rest; translate
 * at render via `useLabels().condition(...)`.
 */
export const CHRONIC_CONDITIONS = [
  "Diabetes",
  "Hypertension",
  "Asthma",
  "Kidney disease",
  "Heart disease",
  "Thyroid disorder",
  "Epilepsy",
  "Claustrophobia",
  "Metal implant or pacemaker",
  "Contrast allergy",
] as const;
