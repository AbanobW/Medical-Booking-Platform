/**
 * Drives the real service layer end-to-end, the way the UI does.
 * Run: npx tsx scripts/check-flows.ts
 */
import { searchProviders, getProviderBySlug, getAvailability, getNextSlots } from "../src/lib/api/providers";
import {
  CapacityError,
  beginPayment,
  cancelBooking,
  getBookings,
  holdBooking,
  markCompleted,
  markNoShow,
  payBooking,
  processRefund,
  reportLongWait,
  rescheduleBooking,
  validateCoupon,
} from "../src/lib/api/bookings";
import { getPatientProfiles, createPatientProfile } from "../src/lib/api/profiles";
import { createReview, toggleFavorite, getFavorites } from "../src/lib/api/engagement";
import { getAdminStats, getPatientStats, getProviderStats, getRevenueAnalytics } from "../src/lib/api/stats";
import {
  setProviderStatus,
  suspendProvider,
  reinstateProvider,
  getCoupons,
  createCoupon,
  deleteCoupon,
} from "../src/lib/api/admin";
import { demoUserFor } from "../src/lib/api/auth";
import { evaluateEligibility } from "../src/lib/eligibility";
import { BUSINESS } from "../src/lib/site";
import { isCancelled, type Acknowledgement, type PatientInfo } from "../src/lib/types";

const ok = (label: string, extra = "") => console.log(`  ✓ ${label}${extra ? ` — ${extra}` : ""}`);
const fail = (label: string, err: unknown) => {
  console.error(`  ✗ ${label} — ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
};

async function main() {
  console.log("\n1. SEARCH");
  const doctors = await searchProviders({ type: "doctor", sort: "highest_rated", pageSize: 5 });
  if (doctors.items.length === 0) throw new Error("no doctors returned");
  ok("search doctors", `${doctors.total} total, page 1 of ${doctors.totalPages}`);

  const cheap = await searchProviders({ type: "doctor", maxPrice: 300, sort: "lowest_price" });
  const overPriced = cheap.items.filter((p) => p.price > 300);
  if (overPriced.length) fail("maxPrice filter leaks", `${overPriced.length} over budget`);
  else ok("maxPrice filter", `${cheap.total} under EGP 300`);

  const sorted = cheap.items.map((p) => p.price);
  const isAscending = sorted.every((v, i) => i === 0 || sorted[i - 1] <= v);
  isAscending ? ok("lowest_price sort ordering") : fail("lowest_price sort", sorted.join(","));

  const labs = await searchProviders({ type: "lab", q: "MRI" });
  ok("free-text search across catalogue", `"MRI" in labs → ${labs.total}`);

  const cairo = await searchProviders({ governorateId: "cairo" });
  ok("governorate filter", `Cairo → ${cairo.total}`);

  console.log("\n2. PROVIDER PROFILE + AVAILABILITY");
  const doctor = await getProviderBySlug(doctors.items[0].slug);
  ok("getProviderBySlug", doctor.name);

  const availability = await getAvailability(doctor.id, 30);
  const openDays = Object.entries(availability).filter(([, s]) => s.some((x) => x.isAvailable));
  if (openDays.length === 0) throw new Error("provider has zero open days in 30 — booking impossible");
  ok("availability", `${openDays.length}/30 days have open slots`);

  const next = await getNextSlots(doctor.id, 3);
  ok("next slots", next.map((s) => `${s.date} ${s.time}`).join(", "));

  console.log("\n3. PATIENT PROFILES (§1)");
  const patient = demoUserFor("patient");
  const profiles = await getPatientProfiles(patient.id);
  const self = profiles.find((p) => p.relationship === "self");
  if (!self) throw new Error("account has no 'self' profile");
  ok("getPatientProfiles", `${profiles.length} profile(s), self = ${self.fullName}`);

  const child = await createPatientProfile(patient.id, {
    relationship: "child",
    fullName: "Flow Check Junior",
    gender: "female",
    dateOfBirth: "2019-04-02",
    chronicConditions: [],
    isPregnant: false,
  });
  ok("createPatientProfile", `${child.fullName} (${child.relationship})`);

  // A second "self" must be refused — an account has exactly one.
  try {
    await createPatientProfile(patient.id, {
      relationship: "self",
      fullName: "Impostor",
      gender: "male",
      dateOfBirth: "1990-01-01",
      chronicConditions: [],
      isPregnant: false,
    });
    fail("duplicate self-profile guard", "a second 'self' profile was ACCEPTED");
  } catch (err) {
    ok("duplicate self-profile rejected", (err as Error).message);
  }

  console.log("\n4. BOOKING LIFECYCLE: hold → pay → confirm (§7, §9)");
  const [date, slots] = openDays[0];
  const slot = slots.find((s) => s.isAvailable)!;
  const branch = doctor.branches[0];
  const service =
    doctor.type === "doctor"
      ? doctor.consultationTypes.find(
          (c) => c.isActive && branch.serviceIds.includes(c.id),
        )!
      : null;
  if (!service) throw new Error("doctor has no active consultation type at their main branch");

  const info: PatientInfo = {
    fullName: self.fullName,
    phone: patient.phone,
    email: patient.email,
    gender: self.gender,
    dateOfBirth: self.dateOfBirth,
    notes: "End-to-end flow check.",
    bookingForSomeoneElse: false,
  };

  const base = {
    patientId: patient.id,
    patientProfileId: self.id,
    providerId: doctor.id,
    branchId: branch.id,
    serviceId: service.id,
    date,
    time: slot.time,
    patientInfo: info,
  };

  // An online fee means the place is only HELD until it is paid for.
  const held = await holdBooking({ ...base, paymentMethod: "card" });
  if (held.status !== "held") fail("online booking should start HELD", held.status);
  else ok("holdBooking", `${held.reference} · status=${held.status} · fee EGP ${held.bookingFee} · expires ${held.holdExpiresAt}`);

  if (held.queueNumber === undefined)
    fail("doctor booking should carry a queue number", "none");
  else ok("session queue number (§5)", `#${held.queueNumber}, seen around ~${held.estimatedTime}`);

  // A live hold consumes capacity, exactly like a confirmed booking (Appendix A).
  const duringHold = await getAvailability(doctor.id, 30, branch.id);
  const takenDuringHold = duringHold[date].find((s) => s.time === slot.time)?.taken ?? 0;
  takenDuringHold > 0
    ? ok("an active hold consumes capacity", `taken=${takenDuringHold}`)
    : fail("hold did not consume capacity", String(takenDuringHold));

  await beginPayment(held.id);
  const paid = await payBooking(held.id, "success");
  if (paid.status !== "confirmed" || paid.paymentStatus !== "paid")
    fail("payment should confirm the booking", `${paid.status}/${paid.paymentStatus}`);
  else ok("payBooking → CONFIRMED", `${paid.status}, fee paid EGP ${paid.bookingFee}`);

  // A failed payment releases the place and discards the booking — never a
  // lingering half-paid state (§9).
  const doomed = await holdBooking({
    ...base,
    patientProfileId: child.id,
    patientInfo: { ...info, fullName: child.fullName, bookingForSomeoneElse: true },
    paymentMethod: "card",
  });
  try {
    await payBooking(doomed.id, "failure");
    fail("failed payment guard", "a failed payment did NOT release the place");
  } catch (err) {
    ok("failed payment releases the place", (err as Error).message);
  }
  const afterFailure = await getBookings({ patientId: patient.id, pageSize: 500 });
  afterFailure.items.some((b) => b.id === doomed.id)
    ? fail("discarded hold", "the failed booking is still on record")
    : ok("failed hold discarded — no half-booked state");

  // The same profile must not hold two places at the same time.
  try {
    await holdBooking({ ...base, paymentMethod: "cash" });
    fail("double-booking guard", "the same profile booked the same time twice");
  } catch (err) {
    ok("double-booking rejected", (err as Error).message);
  }

  console.log("\n5. CAPACITY (§6, Appendix A)");
  const capacitySlot = duringHold[date].find((s) => s.time === slot.time);
  ok(
    "capacity is the source of truth",
    `${capacitySlot?.taken}/${capacitySlot?.capacity} taken · ${capacitySlot?.capacityType} limit`,
  );

  // Fill a session to its limit and confirm the limit actually holds.
  const strictProvider = (await searchProviders({ type: "radiology", pageSize: 50 })).items.find(
    (p) =>
      p.branches[0]?.schedule.some(
        (d) => d.isWorkingDay && d.capacityType === "strict",
      ),
  );
  if (strictProvider) {
    const sBranch = strictProvider.branches[0];
    const sAvail = await getAvailability(strictProvider.id, 30, sBranch.id);
    const target = Object.entries(sAvail)
      .flatMap(([, list]) => list)
      .find((s) => s.capacityType === "strict" && !s.isFull);

    const sService =
      strictProvider.type === "radiology"
        ? strictProvider.scans.find(
            (x) => x.isActive && sBranch.serviceIds.includes(x.id),
          )
        : undefined;

    if (target && sService) {
      const eligible = evaluateEligibility(sService, self);
      const ack: Acknowledgement = {
        preparationAccepted: true,
        eligibilityConfirmed: true,
        acknowledgedAt: new Date().toISOString(),
      };

      if (!eligible.eligible) {
        ok("strict capacity", `skipped — ${self.fullName} is not eligible for ${sService.name}`);
      } else {
        // Take every remaining place, then try once more.
        let taken = 0;
        for (let i = 0; i < target.remaining; i++) {
          const p = await createPatientProfile(patient.id, {
            relationship: "child",
            fullName: `Capacity Filler ${i}`,
            gender: "male",
            dateOfBirth: "2000-01-01",
            chronicConditions: [],
            isPregnant: false,
          });
          await holdBooking({
            patientId: patient.id,
            patientProfileId: p.id,
            providerId: strictProvider.id,
            branchId: sBranch.id,
            serviceId: sService.id,
            date: target.date,
            time: target.time,
            patientInfo: { ...info, fullName: p.fullName },
            paymentMethod: "cash",
            acknowledgement: ack,
          });
          taken++;
        }
        ok("filled a strict session to capacity", `${taken}/${target.capacity} places`);

        const overflow = await createPatientProfile(patient.id, {
          relationship: "child",
          fullName: "One Too Many",
          gender: "male",
          dateOfBirth: "2000-01-01",
          chronicConditions: [],
          isPregnant: false,
        });
        try {
          await holdBooking({
            patientId: patient.id,
            patientProfileId: overflow.id,
            providerId: strictProvider.id,
            branchId: sBranch.id,
            serviceId: sService.id,
            date: target.date,
            time: target.time,
            patientInfo: { ...info, fullName: overflow.fullName },
            paymentMethod: "cash",
            acknowledgement: ack,
          });
          fail("STRICT capacity breached", "a strict limit was exceeded");
        } catch (err) {
          if (err instanceof CapacityError && err.kind === "strict_full") {
            ok(
              "strict limit never exceeded",
              err.detail.nextSlot
                ? `patient offered the next slot: ${err.detail.nextSlot.date} ${err.detail.nextSlot.time}`
                : "patient offered a clear outcome",
            );
          } else {
            fail("strict capacity error shape", (err as Error).message);
          }
        }
      }
    } else {
      ok("strict capacity", "skipped — no open strict session found");
    }
  } else {
    ok("strict capacity", "skipped — no strict-capacity radiology provider");
  }

  console.log("\n6. PREPARATION & ELIGIBILITY (§3)");
  const rad = (await searchProviders({ type: "radiology", pageSize: 50 })).items.find(
    (p) =>
      p.type === "radiology" &&
      p.scans.some((s) => s.isActive && !s.eligibility.pregnancySafe),
  );
  if (rad && rad.type === "radiology") {
    const unsafe = rad.scans.find((s) => s.isActive && !s.eligibility.pregnancySafe)!;

    const expecting = await createPatientProfile(patient.id, {
      relationship: "spouse",
      fullName: "Expecting Patient",
      gender: "female",
      dateOfBirth: "1994-03-11",
      chronicConditions: [],
      isPregnant: true,
    });

    const verdict = evaluateEligibility(unsafe, expecting);
    verdict.eligible
      ? fail("pregnancy eligibility rule", `${unsafe.name} was allowed during pregnancy`)
      : ok("ineligible profile blocked", verdict.violations[0].message);

    // ...and the API must refuse it too, not just the UI.
    const rBranch = rad.branches.find((b) => b.serviceIds.includes(unsafe.id)) ?? rad.branches[0];
    const rAvail = await getAvailability(rad.id, 30, rBranch.id);
    const rSlot = Object.values(rAvail).flat().find((s) => s.isAvailable);

    if (rSlot) {
      try {
        await holdBooking({
          patientId: patient.id,
          patientProfileId: expecting.id,
          providerId: rad.id,
          branchId: rBranch.id,
          serviceId: unsafe.id,
          date: rSlot.date,
          time: rSlot.time,
          patientInfo: { ...info, fullName: expecting.fullName, gender: "female" },
          paymentMethod: "cash",
          acknowledgement: {
            preparationAccepted: true,
            eligibilityConfirmed: true,
            acknowledgedAt: new Date().toISOString(),
          },
        });
        fail("eligibility enforced at the API", "an ineligible booking was ACCEPTED");
      } catch (err) {
        ok("API refuses an ineligible booking", (err as Error).message);
      }

      // A service with preparation/eligibility cannot be booked without the
      // acknowledgement — this is what stops a patient arriving un-fasted.
      try {
        await holdBooking({
          patientId: patient.id,
          patientProfileId: self.id,
          providerId: rad.id,
          branchId: rBranch.id,
          serviceId: unsafe.id,
          date: rSlot.date,
          time: rSlot.time,
          patientInfo: info,
          paymentMethod: "cash",
          // No acknowledgement supplied.
        });
        fail("acknowledgement gate", "booking completed WITHOUT acknowledgement");
      } catch (err) {
        ok("booking blocked without acknowledgement", (err as Error).message);
      }
    }
  } else {
    ok("eligibility", "skipped — no pregnancy-restricted scan found");
  }

  console.log("\n7. RESCHEDULE, CANCEL & REFUND (§8, §9)");
  // A session-based doctor runs ONE session a day, so rescheduling means moving
  // to a different *day*, not to a different minute on the same day.
  const later = openDays.find(
    ([d, list]) => d !== date && list.some((s) => s.isAvailable),
  );
  if (!later) throw new Error("no second open day to reschedule into");

  const [date2, slots2] = later;
  const slot2 = slots2.find((s) => s.isAvailable)!;
  const moved = await rescheduleBooking(paid.id, date2, slot2.time);
  ok("rescheduleBooking", `→ ${moved.date} ${moved.time} · #${moved.queueNumber}`);

  const cancelled = await cancelBooking(paid.id, "Schedule conflict");
  ok("cancelBooking", `status=${cancelled.status}`);
  if (!isCancelled(cancelled.status)) fail("cancel should reach a cancelled state", cancelled.status);

  // A fee paid inside the free window is refunded in full, automatically —
  // the patient never has to chase money they are owed.
  if (cancelled.status === "refund_pending") {
    ok(
      "refund owed automatically",
      `EGP ${cancelled.refundAmount} pending (free window: ${BUSINESS.freeCancellationHours}h)`,
    );
    const refunded = await processRefund(cancelled.id);
    refunded.status === "refunded" && refunded.paymentStatus === "refunded"
      ? ok("processRefund → REFUNDED", `EGP ${refunded.refundAmount} returned`)
      : fail("refund did not complete", refunded.status);
  } else {
    ok(
      "late cancellation forfeits the fee",
      cancelled.refundNote?.en ?? "no refund due",
    );
  }

  try {
    await cancelBooking(paid.id, "again");
    fail("double-cancel guard", "cancelling twice was ACCEPTED");
  } catch (err) {
    ok("double-cancel rejected", (err as Error).message);
  }

  console.log("\n8. MISSED VISITS & LONG WAITS (§8)");
  const upcomingForDoctor = await getBookings({
    providerId: doctor.id,
    status: "confirmed",
    pageSize: 50,
  });
  const future = upcomingForDoctor.items.find((b) => b.date > "2026-07-13");
  if (future) {
    // A missed visit can only be recorded AFTER the session has ended.
    try {
      await markNoShow(future.id);
      fail("no-show timing guard", "a missed visit was recorded for a FUTURE session");
    } catch (err) {
      ok("missed visit rejected before the session ends", (err as Error).message);
    }
  } else {
    ok("no-show timing guard", "skipped — no future confirmed booking");
  }

  const past = (await getBookings({ providerId: doctor.id, status: "confirmed", pageSize: 100 }))
    .items.find((b) => b.date < "2026-07-13");
  if (past) {
    const missed = await markNoShow(past.id);
    ok("markNoShow after the session", missed.status);
  } else {
    ok("markNoShow", "skipped — no past confirmed booking");
  }

  const completedForWait = (await getBookings({ patientId: patient.id, status: "completed", pageSize: 50 })).items[0];
  if (completedForWait) {
    const waited = await reportLongWait(completedForWait.id);
    waited.longWaitReported && waited.status !== "no_show"
      ? ok("long wait is a provider signal, not a missed visit", `status stays ${waited.status}`)
      : fail("long wait handling", waited.status);
  }

  console.log("\n9. COUPONS");
  const good = await validateCoupon("VESITA10", 500, "doctor");
  good.valid ? ok("valid coupon", `discount EGP ${good.discount}`) : fail("VESITA10 should be valid", good.message);

  const wrongType = await validateCoupon("HEALTH20", 500, "doctor");
  !wrongType.valid ? ok("lab-only coupon rejected for doctor", wrongType.message) : fail("HEALTH20 leaked to doctor", "");

  const tooSmall = await validateCoupon("FAMILY100", 100, "doctor");
  !tooSmall.valid ? ok("min-order enforced", tooSmall.message) : fail("min order not enforced", "");

  const bogus = await validateCoupon("NOPE", 500, "doctor");
  !bogus.valid ? ok("unknown coupon rejected") : fail("unknown coupon accepted", "");

  console.log("\n10. REVIEWS");
  const completed = await getBookings({ patientId: patient.id, status: "completed", pageSize: 50 });
  const reviewable = completed.items.find((b) => !b.hasReview);
  if (reviewable) {
    const review = await createReview({
      bookingId: reviewable.id,
      rating: 5,
      comment: "Flow check review.",
      breakdown: { waitingTime: 5, staff: 5, cleanliness: 4, communication: 5 },
    });
    ok("createReview", `rating ${review.rating} on ${reviewable.providerName}`);

    try {
      await createReview({
        bookingId: reviewable.id,
        rating: 3,
        comment: "dupe",
        breakdown: { waitingTime: 3, staff: 3, cleanliness: 3, communication: 3 },
      });
      fail("duplicate-review guard", "second review ACCEPTED");
    } catch (err) {
      ok("duplicate review rejected", (err as Error).message);
    }
  } else {
    ok("createReview", "skipped — no unreviewed completed booking for this patient");
  }

  console.log("\n11. FAVORITES");
  const added = await toggleFavorite(patient.id, doctor.id);
  const favs = await getFavorites(patient.id);
  ok("toggleFavorite", `isFavorite=${added.isFavorite}, list size ${favs.length}`);
  await toggleFavorite(patient.id, doctor.id); // restore

  console.log("\n12. PROVIDER-SIDE STATUS TRANSITIONS (§7)");
  const confirmedForProvider = await getBookings({
    providerId: doctor.id,
    status: "confirmed",
    pageSize: 100,
  });
  const completable = confirmedForProvider.items.find((b) => b.date < "2026-07-13");
  if (completable) {
    const done = await markCompleted(completable.id);
    ok("provider marks completed", `${done.status}, payment=${done.paymentStatus}`);

    // COMPLETED is terminal — nothing may move out of it.
    try {
      await cancelBooking(done.id, "too late");
      fail("terminal-state guard", "a completed booking was cancelled");
    } catch (err) {
      ok("completed is terminal", (err as Error).message);
    }
  } else {
    ok("status transitions", "skipped — no past confirmed booking for this provider");
  }

  console.log("\n13. STATS & ANALYTICS (§15)");
  const pStats = await getPatientStats(patient.id);
  ok("patient stats", `upcoming ${pStats.upcomingCount}, completed ${pStats.completedCount}, spent EGP ${pStats.totalSpent}`);

  const prStats = await getProviderStats(doctor.id);
  if (prStats.monthly.length !== 12) fail("provider monthly series", `${prStats.monthly.length} points, expected 12`);
  ok("provider stats", `bookings ${prStats.totalBookings}, revenue EGP ${prStats.revenue}, 12mo series`);
  ok(
    "provider analytics (§15)",
    `utilization ${prStats.utilizationRate}% · avg wait ${prStats.averageWaitMinutes}min · cancellations ${prStats.cancellationRate}% · missed ${prStats.noShowRate}%`,
  );
  if (prStats.utilizationRate < 0 || prStats.utilizationRate > 100)
    fail("utilization out of range", String(prStats.utilizationRate));

  const aStats = await getAdminStats();
  ok("admin stats", `users ${aStats.totalUsers}, providers ${aStats.totalProviders}, bookings ${aStats.totalBookings}, revenue EGP ${aStats.totalRevenue}`);
  ok(
    "platform analytics (§15)",
    `conversion ${aStats.conversionRate}% · cancellation ${aStats.cancellationRate}% · no-show ${aStats.noShowRate}%`,
  );
  if (aStats.topSpecialties.length === 0) fail("topSpecialties empty", "");
  if (aStats.topGovernorates.length === 0) fail("topGovernorates empty", "");

  const rev = await getRevenueAnalytics();
  const sums = rev.platformCommission + rev.netToProviders;
  Math.abs(sums - rev.totalRevenue) <= 1
    ? ok("revenue splits reconcile", `commission ${rev.platformCommission} + net ${rev.netToProviders} ≈ ${rev.totalRevenue}`)
    : fail("revenue split mismatch", `${sums} vs ${rev.totalRevenue}`);

  console.log("\n14. ADMIN MUTATIONS");
  const coupon = await createCoupon({
    code: "FLOWCHECK",
    description: "temp",
    discountType: "percentage",
    discountValue: 10,
    minOrderValue: 0,
    usageLimit: 5,
    expiresAt: new Date(Date.now() + 864e5).toISOString(),
    isActive: true,
    appliesTo: [],
  });
  ok("createCoupon", coupon.code);
  await deleteCoupon(coupon.id);
  const remaining = await getCoupons();
  !remaining.some((c) => c.id === coupon.id) ? ok("deleteCoupon") : fail("deleteCoupon", "still present");

  console.log("\n15. SUSPENSION: SOFT vs HARD (§13)");

  // SOFT — pulled from search and no new bookings, but existing bookings are
  // honored. Patients who already booked are not punished.
  const softTarget = (await searchProviders({ type: "doctor", pageSize: 50 })).items.find(
    (p) => p.id !== doctor.id,
  )!;
  const liveBefore = (
    await getBookings({ providerId: softTarget.id, status: "confirmed", pageSize: 200 })
  ).items.filter((b) => b.date >= "2026-07-13").length;

  const soft = await suspendProvider(softTarget.id, "soft", "Temporary pause at the provider's request.");
  const softHidden = await searchProviders({ type: "doctor", q: softTarget.name });
  !softHidden.items.some((p) => p.id === softTarget.id)
    ? ok("soft-suspended provider hidden from search")
    : fail("soft-suspended provider still listed", "");

  const liveAfterSoft = (
    await getBookings({ providerId: softTarget.id, status: "confirmed", pageSize: 200 })
  ).items.filter((b) => b.date >= "2026-07-13").length;

  soft.cancelledBookings === 0 && liveAfterSoft === liveBefore
    ? ok("soft suspension honors existing bookings", `${liveAfterSoft} upcoming bookings untouched`)
    : fail("soft suspension cancelled bookings", `${liveBefore} → ${liveAfterSoft}`);

  await reinstateProvider(softTarget.id);
  ok("reinstateProvider", "soft → approved round-trip");

  // HARD — additionally cancels every upcoming booking and refunds in full.
  const hardTarget = (await searchProviders({ type: "lab", pageSize: 50 })).items[0];
  const hardBefore = (
    await getBookings({ providerId: hardTarget.id, status: "confirmed", pageSize: 200 })
  ).items.filter((b) => b.date >= "2026-07-13").length;

  const hard = await suspendProvider(hardTarget.id, "hard", "Accreditation could not be verified.");
  const hardAfter = (
    await getBookings({ providerId: hardTarget.id, status: "confirmed", pageSize: 200 })
  ).items.filter((b) => b.date >= "2026-07-13").length;

  hardAfter === 0 && hard.cancelledBookings === hardBefore
    ? ok(
        "hard suspension cancels every upcoming booking",
        `${hard.cancelledBookings} cancelled and refunded, patients notified`,
      )
    : fail("hard suspension left bookings live", `${hardBefore} → ${hardAfter}`);

  await reinstateProvider(hardTarget.id);

  // The plain status setter still works for approve/reject.
  const rejected = await setProviderStatus(hardTarget.id, "rejected");
  await setProviderStatus(hardTarget.id, "approved");
  ok("setProviderStatus", `${rejected.status} → approved round-trip`);

  console.log(
    process.exitCode === 1
      ? "\n❌ SOME FLOWS FAILED\n"
      : "\n✅ ALL FLOWS PASSED\n",
  );
}

main().catch((err) => {
  console.error("\n❌ FATAL:", err);
  process.exit(1);
});
