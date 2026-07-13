/** Sanity-check the generated dataset. Run with: npx tsx scripts/check-seed.ts */
import { DB } from "../src/lib/data/seed";
import { isCancelled, requiresAcknowledgement } from "../src/lib/types";

const approved = DB.providers.filter((p) => p.status === "approved");

const summary = {
  doctors: DB.doctors.length,
  labs: DB.labs.length,
  radiology: DB.radiology.length,
  approvedProviders: approved.length,
  branches: DB.providers.reduce((n, p) => n + p.branches.length, 0),
  patients: DB.patients.length,
  patientProfiles: DB.patientProfiles.length,
  users: DB.users.length,
  bookings: DB.bookings.length,
  reviews: DB.reviews.length,
  favorites: DB.favorites.length,
  notifications: DB.notifications.length,
  holidays: DB.holidays.length,
  coupons: DB.coupons.length,
  campaigns: DB.campaigns.length,
  specialtiesWithDoctors: DB.specialties.filter((s) => s.doctorCount > 0).length,
};
console.log("counts:", summary);

const problems: string[] = [];

// Referential integrity
const providerIds = new Set(DB.providers.map((p) => p.id));
const patientIds = new Set(DB.patients.map((p) => p.id));
const bookingIds = new Set(DB.bookings.map((b) => b.id));
const profileById = new Map(DB.patientProfiles.map((p) => [p.id, p]));
const branchIds = new Set(DB.providers.flatMap((p) => p.branches.map((b) => b.id)));

for (const b of DB.bookings) {
  if (!providerIds.has(b.providerId)) problems.push(`booking ${b.id}: bad providerId`);
  if (!patientIds.has(b.patientId)) problems.push(`booking ${b.id}: bad patientId`);
  if (!b.serviceName) problems.push(`booking ${b.id}: empty serviceName`);
  if (b.total < 0) problems.push(`booking ${b.id}: negative total`);
  if (isCancelled(b.status) && !b.cancellationReason)
    problems.push(`booking ${b.id}: cancelled without reason`);
  if (b.hasReview && b.status !== "completed")
    problems.push(`booking ${b.id}: review on non-completed booking`);

  // §1 — a booking belongs to a patient profile, and that profile must belong
  // to the account that made the booking. Profiles never cross accounts.
  const profile = profileById.get(b.patientProfileId);
  if (!profile) {
    problems.push(`booking ${b.id}: bad patientProfileId`);
  } else if (profile.accountId !== b.patientId) {
    problems.push(`booking ${b.id}: profile belongs to another account`);
  }

  // §2 — availability, pricing and services all resolve at the branch.
  if (!b.branchId || !branchIds.has(b.branchId))
    problems.push(`booking ${b.id}: bad branchId`);

  // §5 — a doctor booking carries a queue number, not an exact minute.
  if (b.providerType === "doctor" && b.status === "confirmed" && !b.queueNumber)
    problems.push(`booking ${b.id}: confirmed doctor booking without a queue number`);

  // §9 — a refund is never silently owed.
  if (b.status === "refunded" && b.refundAmount === undefined)
    problems.push(`booking ${b.id}: refunded without a refund amount`);

  // §8 — a missed visit can only be recorded after the session has ended.
  if (b.status === "no_show" && b.date > "2026-07-13")
    problems.push(`booking ${b.id}: missed visit recorded for a future session`);
}
for (const r of DB.reviews) {
  if (!bookingIds.has(r.bookingId)) problems.push(`review ${r.id}: bad bookingId`);
  if (r.rating < 1 || r.rating > 5) problems.push(`review ${r.id}: rating out of range`);
}
for (const p of DB.providers) {
  if (p.price <= 0) problems.push(`provider ${p.id}: non-positive price`);
  if (!p.schedule.some((d) => d.isWorkingDay)) problems.push(`provider ${p.id}: never works`);

  // §2 — every provider operates through at least one branch, doctors included.
  if (p.branches.length === 0) problems.push(`provider ${p.id}: no branches`);

  for (const branch of p.branches) {
    if (branch.providerId !== p.id)
      problems.push(`branch ${branch.id}: providerId does not match its provider`);
    if (branch.serviceIds.length === 0)
      problems.push(`branch ${branch.id}: offers no services`);
    if (!branch.schedule.some((d) => d.isWorkingDay))
      problems.push(`branch ${branch.id}: never opens`);
    // Appendix A — capacity is the single source of truth, so it must exist.
    for (const day of branch.schedule) {
      if (day.isWorkingDay && day.capacity < 1)
        problems.push(`branch ${branch.id}: working day with no capacity`);
    }
  }

  if (p.type === "lab" && !p.tests.some((t) => t.isActive))
    problems.push(`lab ${p.id}: no active tests`);
  if (p.type === "radiology" && !p.scans.some((s) => s.isActive))
    problems.push(`radiology ${p.id}: no active scans`);
  if (p.type === "doctor" && !p.consultationTypes.some((c) => c.isActive))
    problems.push(`doctor ${p.id}: no active consultations`);

  // §13 — a suspended provider records which form of suspension applies.
  if (p.status === "suspended" && !p.suspension)
    problems.push(`provider ${p.id}: suspended without a suspension record`);
}

// §1 — every account has exactly one "self" profile.
const selfCount = new Map<string, number>();
for (const profile of DB.patientProfiles) {
  if (!patientIds.has(profile.accountId))
    problems.push(`profile ${profile.id}: bad accountId`);
  if (profile.relationship === "self") {
    selfCount.set(profile.accountId, (selfCount.get(profile.accountId) ?? 0) + 1);
  }
  if (profile.gender === "male" && profile.isPregnant)
    problems.push(`profile ${profile.id}: male profile flagged pregnant`);
}
for (const patient of DB.patients) {
  const n = selfCount.get(patient.id) ?? 0;
  if (n !== 1) problems.push(`account ${patient.id}: has ${n} "self" profiles, expected 1`);
}

// §3 — every lab test and radiology scan carries preparation and eligibility.
let gated = 0;
for (const lab of DB.labs) {
  for (const test of lab.tests) {
    if (!test.preparation || !test.eligibility)
      problems.push(`test ${test.id}: missing preparation/eligibility`);
    if (requiresAcknowledgement(test)) gated++;
  }
}
for (const centre of DB.radiology) {
  for (const scan of centre.scans) {
    if (!scan.preparation || !scan.eligibility)
      problems.push(`scan ${scan.id}: missing preparation/eligibility`);
    if (requiresAcknowledgement(scan)) gated++;
  }
}
console.log("services requiring acknowledgement:", gated);

// Determinism: rebuilding the module in a fresh process must match. Here we at
// least assert IDs are unique and slugs are collision-free.
const slugs = new Set(DB.providers.map((p) => p.slug));
if (slugs.size !== DB.providers.length) problems.push("duplicate provider slugs");
if (new Set(DB.users.map((u) => u.id)).size !== DB.users.length)
  problems.push("duplicate user ids");

// Every provider role must have at least one approved, bookable member.
for (const t of ["doctor", "lab", "radiology"] as const) {
  const n = approved.filter((p) => p.type === t).length;
  if (n === 0) problems.push(`no approved providers of type ${t}`);
  console.log(`approved ${t}: ${n}`);
}

const upcoming = DB.bookings.filter((b) => b.date >= "2026-07-13").length;
console.log("upcoming bookings:", upcoming);
console.log("sample provider:", {
  name: DB.doctors[0].name,
  price: DB.doctors[0].price,
  rating: DB.doctors[0].rating,
  photo: DB.doctors[0].photo,
});

if (problems.length) {
  console.error(`\n${problems.length} PROBLEM(S):`);
  for (const p of problems.slice(0, 25)) console.error(" -", p);
  process.exit(1);
}
console.log("\nAll integrity checks passed.");
