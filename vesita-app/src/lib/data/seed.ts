import {
  CONSULTATION_TEMPLATES,
  DOCTOR_TITLES_AR,
  GOVERNORATES,
  INSURANCE_PLANS,
  LAB_TEST_CATALOG,
  RADIOLOGY_SCAN_CATALOG,
  SERVICE_CATEGORIES_AR,
  SPECIALTIES,
  getSubSpecialtiesFor,
  slugify,
} from "@/lib/data/egypt";
import {
  CHRONIC_CONDITIONS,
  eligibilityForScan,
  eligibilityForTest,
  preparationForScan,
  preparationForTest,
} from "@/lib/data/clinical";
import { BUSINESS } from "@/lib/site";
import {
  CANCELLATION_REASONS,
  CLINIC_SUFFIXES,
  DEGREES,
  DOCTOR_TITLES,
  FEMALE_FIRST,
  LAB_ACCREDITATIONS,
  LAB_BRANDS,
  LANGUAGES,
  LAST_NAMES,
  MALE_FIRST,
  RADIOLOGY_BRANDS,
  REVIEW_COMMENTS_MIXED,
  REVIEW_COMMENTS_NEGATIVE,
  REVIEW_COMMENTS_POSITIVE,
  STREETS,
} from "@/lib/data/names";
import { createRng, type Rng } from "@/lib/data/random";
import {
  consumesCapacity,
  isCancelled,
  requiresAcknowledgement,
  schedulingModeFor,
  type AppNotification,
  type Booking,
  type BookingStatus,
  type Branch,
  type CapacityType,
  type CashbackCampaign,
  type CommissionSettings,
  type ConsultationType,
  type Coupon,
  type DaySchedule,
  type Doctor,
  type Favorite,
  type Gender,
  type Holiday,
  type Lab,
  type LabTest,
  type NotificationChannel,
  type LocalizedText,
  type NotificationKind,
  type PatientProfile,
  type PaymentMethod,
  type PaymentStatus,
  type Provider,
  type ProviderRole,
  type ProviderStatus,
  type RadiologyCenter,
  type RadiologyScan,
  type Review,
  type SchedulingMode,
  type ServicePackage,
  type SuspensionType,
  type User,
  type Weekday,
} from "@/lib/types";

const SEED = 20260713;

/**
 * Anchor date for all generated timestamps.
 *
 * Deliberately a *fixed* date rather than `new Date()`: the dataset must be
 * identical on the server and the client or React hydration would mismatch.
 * `TODAY` is what the whole app treats as "now".
 */
export const TODAY = new Date("2026-07-13T09:00:00.000Z");

export function todayISO(): string {
  return toISODate(TODAY);
}

export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function isoAt(dayOffset: number, hour = 10): string {
  const d = addDays(TODAY, dayOffset);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
}

function avatarUrl(seed: string, name: string): string {
  return `/api/avatar?seed=${encodeURIComponent(seed)}&name=${encodeURIComponent(name)}`;
}

function coverUrl(seed: string): string {
  return `/api/cover?seed=${encodeURIComponent(seed)}`;
}

function egyptPhone(rng: Rng): string {
  const prefix = rng.pick(["010", "011", "012", "015"]);
  let rest = "";
  for (let i = 0; i < 8; i++) rest += rng.int(0, 9);
  return `${prefix}${rest}`;
}

/**
 * A person's name in both scripts.
 *
 * Still exactly two `rng.pick` draws — the pair comes out of one entry — so the
 * generated dataset is unchanged from before the Arabic column was added.
 */
function personName(rng: Rng, gender: Gender): LocalizedText {
  const [firstEn, firstAr] = rng.pick(
    gender === "male" ? MALE_FIRST : FEMALE_FIRST,
  );
  const [lastEn, lastAr] = rng.pick(LAST_NAMES);

  return { en: `${firstEn} ${lastEn}`, ar: `${firstAr} ${lastAr}` };
}

/** Jitters a governorate centroid so pins spread across a plausible city area. */
function jitterLocation(rng: Rng, govId: string) {
  const gov = GOVERNORATES.find((g) => g.id === govId)!;
  return {
    lat: +(gov.lat + rng.float(-0.08, 0.08, 4)).toFixed(4),
    lng: +(gov.lng + rng.float(-0.08, 0.08, 4)).toFixed(4),
  };
}

/**
 * A weekly schedule with capacity.
 *
 * Doctors run *sessions* under a comfort limit — they can nearly always see one
 * more patient, it just means a longer evening. Radiology is mostly *strict*:
 * a machine can only do so many scans in a session, and that is a physical wall.
 */
function buildSchedule(rng: Rng, mode: SchedulingMode, type: ProviderRole): DaySchedule[] {
  const strictChance = type === "radiology" ? 0.8 : type === "lab" ? 0.45 : 0.12;
  const capacityType: CapacityType = rng.bool(strictChance) ? "strict" : "comfort";

  // Friday (5) is the common day off in Egypt; Saturday is often a half day.
  return ([0, 1, 2, 3, 4, 5, 6] as Weekday[]).map((weekday) => {
    const isWorkingDay = weekday === 5 ? rng.bool(0.15) : rng.bool(0.9);
    const startHour = rng.pick([9, 10, 11, 12, 16]);
    const length = rng.int(5, 8);
    return {
      weekday,
      isWorkingDay,
      startTime: `${String(startHour).padStart(2, "0")}:00`,
      endTime: `${String(Math.min(startHour + length, 23)).padStart(2, "0")}:00`,
      slotDurationMinutes: rng.pick([15, 20, 30]),
      breaks: rng.bool(0.5)
        ? [{ startTime: "13:00", endTime: "14:00" }]
        : [],
      // A session holds many patients; a slot holds one or two.
      capacity: mode === "session" ? rng.int(10, 28) : rng.int(1, 3),
      capacityType,
    };
  });
}

/**
 * Branches are independent operating units (§2): each keeps its own schedule,
 * its own subset of the provider's services, and its own pricing.
 */
function buildBranches(
  rng: Rng,
  provider: {
    id: string;
    type: ProviderRole;
    governorateId: string;
    schedule: DaySchedule[];
  },
  brandName: string,
  serviceIds: string[],
  count: number,
): Branch[] {
  const homeGovId = provider.governorateId;
  const mode = schedulingModeFor(provider.type);

  const govPool = rng.shuffle(
    GOVERNORATES.map((g) => g.id).filter((id) => id !== homeGovId),
  );

  return Array.from({ length: count }, (_, i) => {
    // The first branch is always the provider's home location.
    const govId = i === 0 ? homeGovId : govPool[i - 1];
    const gov = GOVERNORATES.find((g) => g.id === govId)!;
    const area = rng.pick(gov.areas);

    // A service offered at one branch may not exist at another — the main
    // branch carries everything, satellites carry a subset.
    const offered =
      i === 0
        ? serviceIds
        : rng.sample(
            serviceIds,
            Math.max(1, Math.round(serviceIds.length * rng.float(0.6, 1, 2))),
          );

    // Branch-specific pricing: the same service costs differently by branch.
    const priceOverrides: Record<string, number> = {};

    return {
      id: `${provider.id}-br-${i + 1}`,
      providerId: provider.id,
      name:
        provider.type === "doctor"
          ? `${brandName} — ${area.name}`
          : `${brandName} — ${area.name}`,
      governorateId: govId,
      areaId: area.id,
      address: `${rng.int(1, 220)} ${rng.pick(STREETS)}, ${area.name}, ${gov.name}`,
      phone: egyptPhone(rng),
      location: jitterLocation(rng, govId),
      openingHours: rng.pick([
        "Daily 8:00 AM – 10:00 PM",
        "Sat–Thu 9:00 AM – 9:00 PM",
        "Daily 7:00 AM – 11:00 PM",
        "Sat–Thu 8:00 AM – 8:00 PM · Fri closed",
      ]),
      // The main branch keeps the provider's hours; satellites run their own.
      schedule: i === 0 ? provider.schedule : buildSchedule(rng, mode, provider.type),
      serviceIds: offered,
      priceOverrides,
      isActive: true,
    };
  });
}

/** Prices a branch's services, jittering them off the provider-level price. */
function applyBranchPricing(
  rng: Rng,
  branches: Branch[],
  services: { id: string; price: number }[],
): void {
  const priceOf = new Map(services.map((s) => [s.id, s.price]));

  branches.forEach((branch, index) => {
    // The home branch is the reference price; satellites vary around it.
    if (index === 0) return;

    for (const serviceId of branch.serviceIds) {
      const base = priceOf.get(serviceId);
      if (base === undefined) continue;
      if (!rng.bool(0.55)) continue;

      branch.priceOverrides[serviceId] =
        Math.round((base * rng.float(0.85, 1.25, 2)) / 5) * 5;
    }
  });
}

/** Which insurance networks a provider accepts. Reserved for §14. */
function pickInsurancePlans(rng: Rng): string[] {
  if (!rng.bool(0.65)) return [];
  return rng.sample(INSURANCE_PLANS, rng.int(1, 4)).map((p) => p.id);
}

function pickStatus(rng: Rng): ProviderStatus {
  return rng.weighted<ProviderStatus>(
    ["approved", "pending", "rejected", "suspended"],
    [82, 9, 4, 5],
  );
}

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

function generateDoctors(rng: Rng, count: number): Doctor[] {
  return Array.from({ length: count }, (_, i) => {
    const id = `doc-${String(i + 1).padStart(3, "0")}`;
    const gender: Gender = rng.bool(0.6) ? "male" : "female";
    const name = personName(rng, gender);
    const specialty = rng.pick(SPECIALTIES);
    const gov = rng.weighted(
      GOVERNORATES,
      // Cairo/Giza/Alex hold most of the real supply.
      [30, 22, 16, 6, 5, 5, 4, 5, 4, 3],
    );
    const area = rng.pick(gov.areas);
    const experience = rng.int(3, 32);
    const basePrice = rng.pick([150, 200, 250, 300, 350, 400, 450, 500, 600, 700, 800]);

    const consultationTypes: ConsultationType[] = CONSULTATION_TEMPLATES.map(
      (tpl, idx) => ({
        id: `${id}-cons-${idx + 1}`,
        kind: "consultation" as const,
        name: tpl.name,
        nameAr: tpl.nameAr,
        description: { en: tpl.description, ar: tpl.descriptionAr },
        price: Math.round((basePrice * tpl.priceFactor) / 10) * 10,
        durationMinutes: tpl.durationMinutes,
        // Everyone offers in-clinic; the rest vary.
        isActive: idx === 0 ? true : rng.bool(0.6),
      }),
    );

    const reviewCount = rng.int(4, 320);
    const schedule = buildSchedule(rng, "session", "doctor");
    const clinicName = `${name.en.split(" ")[0]} ${rng.pick(CLINIC_SUFFIXES)}`;

    // A doctor may operate in a single clinic or across several, and is
    // bookable at each (§2).
    const branches = buildBranches(
      rng,
      { id, type: "doctor", governorateId: gov.id, schedule },
      clinicName,
      consultationTypes.map((c) => c.id),
      rng.weighted([1, 2, 3], [55, 30, 15]),
    );
    applyBranchPricing(rng, branches, consultationTypes);

    // Hoisted out of the object literal only so both languages can share the
    // same draw. It stays the next `rng` call in sequence, so the generated
    // dataset is byte-for-byte what it was before — the seed is deterministic
    // and server/client hydration depends on that.
    const bioTitle = rng.pick(DOCTOR_TITLES);

    return {
      id,
      type: "doctor" as const,
      slug: `${slugify(name.en)}-${id}`,
      name: `Dr. ${name.en}`,
      nameAr: `د. ${name.ar}`,
      photo: avatarUrl(id, name.en),
      coverImage: coverUrl(id),
      bio: {
        en:
          `${bioTitle} of ${specialty.name} with ${experience} years of clinical ` +
          `experience in ${gov.name}. Specialised in ${specialty.description.en.toLowerCase().replace(/\.$/, "")}. ` +
          `Committed to evidence-based care and clear communication with every patient.`,
        ar:
          `${DOCTOR_TITLES_AR[bioTitle] ?? bioTitle} ${specialty.nameAr} بخبرة ${experience} عامًا ` +
          `في ${gov.nameAr}. متخصص في ${specialty.description.ar.replace(/\.$/, "")}. ` +
          `يلتزم بالرعاية القائمة على الأدلة والتواصل الواضح مع كل مريض.`,
      },
      title: rng.pick(DOCTOR_TITLES),
      specialtyId: specialty.id,
      // Real subspecialties drawn from the doctor's own specialty, so the
      // subspecialty filter (§4) narrows within a specialty rather than across.
      subSpecialties: rng.sample(
        getSubSpecialtiesFor(specialty.id),
        rng.int(1, 3),
      ),
      gender,
      yearsOfExperience: experience,
      degrees: rng.sample(DEGREES, rng.int(2, 4)),
      languages: ["Arabic", ...rng.sample(LANGUAGES.slice(1), rng.int(1, 2))],
      clinicName,
      consultationTypes,
      branches,
      acceptedInsurancePlanIds: pickInsurancePlans(rng),
      rating: rng.float(3.4, 5, 1),
      reviewCount,
      price: consultationTypes[0].price,
      governorateId: gov.id,
      areaId: area.id,
      address: `${rng.int(1, 220)} ${rng.pick(STREETS)}, ${area.name}, ${gov.name}`,
      location: jitterLocation(rng, gov.id),
      phone: egyptPhone(rng),
      status: pickStatus(rng),
      isFeatured: rng.bool(0.22),
      bookingCount: reviewCount * rng.int(3, 9),
      waitingTimeMinutes: rng.pick([10, 15, 20, 30, 45, 60]),
      joinedAt: isoAt(-rng.int(30, 1200)),
      schedule,
    };
  });
}

function generateLabs(rng: Rng, count: number): Lab[] {
  return Array.from({ length: count }, (_, i) => {
    const id = `lab-${String(i + 1).padStart(3, "0")}`;
    const brand = LAB_BRANDS[i % LAB_BRANDS.length];
    const gov = rng.weighted(GOVERNORATES, [28, 20, 16, 7, 6, 6, 5, 5, 4, 3]);
    const area = rng.pick(gov.areas);

    const tests: LabTest[] = rng
      .sample(LAB_TEST_CATALOG, rng.int(14, LAB_TEST_CATALOG.length))
      .map(([name, nameAr, category, base, hours, fasting], idx) => ({
        id: `${id}-test-${idx + 1}`,
        kind: "test" as const,
        name,
        nameAr,
        category,
        description: {
          en: `${name} performed on calibrated analysers with a ${hours}-hour turnaround.`,
          ar: `${nameAr} على أجهزة تحليل مُعايرة، وتظهر النتيجة خلال ${hours} ساعة.`,
        },
        // Each lab prices the catalogue a little differently.
        price: Math.round((base * rng.float(0.8, 1.35, 2)) / 5) * 5,
        resultTimeHours: hours,
        fastingRequired: fasting,
        // §3 — what the patient must do beforehand, and who may book at all.
        preparation: preparationForTest(name, nameAr, category, fasting),
        eligibility: eligibilityForTest(name, category),
        isActive: rng.bool(0.92),
      }));

    const packages = buildPackages(rng, id, tests, [
      [
        "Full Body Checkup",
        "الفحص الشامل",
        "A complete annual screen covering blood, sugar, lipids and organ function.",
        "فحص سنوي شامل يغطي الدم والسكر والدهون ووظائف الأعضاء.",
      ],
      [
        "Diabetes Care Panel",
        "باقة متابعة السكري",
        "Everything needed to monitor and control blood sugar.",
        "كل ما تحتاجه لمتابعة نسبة السكر في الدم والسيطرة عليها.",
      ],
      [
        "Women's Wellness Package",
        "باقة صحة المرأة",
        "Hormones, vitamins and anaemia screening tailored for women.",
        "فحص الهرمونات والفيتامينات والأنيميا مصمم خصيصًا للسيدات.",
      ],
      [
        "Pre-Marriage Screening",
        "فحص ما قبل الزواج",
        "The standard pre-marital panel accepted across Egypt.",
        "الفحص المعتمد لما قبل الزواج والمقبول في جميع أنحاء مصر.",
      ],
    ]);

    const reviewCount = rng.int(10, 260);
    const cheapest = Math.min(...tests.map((t) => t.price));
    const schedule = buildSchedule(rng, "slot", "lab");

    // A laboratory typically has many branches (§2).
    const bookable = [...tests, ...packages];
    const branches = buildBranches(
      rng,
      { id, type: "lab", governorateId: gov.id, schedule },
      brand,
      bookable.map((s) => s.id),
      rng.int(2, 6),
    );
    applyBranchPricing(rng, branches, bookable);

    return {
      id,
      type: "lab" as const,
      slug: `${slugify(brand)}-${id}`,
      name: `${brand} Laboratories`,
      nameAr: `معامل ${brand}`,
      photo: avatarUrl(id, brand),
      coverImage: coverUrl(id),
      bio: {
        en:
          `${brand} Laboratories is an accredited medical laboratory network operating across ${gov.name} ` +
          `and beyond. We run ${tests.length} tests on internationally calibrated analysers, with digital ` +
          `results delivered to your phone and optional home sample collection.`,
        ar:
          `معامل ${brand} شبكة معامل تحاليل طبية معتمدة تعمل في ${gov.nameAr} وخارجها. ` +
          `نُجري ${tests.length} تحليلًا على أجهزة مُعايرة عالميًا، وتصلك النتائج رقميًا على هاتفك، ` +
          `مع إمكانية سحب العينة من المنزل.`,
      },
      accreditation: rng.sample(LAB_ACCREDITATIONS, rng.int(2, 3)),
      homeSampleCollection: rng.bool(0.75),
      tests,
      packages,
      branches,
      acceptedInsurancePlanIds: pickInsurancePlans(rng),
      rating: rng.float(3.6, 5, 1),
      reviewCount,
      price: cheapest,
      governorateId: gov.id,
      areaId: area.id,
      address: `${rng.int(1, 220)} ${rng.pick(STREETS)}, ${area.name}, ${gov.name}`,
      location: jitterLocation(rng, gov.id),
      phone: egyptPhone(rng),
      status: pickStatus(rng),
      isFeatured: rng.bool(0.3),
      bookingCount: reviewCount * rng.int(4, 12),
      waitingTimeMinutes: rng.pick([5, 10, 15, 20]),
      joinedAt: isoAt(-rng.int(30, 1200)),
      schedule,
    };
  });
}

function generateRadiology(rng: Rng, count: number): RadiologyCenter[] {
  return Array.from({ length: count }, (_, i) => {
    const id = `rad-${String(i + 1).padStart(3, "0")}`;
    const brand = RADIOLOGY_BRANDS[i % RADIOLOGY_BRANDS.length];
    const gov = rng.weighted(GOVERNORATES, [28, 20, 16, 7, 6, 6, 5, 5, 4, 3]);
    const area = rng.pick(gov.areas);

    const scans: RadiologyScan[] = rng
      .sample(RADIOLOGY_SCAN_CATALOG, rng.int(10, RADIOLOGY_SCAN_CATALOG.length))
      .map(([name, nameAr, category, base, minutes, contrast], idx) => ({
        id: `${id}-scan-${idx + 1}`,
        kind: "scan" as const,
        name,
        nameAr,
        category,
        description: {
          en: `${name} on latest-generation ${category} equipment, reported by a consultant radiologist.`,
          ar: `${nameAr} على أحدث أجهزة ${SERVICE_CATEGORIES_AR[category] ?? category}، ويكتب التقرير استشاري أشعة.`,
        },
        price: Math.round((base * rng.float(0.85, 1.3, 2)) / 10) * 10,
        durationMinutes: minutes,
        contrastRequired: contrast,
        // §3 — imaging carries the sharpest restrictions: radiation in
        // pregnancy, metal in MRI, contrast against kidney disease.
        preparation: preparationForScan(name, nameAr, category, contrast),
        eligibility: eligibilityForScan(name, category, contrast),
        isActive: rng.bool(0.92),
      }));

    const packages = buildPackages(rng, id, scans, [
      [
        "Cardiac Screening Bundle",
        "باقة فحص القلب",
        "Echo plus carotid Doppler for a full cardiovascular picture.",
        "إيكو مع دوبلر على الشرايين السباتية لصورة كاملة للقلب والأوعية الدموية.",
      ],
      [
        "Spine & Joint Package",
        "باقة العمود الفقري والمفاصل",
        "MRI coverage for chronic back, neck and knee pain.",
        "رنين مغناطيسي لآلام الظهر والرقبة والركبة المزمنة.",
      ],
      [
        "Women's Imaging Package",
        "باقة أشعة المرأة",
        "Mammography, pelvic ultrasound and bone density in one visit.",
        "أشعة الثدي وسونار الحوض وقياس كثافة العظام في زيارة واحدة.",
      ],
      [
        "Executive Imaging Checkup",
        "الفحص التنفيذي بالأشعة",
        "A head-to-toe imaging screen for annual executive checkups.",
        "فحص شامل بالأشعة من الرأس للقدم لكشوفات المديرين السنوية.",
      ],
    ]);

    const reviewCount = rng.int(8, 210);
    const cheapest = Math.min(...scans.map((s) => s.price));
    const schedule = buildSchedule(rng, "slot", "radiology");

    // A radiology center typically has many branches (§2).
    const bookable = [...scans, ...packages];
    const branches = buildBranches(
      rng,
      { id, type: "radiology", governorateId: gov.id, schedule },
      brand,
      bookable.map((s) => s.id),
      rng.int(2, 5),
    );
    applyBranchPricing(rng, branches, bookable);

    return {
      id,
      type: "radiology" as const,
      slug: `${slugify(brand)}-${id}`,
      name: `${brand} Radiology Center`,
      nameAr: `مركز ${brand} للأشعة`,
      photo: avatarUrl(id, brand),
      coverImage: coverUrl(id),
      bio: {
        en:
          `${brand} Radiology Center provides advanced diagnostic imaging across ${gov.name}. Our ` +
          `consultant radiologists report every study, and images are shared digitally with you and ` +
          `your treating doctor within hours.`,
        ar:
          `مركز ${brand} للأشعة يقدم خدمات التصوير التشخيصي المتقدم في ${gov.nameAr}. ` +
          `يكتب استشاريو الأشعة لدينا تقرير كل فحص، وتُرسل الصور رقميًا إليك وإلى طبيبك المعالج خلال ساعات.`,
      },
      accreditation: rng.sample(LAB_ACCREDITATIONS, rng.int(2, 3)),
      scans,
      packages,
      branches,
      acceptedInsurancePlanIds: pickInsurancePlans(rng),
      rating: rng.float(3.5, 5, 1),
      reviewCount,
      price: cheapest,
      governorateId: gov.id,
      areaId: area.id,
      address: `${rng.int(1, 220)} ${rng.pick(STREETS)}, ${area.name}, ${gov.name}`,
      location: jitterLocation(rng, gov.id),
      phone: egyptPhone(rng),
      status: pickStatus(rng),
      isFeatured: rng.bool(0.3),
      bookingCount: reviewCount * rng.int(4, 12),
      waitingTimeMinutes: rng.pick([10, 15, 20, 30]),
      joinedAt: isoAt(-rng.int(30, 1200)),
      schedule,
    };
  });
}

/** `[en, ar, descriptionEn, descriptionAr]` */
type PackageTemplate = [string, string, string, string];

/** Bundles 3–5 services into discounted packages. */
function buildPackages(
  rng: Rng,
  providerId: string,
  services: { id: string; price: number }[],
  templates: PackageTemplate[],
): ServicePackage[] {
  const chosen = rng.sample(templates, rng.int(2, templates.length));

  return chosen.map(([name, nameAr, description, descriptionAr], idx) => {
    const includes = rng.sample(services, rng.int(3, 5));
    const originalPrice = includes.reduce((sum, s) => sum + s.price, 0);
    const discount = rng.float(0.7, 0.88, 2);
    return {
      id: `${providerId}-pkg-${idx + 1}`,
      kind: "package" as const,
      name,
      nameAr,
      description: { en: description, ar: descriptionAr },
      includes: includes.map((s) => s.id),
      price: Math.round((originalPrice * discount) / 10) * 10,
      originalPrice,
      isActive: rng.bool(0.9),
    };
  });
}

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

function generatePatients(rng: Rng, count: number): User[] {
  return Array.from({ length: count }, (_, i) => {
    const id = `usr-${String(i + 1).padStart(3, "0")}`;
    const gender: Gender = rng.bool(0.5) ? "male" : "female";
    const name = personName(rng, gender);
    const gov = rng.pick(GOVERNORATES);
    const joined = -rng.int(5, 900);

    return {
      id,
      name: name.en,
      email: `${slugify(name.en)}@example.com`,
      phone: egyptPhone(rng),
      role: "patient" as const,
      avatar: avatarUrl(id, name.en),
      status: rng.weighted<User["status"]>(["active", "suspended"], [92, 8]),
      governorateId: gov.id,
      gender,
      dateOfBirth: toISODate(addDays(TODAY, -rng.int(18, 70) * 365)),
      bloodType: rng.pick(["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"]),
      createdAt: isoAt(joined),
      lastActiveAt: isoAt(-rng.int(0, 40)),
    };
  });
}

/**
 * Patient profiles (§1).
 *
 * Every account gets a "self" profile, and many get family members — booking
 * for a relative is an everyday need. Profiles belong to exactly one account and
 * are never linked across accounts, even when the details appear to match.
 */
function generatePatientProfiles(rng: Rng, patients: User[]): PatientProfile[] {
  const out: PatientProfile[] = [];
  let n = 1;

  const nextId = () => `pp-${String(n++).padStart(4, "0")}`;

  const conditions = (chance: number) =>
    rng.bool(chance) ? rng.sample([...CHRONIC_CONDITIONS], rng.int(1, 2)) : [];

  for (const account of patients) {
    const selfGender = account.gender ?? "male";

    out.push({
      id: nextId(),
      accountId: account.id,
      relationship: "self",
      fullName: account.name,
      gender: selfGender,
      dateOfBirth: account.dateOfBirth ?? "1990-01-01",
      phone: account.phone,
      bloodType: account.bloodType,
      chronicConditions: conditions(0.3),
      isPregnant: false,
      createdAt: account.createdAt,
    });

    // A spouse, then children, then an ageing parent — the usual shape.
    if (rng.bool(0.45)) {
      const spouseGender: Gender = selfGender === "male" ? "female" : "male";
      out.push({
        id: nextId(),
        accountId: account.id,
        relationship: "spouse",
        fullName: personName(rng, spouseGender).en,
        gender: spouseGender,
        dateOfBirth: toISODate(addDays(TODAY, -rng.int(24, 60) * 365)),
        bloodType: rng.pick(["A+", "B+", "O+", "AB+", "O-"]),
        chronicConditions: conditions(0.25),
        isPregnant: spouseGender === "female" && rng.bool(0.15),
        createdAt: isoAt(-rng.int(1, 400)),
      });
    }

    for (let i = 0; i < rng.weighted([0, 1, 2], [50, 30, 20]); i++) {
      const childGender: Gender = rng.bool(0.5) ? "male" : "female";
      out.push({
        id: nextId(),
        accountId: account.id,
        relationship: "child",
        fullName: personName(rng, childGender).en,
        gender: childGender,
        dateOfBirth: toISODate(addDays(TODAY, -rng.int(1, 17) * 365)),
        bloodType: rng.pick(["A+", "B+", "O+", "AB+"]),
        chronicConditions: conditions(0.15),
        isPregnant: false,
        createdAt: isoAt(-rng.int(1, 400)),
      });
    }

    if (rng.bool(0.3)) {
      const parentGender: Gender = rng.bool(0.5) ? "male" : "female";
      out.push({
        id: nextId(),
        accountId: account.id,
        relationship: "parent",
        fullName: personName(rng, parentGender).en,
        gender: parentGender,
        dateOfBirth: toISODate(addDays(TODAY, -rng.int(58, 85) * 365)),
        bloodType: rng.pick(["A+", "B+", "O+", "AB+", "A-"]),
        // Older profiles carry chronic conditions far more often.
        chronicConditions: conditions(0.7),
        isPregnant: false,
        createdAt: isoAt(-rng.int(1, 400)),
      });
    }
  }

  return out;
}

/** Every provider also gets a login account, so role-switching lands somewhere real. */
function providerAccounts(providers: Provider[]): User[] {
  return providers.map((p, i) => ({
    id: `usr-p-${String(i + 1).padStart(3, "0")}`,
    name: p.name,
    email: `${p.slug}@vesita.example.com`,
    phone: p.phone,
    role: p.type,
    avatar: p.photo,
    status: p.status === "suspended" ? ("suspended" as const) : ("active" as const),
    providerId: p.id,
    governorateId: p.governorateId,
    createdAt: p.joinedAt,
    lastActiveAt: p.joinedAt,
  }));
}

// ---------------------------------------------------------------------------
// Bookings, reviews, engagement
// ---------------------------------------------------------------------------

/** Returns the bookable services for a provider, as `[id, name, price]`. */
/** `[id, name, nameAr, price]` — both names, so a booking can denormalize each. */
function servicesOf(provider: Provider): [string, string, string, number][] {
  if (provider.type === "doctor") {
    return provider.consultationTypes
      .filter((c) => c.isActive)
      .map((c) => [c.id, c.name, c.nameAr, c.price]);
  }
  const items =
    provider.type === "lab"
      ? provider.tests.filter((t) => t.isActive)
      : provider.scans.filter((s) => s.isActive);
  return items.map((s) => [s.id, s.name, s.nameAr, s.price]);
}

function specialtyLabelOf(provider: Provider): string {
  if (provider.type === "doctor") {
    return SPECIALTIES.find((s) => s.id === provider.specialtyId)?.name ?? "General";
  }
  return provider.type === "lab" ? "Medical Laboratory" : "Radiology Center";
}

/** The estimated time to be seen, from the session start and the queue position. */
function estimateTime(
  sessionStart: string,
  queueNumber: number,
  minutesEach: number,
): string {
  const [h, m] = sessionStart.split(":").map(Number);
  const total = h * 60 + m + (queueNumber - 1) * minutesEach;
  const hh = Math.min(23, Math.floor(total / 60));
  return `${String(hh).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function generateBookings(
  rng: Rng,
  profiles: PatientProfile[],
  patientsById: Map<string, User>,
  providers: Provider[],
  count: number,
): Booking[] {
  const bookable = providers.filter((p) => p.status === "approved");
  // Doctors run sessions, so several patients share one session start time.
  const queueCounters = new Map<string, number>();

  return Array.from({ length: count }, (_, i) => {
    const id = `bkg-${String(i + 1).padStart(4, "0")}`;

    // A booking belongs to a patient *profile*, not to the account (§1).
    const profile = rng.pick(profiles);
    const account = patientsById.get(profile.accountId)!;

    const provider = rng.pick(bookable);
    const branch = rng.pick(provider.branches);
    const services = servicesOf(provider).filter(([sid]) =>
      branch.serviceIds.includes(sid),
    );
    // A branch may not offer every service — fall back to the provider list.
    const pool = services.length > 0 ? services : servicesOf(provider);
    const [serviceId, serviceName, serviceNameAr, listPrice] = rng.pick(pool);

    // Branch-specific pricing (§2).
    const price = branch.priceOverrides[serviceId] ?? listPrice;

    // Spread bookings from 120 days ago to 30 days out. Past dates take
    // terminal states; future dates are live bookings.
    const dayOffset = rng.int(-120, 30);
    const isPast = dayOffset < 0;

    const status: BookingStatus = isPast
      ? rng.weighted<BookingStatus>(
          [
            "completed",
            "no_show",
            "cancelled_by_patient",
            "cancelled_by_provider",
            "refunded",
          ],
          [74, 7, 11, 4, 4],
        )
      : rng.weighted<BookingStatus>(
          ["confirmed", "cancelled_by_patient", "cancelled_by_provider"],
          [86, 9, 5],
        );

    const date = addDays(TODAY, dayOffset);
    const dateISO = toISODate(date);

    const daySchedule =
      branch.schedule.find((d) => d.weekday === date.getUTCDay()) ??
      branch.schedule[0];
    const mode = schedulingModeFor(provider.type);

    // Session-based doctors: everyone joins the session at its start time and
    // is given a queue number plus an estimated time (§5).
    const sessionStart = daySchedule.startTime;
    const time =
      mode === "session"
        ? sessionStart
        : `${String(rng.int(9, 20)).padStart(2, "0")}:${String(rng.pick([0, 15, 30, 45])).padStart(2, "0")}`;

    let queueNumber: number | undefined;
    let estimatedTime: string | undefined;

    if (mode === "session" && consumesCapacity(status)) {
      const key = `${branch.id}|${dateISO}|${time}`;
      const next = (queueCounters.get(key) ?? 0) + 1;
      queueCounters.set(key, next);
      queueNumber = next;
      estimatedTime = estimateTime(
        sessionStart,
        next,
        daySchedule.slotDurationMinutes,
      );
    }

    const hasCoupon = rng.bool(0.18);
    const discount = hasCoupon ? Math.round(price * rng.float(0.05, 0.2, 2)) : 0;
    const cashback = rng.bool(0.3) ? Math.round(price * 0.05) : 0;
    const paymentMethod = rng.weighted<PaymentMethod>(
      ["cash", "card", "vodafone_cash", "instapay"],
      [46, 26, 18, 10],
    );

    // The online booking fee (§9). Cash bookings pre-date the fee.
    const bookingFee = paymentMethod === "cash" ? 0 : BUSINESS.bookingFee;
    const feePaid = bookingFee > 0 && status !== "cancelled_by_patient";

    const cancelled = isCancelled(status);
    const refunded = status === "refunded";

    // The visit fee is paid in cash at the clinic; the booking fee is online.
    const paymentStatus: PaymentStatus = refunded
      ? "refunded"
      : cancelled
        ? feePaid
          ? "refunded"
          : "unpaid"
        : status === "completed"
          ? "paid"
          : paymentMethod === "cash"
            ? "unpaid"
            : "paid";

    const service = findServiceIn(provider, serviceId);
    const needsAck = service ? requiresAcknowledgement(service) : false;

    return {
      id,
      reference: `VS-${String(rng.int(100000, 999999))}`,
      patientId: account.id,
      patientProfileId: profile.id,
      patientInfo: {
        fullName: profile.fullName,
        phone: profile.phone ?? account.phone,
        email: account.email,
        gender: profile.gender,
        dateOfBirth: profile.dateOfBirth,
        notes: rng.bool(0.35)
          ? rng.pick([
              "Recurring headache for the past two weeks.",
              "Follow-up on previous lab results.",
              "Routine annual checkup.",
              "Persistent lower back pain.",
              "Requested by my treating physician.",
            ])
          : undefined,
        bookingForSomeoneElse: profile.relationship !== "self",
      },
      providerId: provider.id,
      providerType: provider.type,
      providerName: provider.name,
      providerNameAr: provider.nameAr,
      providerPhoto: provider.photo,
      providerSpecialty: specialtyLabelOf(provider),
      serviceId,
      serviceName,
      serviceNameAr,
      branchId: branch.id,
      date: dateISO,
      time,
      status,
      paymentMethod,
      paymentStatus,
      price,
      discount,
      cashback,
      total: price - discount,
      couponCode: hasCoupon
        ? rng.pick(["VESITA10", "HEALTH20", "FIRST50", "RAMADAN15"])
        : undefined,
      address: branch.address,
      createdAt: isoAt(dayOffset - rng.int(1, 14)),

      queueNumber,
      estimatedTime,
      capacityType: daySchedule.capacityType,
      // A few comfort-limit sessions ran over, with the patient's consent.
      overCapacity:
        daySchedule.capacityType === "comfort" &&
        consumesCapacity(status) &&
        rng.bool(0.08),

      bookingFee,
      cancelledAt: cancelled ? isoAt(dayOffset - rng.int(0, 2)) : undefined,
      cancellationReason: cancelled ? rng.pick(CANCELLATION_REASONS) : undefined,
      refundAmount: refunded || (cancelled && feePaid) ? bookingFee : undefined,
      refundedAt: refunded ? isoAt(dayOffset + rng.int(1, 5)) : undefined,
      completedAt: status === "completed" ? isoAt(dayOffset) : undefined,
      noShowAt: status === "no_show" ? isoAt(dayOffset) : undefined,
      // The patient arrived but left after a long wait — a signal about the
      // provider, never a mark against the patient (§8).
      longWaitReported: status === "completed" ? rng.bool(0.06) : undefined,

      acknowledgement: needsAck
        ? {
            preparationAccepted: true,
            eligibilityConfirmed: true,
            acknowledgedAt: isoAt(dayOffset - rng.int(1, 14)),
          }
        : undefined,

      // Only completed visits can carry a review.
      hasReview: status === "completed" && rng.bool(0.55),
    };
  });
}

/** Local lookup — the API's `findService` would be a circular import here. */
function findServiceIn(provider: Provider, serviceId: string) {
  const pool =
    provider.type === "doctor"
      ? provider.consultationTypes
      : provider.type === "lab"
        ? [...provider.tests, ...provider.packages]
        : [...provider.scans, ...provider.packages];
  return pool.find((s) => s.id === serviceId);
}

function generateReviews(rng: Rng, bookings: Booking[], patients: User[]): Review[] {
  const reviewed = bookings.filter((b) => b.hasReview);

  return reviewed.map((booking, i) => {
    const patient = patients.find((p) => p.id === booking.patientId)!;
    const rating = rng.weighted([5, 4, 3, 2, 1], [52, 27, 12, 6, 3]);
    const comment =
      rating >= 4
        ? rng.pick(REVIEW_COMMENTS_POSITIVE)
        : rating === 3
          ? rng.pick(REVIEW_COMMENTS_MIXED)
          : rng.pick(REVIEW_COMMENTS_NEGATIVE);

    /** Sub-scores hover around the headline rating. */
    const near = () => Math.max(1, Math.min(5, rating + rng.int(-1, 1)));

    return {
      id: `rev-${String(i + 1).padStart(4, "0")}`,
      bookingId: booking.id,
      providerId: booking.providerId,
      patientId: patient.id,
      patientName: patient.name,
      patientAvatar: patient.avatar,
      rating,
      breakdown: {
        waitingTime: near(),
        staff: near(),
        cleanliness: near(),
        communication: near(),
      },
      comment,
      createdAt: isoAt(
        Math.round(
          (new Date(booking.createdAt).getTime() - TODAY.getTime()) / 86400000,
        ) + rng.int(1, 5),
      ),
      isVerified: true,
      helpfulCount: rng.int(0, 42),
      reply: rng.bool(0.3)
        ? {
            comment: rng.pick([
              "Thank you for your kind feedback — we look forward to seeing you again.",
              "We appreciate you taking the time to review us. Wishing you continued good health.",
              "Thank you for the honest feedback. We are actively working on reducing waiting times.",
            ]),
            createdAt: isoAt(-rng.int(1, 30)),
          }
        : undefined,
    };
  });
}

function generateFavorites(rng: Rng, patients: User[], providers: Provider[]): Favorite[] {
  const approved = providers.filter((p) => p.status === "approved");
  const out: Favorite[] = [];
  let n = 1;

  for (const patient of patients) {
    for (const provider of rng.sample(approved, rng.int(0, 6))) {
      out.push({
        id: `fav-${String(n++).padStart(4, "0")}`,
        patientId: patient.id,
        providerId: provider.id,
        createdAt: isoAt(-rng.int(1, 200)),
      });
    }
  }
  return out;
}

/**
 * `{ title, body }` per kind, in both languages.
 *
 * The notification centre is patient-facing, so these cannot stay English. They
 * are rendered from the stored text rather than from message keys because the
 * body interpolates a provider, date and time that are only known at generation
 * time — so both languages are baked in, as with bios and service descriptions.
 */
const NOTIFICATION_TEMPLATES: Record<
  NotificationKind,
  { title: LocalizedText; body: LocalizedText }
> = {
  booking_confirmed: {
    title: { en: "Booking confirmed", ar: "تم تأكيد الحجز" },
    body: {
      en: "Your appointment with {provider} on {date} at {time} is confirmed.",
      ar: "تم تأكيد موعدك مع {provider} يوم {date} الساعة {time}.",
    },
  },
  booking_cancelled: {
    title: { en: "Booking cancelled", ar: "تم إلغاء الحجز" },
    body: {
      en: "Your appointment with {provider} on {date} has been cancelled. Any payment will be refunded within 5 working days.",
      ar: "تم إلغاء موعدك مع {provider} يوم {date}. سيتم رد أي مبلغ مدفوع خلال ٥ أيام عمل.",
    },
  },
  booking_reminder: {
    title: { en: "Appointment reminder", ar: "تذكير بالموعد" },
    body: {
      en: "Reminder: you have an appointment with {provider} tomorrow at {time}.",
      ar: "تذكير: لديك موعد مع {provider} غدًا الساعة {time}.",
    },
  },
  review_request: {
    title: { en: "How was your visit?", ar: "كيف كانت زيارتك؟" },
    body: {
      en: "Tell us about your visit to {provider} — your review helps other patients.",
      ar: "شاركنا رأيك في زيارتك لـ {provider} — تقييمك يساعد مرضى آخرين.",
    },
  },
  promo: {
    title: { en: "20% cashback this week", ar: "كاش باك ٢٠٪ هذا الأسبوع" },
    body: {
      en: "Book any lab test with code HEALTH20 and get 20% back to your Vesita wallet.",
      ar: "احجز أي تحليل بكود HEALTH20 واسترد ٢٠٪ في محفظة Vesita.",
    },
  },
  system: {
    title: { en: "Profile verified", ar: "تم توثيق الحساب" },
    body: {
      en: "Your Vesita account has been verified. You can now book with instant confirmation.",
      ar: "تم توثيق حسابك على Vesita. يمكنك الآن الحجز بتأكيد فوري.",
    },
  },
};

function generateNotifications(rng: Rng, users: User[], bookings: Booking[]): AppNotification[] {
  const out: AppNotification[] = [];
  let n = 1;

  for (const user of users) {
    const userBookings = bookings.filter((b) => b.patientId === user.id);
    const count = rng.int(3, 9);

    for (let i = 0; i < count; i++) {
      const kind = rng.weighted<NotificationKind>(
        ["booking_confirmed", "booking_reminder", "review_request", "booking_cancelled", "promo", "system"],
        [26, 20, 16, 10, 20, 8],
      );
      const { title, body: bodyTpl } = NOTIFICATION_TEMPLATES[kind];
      const booking = userBookings.length ? rng.pick(userBookings) : undefined;

      const fill = (tpl: string, provider: string, fallback: string) =>
        tpl
          .replace("{provider}", booking?.providerName ? provider : fallback)
          .replace("{date}", booking?.date ?? "soon")
          .replace("{time}", booking?.time ?? "10:00");

      const body: LocalizedText = {
        en: fill(bodyTpl.en, booking?.providerName ?? "", "your provider"),
        ar: fill(bodyTpl.ar, booking?.providerNameAr ?? "", "مقدم الخدمة"),
      };

      out.push({
        id: `ntf-${String(n++).padStart(4, "0")}`,
        userId: user.id,
        kind,
        channel: rng.weighted<NotificationChannel>(
          ["browser", "sms", "email", "whatsapp"],
          [34, 26, 24, 16],
        ),
        title,
        body,
        isRead: rng.bool(0.55),
        createdAt: isoAt(-rng.int(0, 45), rng.int(8, 21)),
        actionUrl: booking ? `/patient/bookings` : undefined,
      });
    }
  }

  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function generateHolidays(rng: Rng, providers: Provider[]): Holiday[] {
  const out: Holiday[] = [];
  let n = 1;

  for (const provider of providers) {
    for (let i = 0; i < rng.int(0, 3); i++) {
      out.push({
        id: `hol-${String(n++).padStart(4, "0")}`,
        providerId: provider.id,
        date: toISODate(addDays(TODAY, rng.int(1, 60))),
        reason: rng.pick([
          "Annual leave",
          "Public holiday",
          "Medical conference",
          "Eid holiday",
          "Clinic maintenance",
        ]),
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Admin: monetization
// ---------------------------------------------------------------------------

function generateCoupons(): Coupon[] {
  const raw: [string, string, "percentage" | "fixed", number, number, number | undefined, number, number, number, ProviderRole[]][] = [
    ["VESITA10", "10% off your first booking on any service.", "percentage", 10, 100, 100, 5000, 3184, 45, []],
    ["HEALTH20", "20% off all laboratory tests.", "percentage", 20, 200, 300, 2000, 1422, 30, ["lab"]],
    ["FIRST50", "EGP 50 off your very first doctor consultation.", "fixed", 50, 150, undefined, 10000, 7810, 90, ["doctor"]],
    ["SCAN15", "15% off any radiology scan.", "percentage", 15, 500, 500, 1500, 688, 60, ["radiology"]],
    ["RAMADAN15", "Seasonal 15% off across the platform.", "percentage", 15, 100, 250, 8000, 8000, -20, []],
    ["FAMILY100", "EGP 100 off bookings above EGP 800.", "fixed", 100, 800, undefined, 1000, 213, 120, []],
    ["WELCOME25", "25% off for newly registered patients.", "percentage", 25, 150, 200, 3000, 954, 75, []],
    ["LABPLUS", "EGP 75 off lab packages above EGP 600.", "fixed", 75, 600, undefined, 800, 190, 15, ["lab"]],
  ];

  return raw.map(
    (
      [code, description, discountType, discountValue, minOrderValue, maxDiscount, usageLimit, usageCount, expiresInDays, appliesTo],
      i,
    ) => ({
      id: `cpn-${String(i + 1).padStart(3, "0")}`,
      code,
      description,
      discountType,
      discountValue,
      minOrderValue,
      maxDiscount,
      usageLimit,
      usageCount,
      expiresAt: isoAt(expiresInDays),
      // Expired or fully-consumed coupons are inactive.
      isActive: expiresInDays > 0 && usageCount < usageLimit,
      appliesTo,
      createdAt: isoAt(-Math.abs(expiresInDays) - 90),
    }),
  );
}

function generateCampaigns(): CashbackCampaign[] {
  const raw: [string, string, number, number, number, number, ProviderRole[], number, number][] = [
    ["Summer Health Cashback", "5% back to your wallet on every doctor consultation.", 5, 100, -30, 30, ["doctor"], 184200, 2140],
    ["Lab Loyalty Boost", "10% back on all laboratory tests and packages.", 10, 200, -10, 45, ["lab"], 96400, 1180],
    ["Imaging Rewards", "7% back on CT and MRI scans booked through Vesita.", 7, 300, 5, 60, ["radiology"], 0, 0],
    ["New Year Wellness", "12% back across the platform for the new year.", 12, 250, -180, -120, [], 421800, 5320],
  ];

  return raw.map(
    ([name, description, percentage, maxCashback, startOffset, endOffset, appliesTo, totalIssued, redeemedCount], i) => ({
      id: `cbk-${String(i + 1).padStart(3, "0")}`,
      name,
      description,
      percentage,
      maxCashback,
      startsAt: isoAt(startOffset),
      endsAt: isoAt(endOffset),
      appliesTo,
      status: endOffset < 0 ? "ended" : startOffset > 0 ? "scheduled" : "active",
      totalIssued,
      redeemedCount,
    }),
  );
}

const COMMISSION: CommissionSettings = {
  doctor: 12,
  lab: 15,
  radiology: 14,
  platformFee: 10,
  vatPercentage: 14,
  updatedAt: isoAt(-14),
};

// ---------------------------------------------------------------------------
// Assemble
// ---------------------------------------------------------------------------

function build() {
  const rng = createRng(SEED);

  const doctors = generateDoctors(rng, 56);
  const labs = generateLabs(rng, 22);
  const radiology = generateRadiology(rng, 22);
  const providers: Provider[] = [...doctors, ...labs, ...radiology];

  // Suspended providers carry the reason and the form of the suspension (§13).
  for (const provider of providers) {
    if (provider.status !== "suspended") continue;
    const type: SuspensionType = rng.bool(0.35) ? "hard" : "soft";
    provider.suspension = {
      type,
      reason:
        type === "hard"
          ? rng.pick([
              "Medical syndicate registration could not be verified.",
              "Serious patient-safety complaint under investigation.",
              "Suspected fraudulent billing.",
            ])
          : rng.pick([
              "Temporarily paused at the provider's request.",
              "Awaiting updated accreditation documents.",
              "Repeated late cancellations under review.",
            ]),
      suspendedAt: isoAt(-rng.int(1, 90)),
    };
  }

  const patients = generatePatients(rng, 60);
  const patientProfiles = generatePatientProfiles(rng, patients);
  const providerUsers = providerAccounts(providers);

  const admin: User = {
    id: "usr-admin",
    name: "Mostafa Ghonemi",
    email: "admin@vesita.example.com",
    phone: "01000000000",
    role: "admin",
    avatar: avatarUrl("usr-admin", "Mostafa Ghonemi"),
    status: "active",
    createdAt: isoAt(-1400),
    lastActiveAt: isoAt(0),
  };

  const users: User[] = [...patients, ...providerUsers, admin];

  const patientsById = new Map(patients.map((p) => [p.id, p]));
  const bookings = generateBookings(rng, patientProfiles, patientsById, providers, 620);
  const reviews = generateReviews(rng, bookings, patients);
  const favorites = generateFavorites(rng, patients, providers);
  const notifications = generateNotifications(rng, patients, bookings);
  const holidays = generateHolidays(rng, providers);

  // Reconcile the taxonomy counts with what we actually generated.
  const specialties = SPECIALTIES.map((s) => ({
    ...s,
    doctorCount: doctors.filter(
      (d) => d.specialtyId === s.id && d.status === "approved",
    ).length,
  }));

  return {
    doctors,
    labs,
    radiology,
    providers,
    patients,
    patientProfiles,
    users,
    bookings,
    reviews,
    favorites,
    notifications,
    holidays,
    specialties,
    coupons: generateCoupons(),
    campaigns: generateCampaigns(),
    commission: COMMISSION,
  };
}

/**
 * The generated dataset. Built once per process at module load — deterministic,
 * so the server and the client always agree.
 */
export const DB = build();

export type Database = ReturnType<typeof build>;
