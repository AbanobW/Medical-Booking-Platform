import type {
  EligibilityRules,
  PreparationInstructions,
} from "@/lib/types";

/**
 * Preparation instructions and eligibility rules for lab tests and radiology
 * scans (Business Logic §3).
 *
 * These are derived from the test/scan itself rather than stored per provider:
 * a Fasting Blood Sugar needs the same fast whichever lab draws the blood. The
 * seed attaches the result to every provider's copy of the service.
 */

const NO_PREP: PreparationInstructions = {
  fastingRequired: false,
  waterAllowed: true,
  medicationRestrictions: [],
  arrivalInstructions: "Arrive 10 minutes before your appointment.",
  documentsRequired: ["National ID"],
};

const NO_RULES: EligibilityRules = {
  pregnancySafe: true,
  excludedConditions: [],
};

/** Common chronic conditions a patient profile may carry. */
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

/**
 * Preparation for a lab test, keyed off the catalogue's `fastingRequired` flag
 * and the test's category.
 */
export function preparationForTest(
  name: string,
  category: string,
  fastingRequired: boolean,
): PreparationInstructions {
  const fastingHours = category === "Diabetes" ? 8 : 12;

  const medicationRestrictions: string[] = [];
  if (category === "Diabetes") {
    medicationRestrictions.push(
      "Do not take your morning insulin or diabetes tablets until the sample is drawn.",
    );
  }
  if (category === "Cardiac") {
    medicationRestrictions.push(
      "Continue your blood-pressure medication as normal unless your doctor says otherwise.",
    );
  }
  if (category === "Hormones") {
    medicationRestrictions.push(
      "Pause biotin and vitamin B supplements for 48 hours — they distort hormone readings.",
    );
  }

  if (!fastingRequired && medicationRestrictions.length === 0) {
    return {
      ...NO_PREP,
      arrivalInstructions: `Arrive 10 minutes early for ${name}. No fasting is needed.`,
    };
  }

  return {
    fastingRequired,
    fastingHours: fastingRequired ? fastingHours : undefined,
    // Water is allowed during the fast — dehydration makes the draw harder.
    waterAllowed: true,
    medicationRestrictions,
    arrivalInstructions: fastingRequired
      ? `Arrive in the morning after a ${fastingHours}-hour fast. Plain water is allowed and encouraged.`
      : "Arrive 10 minutes before your appointment.",
    documentsRequired: ["National ID"],
  };
}

/** Eligibility rules for a lab test. Most are unrestricted. */
export function eligibilityForTest(
  name: string,
  category: string,
): EligibilityRules {
  if (name.toLowerCase().includes("psa")) {
    return {
      genders: ["male"],
      minAge: 40,
      pregnancySafe: true,
      excludedConditions: [],
    };
  }
  if (category === "Hormones" && name.toLowerCase().includes("pregnancy")) {
    return { genders: ["female"], pregnancySafe: true, excludedConditions: [] };
  }
  return NO_RULES;
}

/**
 * Preparation for a radiology scan. Modality drives almost everything here:
 * CT and MRI carry real constraints, plain X-Ray carries almost none.
 */
export function preparationForScan(
  name: string,
  category: string,
  contrastRequired: boolean,
): PreparationInstructions {
  const lower = name.toLowerCase();

  if (category === "MRI") {
    return {
      fastingRequired: contrastRequired,
      fastingHours: contrastRequired ? 4 : undefined,
      waterAllowed: true,
      medicationRestrictions: contrastRequired
        ? ["Tell the radiographer about any kidney condition before contrast is given."]
        : [],
      arrivalInstructions:
        "Arrive 30 minutes early. Leave all metal at home — jewellery, watches, hair clips and coins. " +
        "The scan is loud and enclosed; ear protection is provided.",
      documentsRequired: ["National ID", "Doctor's referral", "Any previous imaging"],
    };
  }

  if (category === "CT") {
    return {
      fastingRequired: contrastRequired,
      fastingHours: contrastRequired ? 6 : undefined,
      waterAllowed: true,
      medicationRestrictions: contrastRequired
        ? [
            "Stop metformin 48 hours before a contrast scan if you are diabetic.",
            "A recent kidney-function test may be requested before contrast is given.",
          ]
        : [],
      arrivalInstructions: contrastRequired
        ? "Arrive 30 minutes early and fast for 6 hours. Water is allowed."
        : "Arrive 15 minutes before your appointment.",
      documentsRequired: ["National ID", "Doctor's referral"],
    };
  }

  if (category === "Ultrasound") {
    const abdominal = lower.includes("abdom");
    const pelvic = lower.includes("pelvic") || lower.includes("obstetric");
    return {
      fastingRequired: abdominal,
      fastingHours: abdominal ? 6 : undefined,
      waterAllowed: true,
      medicationRestrictions: [],
      arrivalInstructions: pelvic
        ? "Drink one litre of water an hour before and arrive with a full bladder — the scan needs it."
        : abdominal
          ? "Fast for 6 hours beforehand so the bowel is clear. Water is allowed."
          : "Arrive 10 minutes before your appointment.",
      documentsRequired: ["National ID"],
    };
  }

  return {
    ...NO_PREP,
    arrivalInstructions: `Arrive 15 minutes before your ${name}. No special preparation is needed.`,
    documentsRequired: ["National ID", "Doctor's referral"],
  };
}

/**
 * Eligibility for a radiology scan.
 *
 * Ionising radiation is the main driver: X-Ray, CT and mammography are not
 * given in pregnancy. MRI adds implant and claustrophobia exclusions.
 */
export function eligibilityForScan(
  name: string,
  category: string,
  contrastRequired: boolean,
): EligibilityRules {
  const lower = name.toLowerCase();

  if (lower.includes("mammograph")) {
    return {
      genders: ["female"],
      minAge: 40,
      pregnancySafe: false,
      excludedConditions: [],
    };
  }

  if (lower.includes("obstetric")) {
    // The one scan that exists *for* pregnancy.
    return { genders: ["female"], pregnancySafe: true, excludedConditions: [] };
  }

  if (category === "MRI") {
    return {
      pregnancySafe: !contrastRequired,
      minAge: 6,
      excludedConditions: [
        "Metal implant or pacemaker",
        "Claustrophobia",
        ...(contrastRequired ? ["Kidney disease", "Contrast allergy"] : []),
      ],
    };
  }

  if (category === "CT" || category === "X-Ray") {
    return {
      // Ionising radiation — not given in pregnancy.
      pregnancySafe: false,
      minAge: category === "CT" ? 2 : undefined,
      excludedConditions: contrastRequired
        ? ["Kidney disease", "Contrast allergy"]
        : [],
    };
  }

  if (lower.includes("dexa") || lower.includes("bone density")) {
    return { minAge: 18, pregnancySafe: false, excludedConditions: [] };
  }

  return NO_RULES;
}
