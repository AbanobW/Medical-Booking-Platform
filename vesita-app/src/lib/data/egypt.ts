import type { Governorate, InsurancePlan, Specialty } from "@/lib/types";

/**
 * Static Egyptian reference data: governorates, their areas, and the medical
 * taxonomy.
 *
 * Governorates are stored in a compact `en:ar` / `|`-delimited encoding and
 * expanded at module load. Coordinates are real approximate centroids, so the
 * map placeholder renders plausible relative positions.
 */

/** `[id, en, ar, lat, lng, "areaEn:areaAr|areaEn:areaAr|..."]` */
type RawGov = [string, string, string, number, number, string];

const RAW_GOVERNORATES: RawGov[] = [
  [
    "cairo",
    "Cairo",
    "القاهرة",
    30.0444,
    31.2357,
    "Nasr City:مدينة نصر|Heliopolis:مصر الجديدة|Maadi:المعادي|Zamalek:الزمالك|New Cairo:القاهرة الجديدة|Downtown:وسط البلد|Shubra:شبرا|Helwan:حلوان|Ain Shams:عين شمس|El Rehab:الرحاب|Madinaty:مدينتي|Sheraton:شيراتون",
  ],
  [
    "giza",
    "Giza",
    "الجيزة",
    30.0131,
    31.2089,
    "Mohandessin:المهندسين|Dokki:الدقي|Agouza:العجوزة|Haram:الهرم|Faisal:فيصل|6th of October:السادس من أكتوبر|Sheikh Zayed:الشيخ زايد|Imbaba:إمبابة|Boulaq Dakrour:بولاق الدكرور",
  ],
  [
    "alexandria",
    "Alexandria",
    "الإسكندرية",
    31.2001,
    29.9187,
    "Smouha:سموحة|Sidi Gaber:سيدي جابر|Roushdy:رشدي|Miami:ميامي|Stanley:ستانلي|Gleem:جليم|Montaza:المنتزه|Agami:العجمي|Sporting:سبورتنج|Kafr Abdo:كفر عبده",
  ],
  [
    "dakahlia",
    "Dakahlia",
    "الدقهلية",
    31.0409,
    31.3785,
    "Mansoura:المنصورة|Talkha:طلخا|Mit Ghamr:ميت غمر|Aga:أجا|Belqas:بلقاس|Sherbin:شربين|Dekernes:دكرنس",
  ],
  [
    "sharqia",
    "Sharqia",
    "الشرقية",
    30.5877,
    31.502,
    "Zagazig:الزقازيق|10th of Ramadan:العاشر من رمضان|Bilbeis:بلبيس|Abu Hammad:أبو حماد|Faqous:فاقوس|Minya al-Qamh:منيا القمح",
  ],
  [
    "gharbia",
    "Gharbia",
    "الغربية",
    30.8754,
    31.0335,
    "Tanta:طنطا|El Mahalla El Kubra:المحلة الكبرى|Kafr El Zayat:كفر الزيات|Zefta:زفتى|Samannoud:سمنود|Basyoun:بسيون",
  ],
  [
    "menoufia",
    "Menoufia",
    "المنوفية",
    30.5972,
    30.9876,
    "Shebin El Kom:شبين الكوم|Menouf:منوف|Sadat City:مدينة السادات|Ashmoun:أشمون|Quesna:قويسنا|Berket El Sabaa:بركة السبع",
  ],
  [
    "qalyubia",
    "Qalyubia",
    "القليوبية",
    30.4595,
    31.1787,
    "Banha:بنها|Shubra El Kheima:شبرا الخيمة|Qalyub:قليوب|Khanka:الخانكة|Qaha:قها|Toukh:طوخ",
  ],
  [
    "assiut",
    "Assiut",
    "أسيوط",
    27.1809,
    31.1837,
    "Assiut City:مدينة أسيوط|Dairut:ديروط|Manfalut:منفلوط|Abnub:أبنوب|El Qusiya:القوصية|Sahel Selim:ساحل سليم",
  ],
  [
    "sohag",
    "Sohag",
    "سوهاج",
    26.5591,
    31.6957,
    "Sohag City:مدينة سوهاج|Akhmim:أخميم|Girga:جرجا|Tahta:طهطا|El Balyana:البلينا|Maragha:المراغة",
  ],
];

export const GOVERNORATES: Governorate[] = RAW_GOVERNORATES.map(
  ([id, name, nameAr, lat, lng, areasRaw]) => ({
    id,
    name,
    nameAr,
    lat,
    lng,
    areas: areasRaw.split("|").map((chunk) => {
      const [areaName, areaNameAr] = chunk.split(":");
      return {
        id: `${id}-${slugify(areaName)}`,
        name: areaName,
        nameAr: areaNameAr,
        governorateId: id,
      };
    }),
  }),
);

export const ALL_AREAS = GOVERNORATES.flatMap((g) => g.areas);

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getGovernorate(id: string): Governorate | undefined {
  return GOVERNORATES.find((g) => g.id === id);
}

export function getGovernorateName(id: string): string {
  return getGovernorate(id)?.name ?? "Unknown";
}

export function getAreasFor(governorateId: string) {
  return getGovernorate(governorateId)?.areas ?? [];
}

export function getAreaName(id: string): string {
  return ALL_AREAS.find((a) => a.id === id)?.name ?? "Unknown";
}

// ---------------------------------------------------------------------------
// Specialties
// ---------------------------------------------------------------------------

/** `[id, en, ar, lucideIcon, descriptionEn, descriptionAr]` — doctorCount is filled by the seed. */
type RawSpecialty = [string, string, string, string, string, string];

const RAW_SPECIALTIES: RawSpecialty[] = [
  ["cardiology", "Cardiology", "قلب وأوعية دموية", "HeartPulse", "Heart, blood pressure and vascular conditions.", "أمراض القلب وضغط الدم والأوعية الدموية."],
  ["dermatology", "Dermatology", "جلدية", "Sparkles", "Skin, hair, nails, laser and cosmetic care.", "الجلد والشعر والأظافر والليزر والتجميل."],
  ["dentistry", "Dentistry", "أسنان", "Smile", "Dental care, orthodontics and oral surgery.", "علاج الأسنان والتقويم وجراحة الفم."],
  ["pediatrics", "Pediatrics", "أطفال وحديثي الولادة", "Baby", "Newborn, child and adolescent health.", "صحة حديثي الولادة والأطفال والمراهقين."],
  ["orthopedics", "Orthopedics", "عظام", "Bone", "Bones, joints, spine and sports injuries.", "العظام والمفاصل والعمود الفقري وإصابات الملاعب."],
  ["gynecology", "Gynecology & Obstetrics", "نساء وتوليد", "Venus", "Women's health, fertility and pregnancy.", "صحة المرأة والخصوبة ومتابعة الحمل."],
  ["neurology", "Neurology", "مخ وأعصاب", "Brain", "Brain, spine and nervous system disorders.", "أمراض المخ والعمود الفقري والجهاز العصبي."],
  ["psychiatry", "Psychiatry", "طب نفسي", "BrainCircuit", "Mental health, anxiety, depression and therapy.", "الصحة النفسية والقلق والاكتئاب والعلاج النفسي."],
  ["ophthalmology", "Ophthalmology", "رمد وعيون", "Eye", "Vision, retina, cataract and LASIK.", "الإبصار والشبكية والمياه البيضاء والليزك."],
  ["ent", "ENT", "أنف وأذن وحنجرة", "Ear", "Ear, nose, throat, sinus and hearing.", "الأذن والأنف والحنجرة والجيوب الأنفية والسمع."],
  ["internal-medicine", "Internal Medicine", "باطنة", "Stethoscope", "General adult medicine and chronic disease.", "الطب العام للبالغين والأمراض المزمنة."],
  ["urology", "Urology", "مسالك بولية", "Droplet", "Kidney, bladder and male reproductive health.", "الكلى والمثانة وصحة الجهاز التناسلي للرجال."],
  ["gastroenterology", "Gastroenterology", "جهاز هضمي ومناظير", "Pill", "Digestive system, liver and endoscopy.", "الجهاز الهضمي والكبد والمناظير."],
  ["endocrinology", "Endocrinology & Diabetes", "غدد صماء وسكر", "Activity", "Diabetes, thyroid and hormonal disorders.", "السكري والغدة الدرقية واضطرابات الهرمونات."],
  ["pulmonology", "Pulmonology", "صدر وجهاز تنفسي", "Wind", "Chest, lungs, asthma and allergy.", "الصدر والرئتين والربو والحساسية."],
  ["nutrition", "Nutrition", "تغذية علاجية", "Apple", "Weight management and clinical nutrition.", "إنقاص الوزن والتغذية العلاجية."],
  ["physiotherapy", "Physiotherapy", "علاج طبيعي", "Dumbbell", "Rehabilitation, pain and mobility therapy.", "إعادة التأهيل وعلاج الألم واستعادة الحركة."],
  ["oncology", "Oncology", "أورام", "Ribbon", "Cancer screening, treatment and follow-up.", "الكشف المبكر عن الأورام وعلاجها ومتابعتها."],
  ["rheumatology", "Rheumatology", "روماتيزم ومناعة", "Hand", "Arthritis, autoimmune and joint pain.", "الروماتيزم وأمراض المناعة وآلام المفاصل."],
  ["nephrology", "Nephrology", "كلى", "Filter", "Kidney disease, dialysis and hypertension.", "أمراض الكلى والغسيل الكلوي وارتفاع الضغط."],
  ["vascular-surgery", "Vascular Surgery", "جراحة أوعية دموية", "Network", "Varicose veins and arterial disease.", "دوالي الساقين وأمراض الشرايين."],
  ["general-surgery", "General Surgery", "جراحة عامة", "Scissors", "Hernia, gallbladder and laparoscopic surgery.", "الفتق والمرارة وجراحات المناظير."],
  ["allergy", "Allergy & Immunology", "حساسية ومناعة", "Flower2", "Allergy testing and immune disorders.", "اختبارات الحساسية وأمراض المناعة."],
  ["andrology", "Andrology", "ذكورة وعقم", "Mars", "Male fertility and sexual health.", "خصوبة الرجال والصحة الجنسية."],
];

export const SPECIALTIES: Specialty[] = RAW_SPECIALTIES.map(
  ([id, name, nameAr, icon, description, descriptionAr]) => ({
    id,
    name,
    nameAr,
    icon,
    description: { en: description, ar: descriptionAr },
    doctorCount: 0, // populated by the seed once doctors are generated
  }),
);

export function getSpecialty(id: string): Specialty | undefined {
  return SPECIALTIES.find((s) => s.id === id);
}

export function getSpecialtyName(id: string): string {
  return getSpecialty(id)?.name ?? "General Practice";
}

// ---------------------------------------------------------------------------
// Subspecialties (§4 — a search filter that narrows within a specialty)
// ---------------------------------------------------------------------------

export const SUBSPECIALTIES: Record<string, string[]> = {
  cardiology: ["Interventional Cardiology", "Heart Failure", "Electrophysiology", "Echocardiography", "Preventive Cardiology"],
  dermatology: ["Cosmetic Dermatology", "Laser Therapy", "Hair & Scalp", "Pediatric Dermatology", "Skin Cancer Screening"],
  dentistry: ["Orthodontics", "Endodontics", "Oral Surgery", "Cosmetic Dentistry", "Pediatric Dentistry"],
  pediatrics: ["Neonatology", "Pediatric Cardiology", "Pediatric Neurology", "Child Nutrition", "Vaccinations"],
  orthopedics: ["Sports Injuries", "Spine Surgery", "Joint Replacement", "Hand Surgery", "Pediatric Orthopedics"],
  gynecology: ["Fertility & IVF", "High-Risk Pregnancy", "Laparoscopic Surgery", "Menopause Care", "Ultrasound & Fetal Medicine"],
  neurology: ["Epilepsy", "Stroke Care", "Movement Disorders", "Headache & Migraine", "Neuromuscular Disease"],
  psychiatry: ["Anxiety & Depression", "Child Psychiatry", "Addiction Medicine", "Cognitive Behavioural Therapy", "Sleep Disorders"],
  ophthalmology: ["LASIK & Refractive", "Retina", "Cataract Surgery", "Glaucoma", "Pediatric Ophthalmology"],
  ent: ["Sinus Surgery", "Hearing & Audiology", "Voice & Throat", "Snoring & Sleep Apnea", "Pediatric ENT"],
  "internal-medicine": ["Chronic Disease Management", "Preventive Care", "Geriatric Medicine", "Infectious Disease", "Second Opinions"],
  urology: ["Kidney Stones", "Prostate Care", "Male Infertility", "Urologic Oncology", "Pediatric Urology"],
  gastroenterology: ["Endoscopy", "Liver Disease", "Inflammatory Bowel Disease", "Colonoscopy", "Pancreatic Disease"],
  endocrinology: ["Diabetes Management", "Thyroid Disorders", "Obesity Medicine", "Adrenal & Pituitary", "Bone Metabolism"],
  pulmonology: ["Asthma & Allergy", "Sleep Medicine", "COPD", "Bronchoscopy", "Respiratory Infections"],
  nutrition: ["Weight Management", "Sports Nutrition", "Clinical Nutrition", "Pediatric Nutrition", "Diabetic Diets"],
  physiotherapy: ["Sports Rehabilitation", "Post-Surgical Rehab", "Neurological Rehab", "Manual Therapy", "Pain Management"],
  oncology: ["Breast Cancer", "Chemotherapy", "Radiation Oncology", "Cancer Screening", "Palliative Care"],
  rheumatology: ["Rheumatoid Arthritis", "Lupus & Autoimmune", "Osteoporosis", "Gout", "Pediatric Rheumatology"],
  nephrology: ["Dialysis", "Kidney Transplant", "Hypertension", "Glomerular Disease", "Electrolyte Disorders"],
  "vascular-surgery": ["Varicose Veins", "Arterial Disease", "Diabetic Foot", "Aneurysm Repair", "Dialysis Access"],
  "general-surgery": ["Laparoscopic Surgery", "Hernia Repair", "Gallbladder Surgery", "Bariatric Surgery", "Breast Surgery"],
  allergy: ["Food Allergy", "Respiratory Allergy", "Immunotherapy", "Skin Allergy", "Drug Allergy"],
  andrology: ["Male Infertility", "Erectile Dysfunction", "Hormonal Therapy", "Microsurgery", "Sexual Health"],
};

export function getSubSpecialtiesFor(specialtyId: string): string[] {
  return SUBSPECIALTIES[specialtyId] ?? [];
}

/** Every subspecialty across the taxonomy, de-duplicated and sorted. */
export const ALL_SUBSPECIALTIES: string[] = [
  ...new Set(Object.values(SUBSPECIALTIES).flat()),
].sort((a, b) => a.localeCompare(b));

// ---------------------------------------------------------------------------
// Insurance networks (§14 — future phase)
//
// The Egyptian networks the platform will support when insurance ships. The
// data model carries them now so switching the phase on needs no migration.
// ---------------------------------------------------------------------------

export const INSURANCE_PLANS: InsurancePlan[] = [
  { id: "axa", name: "AXA", nameAr: "أكسا" },
  { id: "mednet", name: "MedNet", nameAr: "ميدنت" },
  { id: "bupa", name: "Bupa", nameAr: "بوبا" },
  { id: "metlife", name: "MetLife", nameAr: "ميتلايف" },
  { id: "allianz", name: "Allianz", nameAr: "أليانز" },
  { id: "globemed", name: "GlobeMed", nameAr: "جلوب ميد" },
];

export function getInsurancePlanName(id: string): string {
  return INSURANCE_PLANS.find((p) => p.id === id)?.name ?? id;
}

// ---------------------------------------------------------------------------
// Service catalogues
// ---------------------------------------------------------------------------

/** `[en, ar, category, basePrice, resultHours, fastingRequired]` */
export type RawTest = [string, string, string, number, number, boolean];

export const LAB_TEST_CATALOG: RawTest[] = [
  ["Complete Blood Count (CBC)", "صورة دم كاملة", "Hematology", 120, 6, false],
  ["Fasting Blood Sugar", "سكر صائم", "Diabetes", 60, 4, true],
  ["HbA1c", "السكر التراكمي", "Diabetes", 220, 12, false],
  ["Lipid Profile", "دهون الدم", "Cardiac", 250, 12, true],
  ["Liver Function Tests", "وظائف الكبد", "Chemistry", 280, 12, true],
  ["Kidney Function Tests", "وظائف الكلى", "Chemistry", 240, 12, true],
  ["Thyroid Profile (TSH, T3, T4)", "وظائف الغدة الدرقية", "Hormones", 380, 24, false],
  ["Vitamin D (25-OH)", "فيتامين د", "Vitamins", 420, 24, false],
  ["Vitamin B12", "فيتامين ب12", "Vitamins", 350, 24, false],
  ["Serum Iron & Ferritin", "الحديد والفيريتين", "Hematology", 300, 24, true],
  ["Urine Analysis", "تحليل بول", "Microbiology", 90, 6, false],
  ["Stool Analysis", "تحليل براز", "Microbiology", 90, 6, false],
  ["C-Reactive Protein (CRP)", "بروتين سي التفاعلي", "Immunology", 180, 8, false],
  ["ESR", "سرعة الترسيب", "Hematology", 80, 4, false],
  ["Uric Acid", "حمض البوليك", "Chemistry", 90, 6, true],
  ["PCR COVID-19", "تحليل كورونا", "Virology", 600, 24, false],
  ["Hepatitis B Surface Antigen", "الالتهاب الكبدي ب", "Virology", 200, 24, false],
  ["Hepatitis C Antibody", "الالتهاب الكبدي سي", "Virology", 220, 24, false],
  ["Pregnancy Test (Beta HCG)", "تحليل حمل", "Hormones", 180, 6, false],
  ["Prolactin", "البرولاكتين", "Hormones", 260, 24, true],
  ["Testosterone", "هرمون الذكورة", "Hormones", 320, 24, true],
  ["PSA (Prostate)", "دلالات البروستاتا", "Tumor Markers", 400, 24, false],
  ["Semen Analysis", "تحليل السائل المنوي", "Andrology", 350, 24, false],
  ["Coagulation Profile (PT/PTT/INR)", "سيولة الدم", "Hematology", 260, 8, false],
  ["Electrolytes (Na, K, Ca)", "أملاح الدم", "Chemistry", 200, 6, false],
  ["Food Intolerance Panel", "تحليل حساسية الطعام", "Immunology", 1800, 72, false],
];

/** `[en, ar, category, basePrice, durationMinutes, contrastRequired]` */
export type RawScan = [string, string, string, number, number, boolean];

export const RADIOLOGY_SCAN_CATALOG: RawScan[] = [
  ["Chest X-Ray", "أشعة عادية على الصدر", "X-Ray", 150, 10, false],
  ["Bone X-Ray", "أشعة عادية على العظام", "X-Ray", 150, 10, false],
  ["Abdominal Ultrasound", "سونار على البطن", "Ultrasound", 300, 20, false],
  ["Pelvic Ultrasound", "سونار على الحوض", "Ultrasound", 300, 20, false],
  ["Obstetric Ultrasound (4D)", "سونار رباعي الأبعاد للحمل", "Ultrasound", 650, 30, false],
  ["Thyroid Ultrasound", "سونار على الغدة الدرقية", "Ultrasound", 350, 20, false],
  ["Echocardiography", "إيكو على القلب", "Ultrasound", 700, 30, false],
  ["Carotid Doppler", "دوبلر على شرايين الرقبة", "Doppler", 800, 30, false],
  ["Lower Limb Venous Doppler", "دوبلر على أوردة الساق", "Doppler", 850, 40, false],
  ["CT Brain", "أشعة مقطعية على المخ", "CT Scan", 1200, 20, false],
  ["CT Chest", "أشعة مقطعية على الصدر", "CT Scan", 1400, 20, false],
  ["CT Abdomen & Pelvis with Contrast", "مقطعية بطن وحوض بالصبغة", "CT Scan", 2200, 40, true],
  ["MRI Brain", "رنين مغناطيسي على المخ", "MRI", 2400, 45, false],
  ["MRI Lumbar Spine", "رنين على الفقرات القطنية", "MRI", 2300, 45, false],
  ["MRI Knee", "رنين على الركبة", "MRI", 2100, 40, false],
  ["MRI Abdomen with Contrast", "رنين على البطن بالصبغة", "MRI", 2900, 60, true],
  ["Mammography", "أشعة على الثدي", "Mammography", 900, 25, false],
  ["DEXA Bone Density", "قياس كثافة العظام", "DEXA", 700, 25, false],
  ["Panoramic Dental X-Ray", "أشعة بانوراما للأسنان", "X-Ray", 250, 15, false],
  ["Barium Swallow", "أشعة بالصبغة على المرئ", "Fluoroscopy", 800, 40, true],
];

/** Doctor consultation offerings, applied to every doctor. */
export const CONSULTATION_TEMPLATES = [
  {
    name: "In-Clinic Consultation",
    nameAr: "كشف في العيادة",
    description: "Face-to-face examination at the clinic.",
    descriptionAr: "كشف مباشر داخل العيادة.",
    durationMinutes: 30,
    priceFactor: 1,
  },
  {
    name: "Follow-Up Visit",
    nameAr: "إعادة كشف",
    description: "Discounted revisit within 14 days of your first consultation.",
    descriptionAr: "إعادة كشف بسعر مخفّض خلال ١٤ يومًا من الكشف الأول.",
    durationMinutes: 20,
    priceFactor: 0.5,
  },
  {
    name: "Video Consultation",
    nameAr: "استشارة بالفيديو",
    description: "Secure online video call from anywhere in Egypt.",
    descriptionAr: "مكالمة فيديو آمنة من أي مكان في مصر.",
    durationMinutes: 25,
    priceFactor: 0.8,
  },
  {
    name: "Home Visit",
    nameAr: "زيارة منزلية",
    description: "The doctor comes to your home. Travel fee included.",
    descriptionAr: "الطبيب يزورك في منزلك، وسعر الانتقال مشمول.",
    durationMinutes: 45,
    priceFactor: 2.2,
  },
] as const;

/**
 * Arabic for the service-catalogue grouping keys (`LabTest.category`,
 * `RadiologyScan.category`). The English string stays the identifier — this maps
 * it for display only. Mirrored into the `domain.serviceCategory` messages;
 * keep the two in step.
 */
export const SERVICE_CATEGORIES_AR: Record<string, string> = {
  Hematology: "أمراض الدم",
  Diabetes: "السكري",
  Cardiac: "القلب",
  Chemistry: "الكيمياء الحيوية",
  Hormones: "الهرمونات",
  Vitamins: "الفيتامينات",
  Microbiology: "الميكروبيولوجي",
  Immunology: "المناعة",
  Virology: "الفيروسات",
  "Tumor Markers": "دلالات الأورام",
  Andrology: "الذكورة",
  "X-Ray": "أشعة عادية",
  Ultrasound: "الموجات فوق الصوتية",
  "CT Scan": "أشعة مقطعية",
  MRI: "رنين مغناطيسي",
  Mammography: "أشعة الثدي",
  DEXA: "قياس كثافة العظام",
  Doppler: "دوبلر",
  Fluoroscopy: "أشعة تليفزيونية",
};

/** Arabic for the four doctor titles in `names.ts`. Display-only, as above. */
export const DOCTOR_TITLES_AR: Record<string, string> = {
  "Professor Doctor": "أستاذ دكتور",
  Consultant: "استشاري",
  Specialist: "أخصائي",
  "Lecturer Doctor": "مدرس دكتور",
};
