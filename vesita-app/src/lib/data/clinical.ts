import type {
  EligibilityRules,
  LocalizedText,
  PreparationInstructions,
} from "@/lib/types";

/**
 * Preparation instructions and eligibility rules for lab tests and radiology
 * scans (Business Logic §3).
 *
 * These are derived from the test/scan itself rather than stored per provider:
 * a Fasting Blood Sugar needs the same fast whichever lab draws the blood. The
 * seed attaches the result to every provider's copy of the service.
 *
 * Every patient-facing string here is bilingual. The booking flow must *show*
 * these and take an explicit acknowledgement before it can finalize — an
 * Arabic-speaking patient who is shown a fasting rule in English has not been
 * meaningfully warned, so English-only prep would be a safety bug, not a
 * cosmetic one.
 */

/** Short helper so the tables below stay readable. */
const tx = (en: string, ar: string): LocalizedText => ({ en, ar });

const NATIONAL_ID = tx("National ID", "بطاقة الرقم القومي");
const REFERRAL = tx("Doctor's referral", "إحالة من الطبيب");
const PRIOR_IMAGING = tx("Any previous imaging", "أي أشعة سابقة");

const ARRIVE_10 = tx(
  "Arrive 10 minutes before your appointment.",
  "احضر قبل موعدك بعشر دقائق.",
);
const ARRIVE_15 = tx(
  "Arrive 15 minutes before your appointment.",
  "احضر قبل موعدك بخمس عشرة دقيقة.",
);

const NO_PREP: PreparationInstructions = {
  fastingRequired: false,
  waterAllowed: true,
  medicationRestrictions: [],
  arrivalInstructions: ARRIVE_10,
  documentsRequired: [NATIONAL_ID],
};

const NO_RULES: EligibilityRules = {
  pregnancySafe: true,
  excludedConditions: [],
};

/**
 * Common chronic conditions a patient profile may carry.
 *
 * These strings are IDENTIFIERS — they are stored on the profile and matched
 * against `EligibilityRules.excludedConditions`. Never translate them at rest;
 * translate at render via `useLabels().condition(...)`.
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

/**
 * Preparation for a lab test, keyed off the catalogue's `fastingRequired` flag
 * and the test's category.
 */
export function preparationForTest(
  name: string,
  nameAr: string,
  category: string,
  fastingRequired: boolean,
): PreparationInstructions {
  const fastingHours = category === "Diabetes" ? 8 : 12;

  const medicationRestrictions: LocalizedText[] = [];
  if (category === "Diabetes") {
    medicationRestrictions.push(
      tx(
        "Do not take your morning insulin or diabetes tablets until the sample is drawn.",
        "لا تأخذ إنسولين الصباح أو أقراص السكري حتى يتم سحب العينة.",
      ),
    );
  }
  if (category === "Cardiac") {
    medicationRestrictions.push(
      tx(
        "Continue your blood-pressure medication as normal unless your doctor says otherwise.",
        "استمر في تناول دواء الضغط كالمعتاد ما لم يوصِ طبيبك بغير ذلك.",
      ),
    );
  }
  if (category === "Hormones") {
    medicationRestrictions.push(
      tx(
        "Pause biotin and vitamin B supplements for 48 hours — they distort hormone readings.",
        "أوقف مكمّلات البيوتين وفيتامين ب لمدة ٤٨ ساعة — فهي تؤثر على قراءات الهرمونات.",
      ),
    );
  }

  if (!fastingRequired && medicationRestrictions.length === 0) {
    return {
      ...NO_PREP,
      arrivalInstructions: tx(
        `Arrive 10 minutes early for ${name}. No fasting is needed.`,
        `احضر قبل الموعد بعشر دقائق لإجراء ${nameAr}. لا يلزم الصيام.`,
      ),
    };
  }

  return {
    fastingRequired,
    fastingHours: fastingRequired ? fastingHours : undefined,
    // Water is allowed during the fast — dehydration makes the draw harder.
    waterAllowed: true,
    medicationRestrictions,
    arrivalInstructions: fastingRequired
      ? tx(
          `Arrive in the morning after a ${fastingHours}-hour fast. Plain water is allowed and encouraged.`,
          `احضر صباحًا بعد صيام ${fastingHours} ساعة. الماء مسموح بل ويُنصح به.`,
        )
      : ARRIVE_10,
    documentsRequired: [NATIONAL_ID],
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
  nameAr: string,
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
        ? [
            tx(
              "Tell the radiographer about any kidney condition before contrast is given.",
              "أبلغ فني الأشعة بأي مشكلة في الكلى قبل إعطاء الصبغة.",
            ),
          ]
        : [],
      arrivalInstructions: tx(
        "Arrive 30 minutes early. Leave all metal at home — jewellery, watches, hair clips and coins. " +
          "The scan is loud and enclosed; ear protection is provided.",
        "احضر قبل الموعد بثلاثين دقيقة. اترك كل المعادن في المنزل — المجوهرات والساعات ومشابك الشعر والعملات المعدنية. " +
          "الجهاز مغلق وصوته عالٍ، وسيتم توفير سدادات للأذن.",
      ),
      documentsRequired: [NATIONAL_ID, REFERRAL, PRIOR_IMAGING],
    };
  }

  if (category === "CT") {
    return {
      fastingRequired: contrastRequired,
      fastingHours: contrastRequired ? 6 : undefined,
      waterAllowed: true,
      medicationRestrictions: contrastRequired
        ? [
            tx(
              "Stop metformin 48 hours before a contrast scan if you are diabetic.",
              "أوقف الميتفورمين قبل أشعة الصبغة بـ ٤٨ ساعة إذا كنت مريض سكري.",
            ),
            tx(
              "A recent kidney-function test may be requested before contrast is given.",
              "قد يُطلب تحليل حديث لوظائف الكلى قبل إعطاء الصبغة.",
            ),
          ]
        : [],
      arrivalInstructions: contrastRequired
        ? tx(
            "Arrive 30 minutes early and fast for 6 hours. Water is allowed.",
            "احضر قبل الموعد بثلاثين دقيقة مع صيام ٦ ساعات. الماء مسموح.",
          )
        : ARRIVE_15,
      documentsRequired: [NATIONAL_ID, REFERRAL],
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
        ? tx(
            "Drink one litre of water an hour before and arrive with a full bladder — the scan needs it.",
            "اشرب لترًا من الماء قبل الموعد بساعة واحضر والمثانة ممتلئة — الفحص يتطلب ذلك.",
          )
        : abdominal
          ? tx(
              "Fast for 6 hours beforehand so the bowel is clear. Water is allowed.",
              "صم ٦ ساعات قبل الفحص حتى تكون الأمعاء خالية. الماء مسموح.",
            )
          : ARRIVE_10,
      documentsRequired: [NATIONAL_ID],
    };
  }

  return {
    ...NO_PREP,
    arrivalInstructions: tx(
      `Arrive 15 minutes before your ${name}. No special preparation is needed.`,
      `احضر قبل موعد ${nameAr} بخمس عشرة دقيقة. لا يلزم أي تحضير خاص.`,
    ),
    documentsRequired: [NATIONAL_ID, REFERRAL],
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
