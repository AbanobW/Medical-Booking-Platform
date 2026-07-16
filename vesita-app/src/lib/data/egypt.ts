import type { Governorate, Specialty } from "@/lib/types";

/**
 * Static Egyptian reference data: governorates, their areas, and the medical
 * taxonomy.
 *
 * **This is a lookup table, not a dataset.** It holds no records about anyone —
 * no doctors, no prices, no availability. It exists because MedPoint has no
 * geography or taxonomy endpoint, yet answers in their vocabulary: a branch
 * arrives as `governorate: "Cairo", area: "Maadi"` and a doctor as
 * `"Dr. X — Cardiology"`. These tables are how those strings are resolved to
 * ids the app can filter on, and how a filter menu is populated at all. Delete
 * them and search loses its facets; nothing gains accuracy.
 *
 * It is also where fabricated content used to hide, so keep the line clear. The
 * invented lab-test and scan catalogues (with invented prices), the
 * consultation templates and the subspecialty taxonomy all lived here as seed
 * input and are gone. Nothing here may describe a provider, a price or a
 * service — only the vocabulary the API already speaks.
 *
 * Governorates are stored in a compact `en:ar` / `|`-delimited encoding and
 * expanded at module load. Coordinates are approximate real centroids, used to
 * order "nearest" and to place the map — a governorate's centre, never a
 * provider's position.
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

/** `[id, en, ar, lucideIcon, descriptionEn, descriptionAr]` */
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
  }),
);

export function getSpecialty(id: string): Specialty | undefined {
  return SPECIALTIES.find((s) => s.id === id);
}

export function getSpecialtyName(id: string): string {
  return getSpecialty(id)?.name ?? "General Practice";
}

// Insurance plans are NOT here. This used to hardcode 6 networks (AXA, MedNet,
// Bupa, MetLife, Allianz, GlobeMed) as a stand-in for the insurance phase (§14)
// — but `/v1/insurances` is real and already lists 13 actual plans, so a local
// duplicate is exactly the kind of stale data this file exists to not contain.
// See `@/lib/api/medpoint/insurance#getInsurancePlans`.
