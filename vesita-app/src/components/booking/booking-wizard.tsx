"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Clock,
  Loader2,
  LogIn,
  MapPin,
  ShieldCheck,
  Star,
} from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { BookingConfirmation } from "@/components/booking/booking-confirmation";
import {
  CapacityDialog,
  EligibilityBlockedDialog,
  type CapacityConflict,
} from "@/components/booking/capacity-dialog";
import { PaymentStep, type AppliedCoupon } from "@/components/booking/payment-step";
import {
  PreparationStep,
  type AcknowledgementState,
} from "@/components/booking/preparation-step";
import { ProfilePicker } from "@/components/booking/profile-picker";
import { ServicePicker, serviceNamed } from "@/components/booking/service-picker";
import { StepIndicator } from "@/components/booking/step-indicator";
import { useAuth } from "@/components/providers/auth-provider";
import { CalendarPicker } from "@/components/shared/calendar-picker";
import { EASE } from "@/components/shared/motion";
import { ErrorState } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAsync } from "@/hooks/use-async";
import { demoUserFor } from "@/lib/api/auth";
import { estimatedTimeFor, scheduleFor } from "@/lib/api/availability";
import {
  beginPayment,
  bookingFeeFor,
  CapacityError,
  EligibilityError,
  findService,
  holdBooking,
  payBooking,
  releaseHold,
} from "@/lib/api/bookings";
import { ApiError } from "@/lib/api/client";
import { getAvailability } from "@/lib/api/providers";
import { getPatientProfiles } from "@/lib/api/profiles";
import { evaluateEligibility } from "@/lib/eligibility";
import { useApiError } from "@/lib/i18n/use-api-error";
import { useDomain, useFormat } from "@/lib/i18n/use-format";
import {
  branchPriceOf,
  requiresAcknowledgement,
  schedulingModeFor,
  type Acknowledgement,
  type Booking,
  type PatientInfo,
  type PatientProfile,
  type PaymentMethod,
  type Provider,
  type TimeSlot,
} from "@/lib/types";

type StepKey = "patient" | "service" | "prep" | "date" | "time" | "payment";

export function BookingWizard({ provider }: { provider: Provider }) {
  const { user, isAuthenticated } = useAuth();

  const t = useTranslations("booking");
  const tCommon = useTranslations("common");
  const { named } = useDomain();
  const { formatDate, formatTime, formatEGP, formatNumber, locale } = useFormat();
  const describeError = useApiError();

  // A guest still books — the appointment attaches to the demo patient account
  // so the flow works end to end and shows up in the patient dashboard.
  const account = useMemo(() => user ?? demoUserFor("patient"), [user]);

  const [stepIndex, setStepIndex] = useState(0);
  const [direction, setDirection] = useState(1);

  const [profileId, setProfileId] = useState<string | undefined>();
  const [branchId, setBranchId] = useState<string | undefined>();
  const [serviceId, setServiceId] = useState<string | undefined>();
  const [ack, setAck] = useState<AcknowledgementState>({
    preparationAccepted: false,
    eligibilityConfirmed: false,
  });
  const [date, setDate] = useState<string | undefined>();
  const [time, setTime] = useState<string | undefined>();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null);
  const [notes, setNotes] = useState("");

  const [held, setHeld] = useState<Booking | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [conflict, setConflict] = useState<CapacityConflict | null>(null);
  const [violations, setViolations] = useState<
    { code: string; message: string }[] | null
  >(null);

  // ---------------------------------------------------------------------
  // Data
  // ---------------------------------------------------------------------

  const profiles = useAsync(
    () => getPatientProfiles(account.id),
    [account.id],
  );

  const availability = useAsync(
    () =>
      branchId
        ? getAvailability(provider.id, 30, branchId)
        : Promise.resolve<Record<string, TimeSlot[]>>({}),
    [provider.id, branchId],
  );

  const branches = useMemo(
    () => provider.branches.filter((b) => b.isActive),
    [provider],
  );
  const branch = branches.find((b) => b.id === branchId);
  const service = serviceId ? findService(provider, serviceId) : undefined;
  const profile: PatientProfile | undefined = profiles.data?.find(
    (p) => p.id === profileId,
  );

  const mode = schedulingModeFor(provider.type);
  const needsAck = !!service && requiresAcknowledgement(service);
  const price = service ? branchPriceOf(branch, service) : provider.price;
  const fee = bookingFeeFor(paymentMethod);

  const serviceName = service ? named(serviceNamed(service)) : undefined;

  // The only branch is not a choice — take it.
  useEffect(() => {
    if (!branchId && branches.length === 1) setBranchId(branches[0].id);
  }, [branches, branchId]);

  // "Self" is the overwhelmingly common case — preselect it.
  useEffect(() => {
    if (!profileId && profiles.data && profiles.data.length > 0) {
      const self = profiles.data.find((p) => p.relationship === "self");
      setProfileId((self ?? profiles.data[0]).id);
    }
  }, [profiles.data, profileId]);

  const steps = useMemo<StepKey[]>(
    () =>
      needsAck
        ? ["patient", "service", "prep", "date", "time", "payment"]
        : ["patient", "service", "date", "time", "payment"],
    [needsAck],
  );

  const step = steps[Math.min(stepIndex, steps.length - 1)];

  const eligibility = useMemo(
    () =>
      service && profile
        ? evaluateEligibility(service, profile)
        : { eligible: true, violations: [] },
    [service, profile],
  );

  // ---------------------------------------------------------------------
  // The hold must never outlive the wizard (§9)
  // ---------------------------------------------------------------------

  const heldIdRef = useRef<string | null>(null);
  heldIdRef.current = held?.id ?? null;

  useEffect(() => {
    return () => {
      // Abandoning the wizard returns the place to capacity immediately.
      if (heldIdRef.current) void releaseHold(heldIdRef.current);
    };
  }, []);

  // ---------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------

  const canAdvance = (from: StepKey): boolean => {
    switch (from) {
      case "patient":
        return !!profileId;
      case "service":
        return !!branchId && !!serviceId;
      case "prep":
        return (
          eligibility.eligible &&
          ack.preparationAccepted &&
          ack.eligibilityConfirmed
        );
      case "date":
        return !!date;
      case "time":
        return !!time;
      case "payment":
        return true;
    }
  };

  const blockedMessage = (from: StepKey): string => {
    switch (from) {
      case "patient":
        return t("wizard.blocked.patient");
      case "service":
        return branchId
          ? t("wizard.blocked.service")
          : t("wizard.blocked.branch");
      case "prep":
        return eligibility.eligible
          ? t("wizard.blocked.acknowledge")
          : t("wizard.blocked.ineligible");
      case "date":
        return t("wizard.blocked.date");
      case "time":
        return t("wizard.blocked.time");
      case "payment":
        return "";
    }
  };

  const goToIndex = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(next, steps.length - 1));

      // Stepping away from payment abandons any place we were holding.
      if (steps[stepIndex] === "payment" && steps[clamped] !== "payment" && held) {
        void releaseHold(held.id);
        setHeld(null);
        availability.refetch();
      }

      setDirection(clamped > stepIndex ? 1 : -1);
      setStepIndex(clamped);
    },
    [steps, stepIndex, held, availability],
  );

  const goToStep = useCallback(
    (key: StepKey) => {
      const index = steps.indexOf(key);
      if (index >= 0) goToIndex(index);
    },
    [steps, goToIndex],
  );

  function goNext() {
    if (!canAdvance(step)) {
      toast.error(blockedMessage(step));
      return;
    }
    goToIndex(stepIndex + 1);
  }

  // ---------------------------------------------------------------------
  // Claiming the place (§6, §9, Appendix A)
  // ---------------------------------------------------------------------

  const acknowledgement: Acknowledgement | undefined = needsAck
    ? {
        preparationAccepted: ack.preparationAccepted,
        eligibilityConfirmed: ack.eligibilityConfirmed,
        acknowledgedAt: new Date().toISOString(),
      }
    : undefined;

  function patientInfoFor(target: PatientProfile): PatientInfo {
    return {
      fullName: target.fullName,
      phone: target.phone ?? account.phone,
      email: account.email,
      gender: target.gender,
      dateOfBirth: target.dateOfBirth,
      notes: notes.trim() ? notes.trim() : undefined,
      bookingForSomeoneElse: target.relationship !== "self",
    };
  }

  async function claimPlace(options?: {
    acceptOverCapacity?: boolean;
    date?: string;
    time?: string;
  }) {
    const when = { date: options?.date ?? date, time: options?.time ?? time };

    if (!profile || !branch || !service || !when.date || !when.time) {
      toast.error(t("wizard.toast.missingDetails"));
      return;
    }

    setIsSubmitting(true);

    try {
      const created = await holdBooking({
        patientId: account.id,
        patientProfileId: profile.id,
        providerId: provider.id,
        branchId: branch.id,
        serviceId: service.id,
        date: when.date,
        time: when.time,
        patientInfo: patientInfoFor(profile),
        paymentMethod,
        couponCode: coupon?.code,
        acknowledgement,
        acceptOverCapacity: options?.acceptOverCapacity,
      });

      // Cash carries no online fee, so the booking is confirmed outright (§9).
      if (created.status === "confirmed") {
        setBooking(created);
        toast.success(t("wizard.toast.confirmed"));
        return;
      }

      // An online fee applies: the place is held while the fee is paid.
      const awaiting = await beginPayment(created.id);
      setHeld(awaiting);
    } catch (error) {
      if (error instanceof CapacityError) {
        setConflict({
          kind: error.kind,
          message: error.message,
          detail: error.detail,
        });
        return;
      }

      if (error instanceof EligibilityError) {
        setViolations(error.violations);
        return;
      }

      if (error instanceof ApiError && (error.status === 409 || error.status === 410)) {
        toast.error(describeError(error));
        setTime(undefined);
        availability.refetch();
        goToStep("time");
        return;
      }

      toast.error(describeError(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  /** The hold lapsed while the patient was paying — the place is gone (§9). */
  const handleExpire = useCallback(() => {
    setHeld(null);
    availability.refetch();
    toast.error(t("wizard.toast.expired"));
    goToStep("time");
  }, [availability, goToStep, t]);

  async function handlePay(outcome: "success" | "failure") {
    if (!held) return;

    setIsPaying(true);
    try {
      const paid = await payBooking(held.id, outcome);
      setHeld(null);
      setBooking(paid);
      toast.success(t("wizard.toast.paid"));
    } catch (error) {
      // Failure or a lapsed window: the API discards the hold and releases the
      // place. Never leave the patient in a half-booked state.
      setHeld(null);
      availability.refetch();
      setTime(undefined);
      toast.error(describeError(error));
      goToStep("time");
    } finally {
      setIsPaying(false);
    }
  }

  async function handleCancelHold() {
    if (!held) return;

    const id = held.id;
    setHeld(null);
    await releaseHold(id);
    availability.refetch();
    toast.info(t("wizard.toast.released"));
    goToStep("time");
  }

  function takeNextSlot(slot: TimeSlot) {
    setConflict(null);
    setDate(slot.date);
    setTime(slot.time);
    void claimPlace({ date: slot.date, time: slot.time });
  }

  // ---------------------------------------------------------------------
  // Slot copy (§5)
  // ---------------------------------------------------------------------

  const slotSubtitle = useCallback(
    (slot: TimeSlot): string => {
      if (mode === "session") {
        const queueNumber = slot.taken + 1;
        const day = branch ? scheduleFor(branch, slot.date) : undefined;
        const estimate = day ? estimatedTimeFor(day, queueNumber) : undefined;

        const number = formatNumber(queueNumber);

        if (estimate) {
          const params = { number, time: formatTime(estimate) };
          return slot.isFull
            ? t("slot.sessionBusyWithTime", params)
            : t("slot.sessionWithTime", params);
        }

        return slot.isFull
          ? t("slot.sessionBusy", { number })
          : t("slot.session", { number });
      }

      if (slot.isFull) {
        // A strict limit is genuinely full; a comfort limit is merely busy (§6).
        return slot.capacityType === "strict"
          ? t("slot.fullyBooked")
          : t("slot.busy");
      }

      return t("slot.placesLeft", {
        remaining: formatNumber(slot.remaining),
        capacity: formatNumber(slot.capacity),
      });
    },
    [mode, branch, t, formatNumber, formatTime],
  );

  // ---------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------

  if (booking) {
    return <BookingConfirmation booking={booking} branchName={branch?.name} />;
  }

  const stepLabels = steps.map((key) => t(`steps.${key}`));
  const nextStepLabel =
    stepIndex + 1 < steps.length ? t(`steps.${steps[stepIndex + 1]}`) : "";

  // The wizard slides forward towards the reading edge, so it flips under RTL.
  const slide = direction * (locale === "ar" ? -32 : 32);

  return (
    <div className="space-y-6">
      <ProviderSummary provider={provider} />

      <div className="rounded-2xl border bg-card p-4 shadow-soft sm:p-6">
        <StepIndicator
          steps={stepLabels}
          current={stepIndex}
          onStepClick={goToIndex}
          className="mb-6"
        />

        {!isAuthenticated && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed bg-muted/40 p-3">
            <p className="text-sm text-muted-foreground">
              {t("wizard.guestNotice")}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="h-9 rounded-xl"
              render={<Link href={`/login?next=/booking/${provider.slug}`} />}
            >
              <LogIn className="size-4" />
              {tCommon("actions.signIn")}
            </Button>
          </div>
        )}

        <div className="min-h-[22rem]">
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              initial={{ opacity: 0, x: slide }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -slide }}
              transition={{ duration: 0.28, ease: EASE }}
            >
              {step === "patient" && (
                <ProfilePicker
                  accountId={account.id}
                  profiles={profiles.data}
                  isLoading={profiles.isLoading}
                  error={profiles.error}
                  onRetry={profiles.refetch}
                  selectedId={profileId}
                  onSelect={setProfileId}
                  onCreated={(created) => {
                    profiles.setData((current) => [...(current ?? []), created]);
                    setProfileId(created.id);
                  }}
                />
              )}

              {step === "service" && (
                <ServicePicker
                  provider={provider}
                  branchId={branchId}
                  onSelectBranch={(id) => {
                    if (id === branchId) return;
                    // Services, prices and schedules are all branch-specific.
                    setBranchId(id);
                    setServiceId(undefined);
                    setDate(undefined);
                    setTime(undefined);
                  }}
                  serviceId={serviceId}
                  onSelectService={(id) => {
                    setServiceId(id);
                    setAck({
                      preparationAccepted: false,
                      eligibilityConfirmed: false,
                    });
                  }}
                />
              )}

              {step === "prep" && service && profile && (
                <PreparationStep
                  service={service}
                  profile={profile}
                  value={ack}
                  onChange={setAck}
                  onChangeProfile={() => goToStep("patient")}
                  onChangeService={() => goToStep("service")}
                />
              )}

              {step === "date" && (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-lg font-semibold">{t("date.title")}</h2>
                    <p className="text-sm text-muted-foreground">
                      {branch
                        ? t("date.subtitleBranch", { branch: branch.name })
                        : t("date.subtitle")}
                    </p>
                  </div>

                  {availability.error ? (
                    <ErrorState
                      description={describeError(availability.error)}
                      onRetry={availability.refetch}
                    />
                  ) : (
                    <CalendarPicker
                      availability={availability.data ?? {}}
                      isLoading={availability.isLoading}
                      selectedDate={date}
                      onSelectDate={(next) => {
                        setDate(next);
                        setTime(undefined);
                      }}
                    />
                  )}
                </div>
              )}

              {step === "time" && (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-lg font-semibold">
                      {mode === "session"
                        ? t("time.sessionTitle")
                        : t("time.slotTitle")}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {mode === "session"
                        ? t("time.sessionSubtitle")
                        : date
                          ? t("time.slotSubtitle", { date: formatDate(date) })
                          : t("time.pickDateFirst")}
                    </p>
                  </div>

                  {availability.error ? (
                    <ErrorState
                      description={describeError(availability.error)}
                      onRetry={availability.refetch}
                    />
                  ) : (
                    <CalendarPicker
                      availability={availability.data ?? {}}
                      isLoading={availability.isLoading}
                      selectedDate={date}
                      onSelectDate={(next) => {
                        setDate(next);
                        setTime(undefined);
                      }}
                      selectedTime={time}
                      onSelectTime={setTime}
                      mode={mode}
                      slotSubtitle={slotSubtitle}
                    />
                  )}
                </div>
              )}

              {step === "payment" && (
                <PaymentStep
                  provider={provider}
                  serviceName={serviceName ?? t("wizard.fallbackServiceName")}
                  branchName={branch?.name}
                  price={price}
                  method={paymentMethod}
                  onMethodChange={setPaymentMethod}
                  coupon={coupon}
                  onCouponChange={setCoupon}
                  notes={notes}
                  onNotesChange={setNotes}
                  held={held}
                  isPaying={isPaying}
                  onPay={(outcome) => void handlePay(outcome)}
                  onExpire={handleExpire}
                  onCancelHold={() => void handleCancelHold()}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-8 flex flex-col-reverse gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() => goToIndex(stepIndex - 1)}
            disabled={stepIndex === 0 || isSubmitting || isPaying}
            className="h-11 rounded-xl px-4"
          >
            <ArrowLeft className="size-4 rtl:rotate-180" />
            {tCommon("actions.back")}
          </Button>

          <div className="flex items-center gap-4 sm:justify-end">
            <SelectionSummary
              patientName={profile?.fullName}
              serviceName={serviceName}
              price={service ? price : undefined}
              date={date}
              time={time}
            />

            {/* While a place is held, the payment panel owns the actions. */}
            {!(step === "payment" && held) && (
              <Button
                type="button"
                onClick={() =>
                  step === "payment" ? void claimPlace() : goNext()
                }
                disabled={isSubmitting || !canAdvance(step)}
                className="h-11 flex-1 rounded-xl px-5 sm:flex-none"
              >
                {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                {step === "payment"
                  ? isSubmitting
                    ? t("wizard.reserving")
                    : fee > 0
                      ? t("wizard.holdAndPay", { fee: formatEGP(fee) })
                      : t("wizard.confirmBooking")
                  : t("wizard.continueTo", {
                      step: nextStepLabel.toLocaleLowerCase(locale),
                    })}
                {!isSubmitting && step !== "payment" && (
                  <ArrowRight className="size-4 rtl:rotate-180" />
                )}
              </Button>
            )}
          </div>
        </div>
      </div>

      <CapacityDialog
        conflict={conflict}
        isPending={isSubmitting}
        onBookAnyway={() => {
          setConflict(null);
          // Explicit consent — the only way past a comfort limit (§6).
          void claimPlace({ acceptOverCapacity: true });
        }}
        onTakeNextSlot={takeNextSlot}
        onPickAnother={() => {
          setConflict(null);
          setTime(undefined);
          availability.refetch();
          goToStep("time");
        }}
        onOpenChange={(open) => {
          if (!open) setConflict(null);
        }}
      />

      <EligibilityBlockedDialog
        violations={violations}
        onOpenChange={(open) => {
          if (!open) setViolations(null);
        }}
        onChoosePatient={() => {
          setViolations(null);
          goToStep("patient");
        }}
      />
    </div>
  );
}

/** A running recap of the choices made so far, next to the Next button. */
function SelectionSummary({
  patientName,
  serviceName,
  price,
  date,
  time,
}: {
  patientName?: string;
  serviceName?: string;
  price?: number;
  date?: string;
  time?: string;
}) {
  const { formatDate, formatTime, formatEGP } = useFormat();

  if (!patientName && !serviceName && !date) return null;

  return (
    <div className="hidden text-end text-xs text-muted-foreground lg:block">
      {patientName && (
        <p className="max-w-[16rem] truncate font-medium text-foreground">
          {patientName}
        </p>
      )}
      {serviceName && (
        <p className="max-w-[16rem] truncate">
          {serviceName}
          {price !== undefined && ` · ${formatEGP(price)}`}
        </p>
      )}
      {date && (
        <p className="tabular-nums">
          {formatDate(date)}
          {time && ` · ${formatTime(time)}`}
        </p>
      )}
    </div>
  );
}

function ProviderSummary({ provider }: { provider: Provider }) {
  const t = useTranslations("booking");
  const { named, getGovernorateName } = useDomain();
  const { formatEGP, formatNumber } = useFormat();

  return (
    <div className="flex flex-col gap-4 rounded-2xl border bg-card p-4 shadow-soft sm:flex-row sm:items-center sm:p-5">
      <div className="relative size-16 shrink-0 overflow-hidden rounded-2xl border bg-muted sm:size-20">
        <Image
          src={provider.photo}
          alt={named(provider)}
          fill
          sizes="80px"
          className="object-cover"
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="truncate text-lg font-bold sm:text-xl">
            {named(provider)}
          </h1>
          {provider.status === "approved" && (
            <Badge variant="secondary" className="gap-1">
              <ShieldCheck className="size-3" />
              {t("provider.verified")}
            </Badge>
          )}
        </div>

        <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Star className="size-3.5 fill-warning text-warning" />
            <span className="font-medium text-foreground ltr-nums">
              {provider.rating.toFixed(1)}
            </span>
            <span className="ltr-nums">({formatNumber(provider.reviewCount)})</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3.5" />
            {getGovernorateName(provider.governorateId)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" />
            {t("provider.wait", {
              minutes: formatNumber(provider.waitingTimeMinutes),
            })}
          </span>
        </p>
      </div>

      <div className="shrink-0 text-start sm:text-end">
        <p className="text-xs text-muted-foreground">{t("provider.startsFrom")}</p>
        <p className="text-lg font-bold text-primary">{formatEGP(provider.price)}</p>
        <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
          <CalendarDays className="size-3" />
          {t("provider.bookings", {
            count: provider.bookingCount,
            n: formatNumber(provider.bookingCount),
          })}
        </p>
      </div>
    </div>
  );
}
