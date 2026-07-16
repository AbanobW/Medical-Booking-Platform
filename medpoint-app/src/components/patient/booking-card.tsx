"use client";

import Link from "next/link";
import {
  CalendarClock,
  CalendarX,
  Clock,
  Hourglass,
  Info,
  ListOrdered,
  MapPin,
  Star,
  Stethoscope,
  Undo2,
  UserRound,
  Wallet,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";

import { useBookingNames } from "@/components/patient/booking-names";
import { CancelBookingDialog } from "@/components/patient/cancel-booking-dialog";
import { LongWaitDialog } from "@/components/patient/long-wait-dialog";
import { RescheduleDialog } from "@/components/patient/reschedule-dialog";
import { CreateReviewDialog } from "@/components/patient/review-dialog";
import {
  BookingStatusBadge,
  PaymentStatusBadge,
} from "@/components/patient/booking-status-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { isUpcoming } from "@/lib/api/bookings";
import { useDomain, useFormat } from "@/lib/i18n/use-format";
import { useLabels } from "@/lib/i18n/use-labels";
import { BUSINESS } from "@/lib/site";
import {
  isCancelled,
  isHold,
  isRefundInFlight,
  type Booking,
  type PatientProfile,
} from "@/lib/types";

/** True while the booking can still be changed by the patient (§7). */
export function isModifiable(booking: Booking): boolean {
  return booking.status === "confirmed" || isHold(booking.status);
}

/**
 * "I arrived but left after a long wait" (§8).
 *
 * Only offered once the appointment is behind us, and never on a visit already
 * recorded as missed — that is a different claim, and the API rejects it.
 */
export function canReportLongWait(booking: Booking): boolean {
  return (
    !isUpcoming(booking) &&
    (booking.status === "confirmed" || booking.status === "completed") &&
    !booking.longWaitReported
  );
}

export function BookingCard({
  booking,
  profile,
  onChanged,
}: {
  booking: Booking;
  /** The patient profile this booking is for (§1) — resolved by the page. */
  profile?: PatientProfile;
  /** Called after a cancel / reschedule / review so the list can refetch. */
  onChanged: () => void;
}) {
  const t = useTranslations("patient");
  const L = useLabels();
  const {
    formatDate,
    formatTime,
    relativeDay,
    formatEGP,
    formatNumber,
    initialsOf,
  } = useFormat();
  const { localized } = useDomain();
  const names = useBookingNames(booking);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [longWaitOpen, setLongWaitOpen] = useState(false);

  // A past booking is no longer reschedulable or cancellable, even if it is
  // still sitting in `confirmed` waiting for the clinic to close it out.
  const canModify = isModifiable(booking) && isUpcoming(booking);
  // Reviews come only from a completed visit (§10).
  const canReview = booking.status === "completed" && !booking.hasReview;
  const canReportWait = canReportLongWait(booking);

  // Doctors run sessions: a queue number and an estimate, not an exact minute.
  const isQueued =
    booking.providerType === "doctor" && booking.queueNumber !== undefined;

  const feePaidOnline = booking.bookingFee > 0;

  const strong = (chunks: ReactNode) => (
    <span className="font-medium text-foreground">{chunks}</span>
  );

  // The cancellation reason is stored as one of the canonical English strings
  // (analytics key off it), so it is translated only here, at render.
  const reasonKey = `cancel.reasons.${booking.cancellationReason}`;
  const cancellationReason =
    booking.cancellationReason && t.has(reasonKey)
      ? t(reasonKey)
      : booking.cancellationReason;

  return (
    <Card className="overflow-hidden border-border/60 transition-shadow hover:shadow-card">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start gap-4">
          <Avatar className="size-16 shrink-0 rounded-2xl ring-1 ring-border">
            <AvatarImage
              src={booking.providerPhoto}
              alt={names.provider}
              className="rounded-2xl object-cover"
            />
            <AvatarFallback className="rounded-2xl font-semibold">
              {initialsOf(names.provider)}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate font-semibold leading-tight">
                  {names.provider}
                </h3>
                <p className="mt-0.5 flex items-center gap-1 truncate text-sm text-muted-foreground">
                  <Stethoscope className="size-3.5 shrink-0" />
                  {names.specialty}
                </p>
              </div>
              <BookingStatusBadge status={booking.status} />
            </div>

            <p className="mt-2 text-sm font-medium">{names.service}</p>
          </div>
        </div>

        {/* Who the booking is for (§1) --------------------------------------- */}
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/15 bg-primary/5 px-3 py-2 text-sm">
          <UserRound className="size-4 shrink-0 text-primary" />
          <span className="text-muted-foreground">{t("card.for")}</span>
          <span className="font-medium">
            {profile?.fullName ?? booking.patientInfo.fullName}
          </span>
          {profile && (
            <Badge variant="secondary" className="font-normal">
              {L.relationship(profile.relationship)}
            </Badge>
          )}
        </div>

        <div className="grid gap-2 rounded-xl bg-muted/50 p-3 text-sm sm:grid-cols-2">
          <p className="flex items-center gap-2">
            <CalendarClock className="size-4 shrink-0 text-muted-foreground" />
            <span className="font-medium">{relativeDay(booking.date)}</span>
            <span className="text-muted-foreground">
              {formatDate(booking.date)}
            </span>
          </p>

          {isQueued ? (
            <p className="flex items-center gap-2">
              <ListOrdered className="size-4 shrink-0 text-muted-foreground" />
              <span className="font-semibold tabular-nums ltr-nums">
                {t("card.queueNumber", {
                  number: formatNumber(booking.queueNumber!),
                })}
              </span>
              <span className="text-muted-foreground">
                {booking.estimatedTime
                  ? t("card.seenAround", {
                      time: formatTime(booking.estimatedTime),
                    })
                  : t("card.sessionFrom", { time: formatTime(booking.time) })}
              </span>
            </p>
          ) : (
            <p className="flex items-center gap-2">
              <Clock className="size-4 shrink-0 text-muted-foreground" />
              <span className="tabular-nums ltr-nums">
                {formatTime(booking.time)}
              </span>
              <span className="text-muted-foreground">
                {t("card.yourSlot")}
              </span>
            </p>
          )}

          <p className="flex items-center gap-2 sm:col-span-2">
            <MapPin className="mt-px size-4 shrink-0 text-muted-foreground" />
            <span className="line-clamp-1 text-muted-foreground">
              {booking.address}
            </span>
          </p>

          {isQueued && (
            <p className="flex items-start gap-2 text-xs text-muted-foreground sm:col-span-2">
              <Info className="mt-px size-3.5 shrink-0" />
              {t("card.queueNote")}
            </p>
          )}
        </div>

        {/* Money: online booking fee vs the visit fee paid at the clinic (§9) -- */}
        <div className="space-y-2 rounded-xl border p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Wallet className="size-4" />
              {t("card.bookingFee")}
            </span>
            <span className="flex items-center gap-2">
              <span className="font-semibold tabular-nums ltr-nums">
                {feePaidOnline
                  ? formatEGP(booking.bookingFee)
                  : t("card.noFee")}
              </span>
              {feePaidOnline && <PaymentStatusBadge status={booking.paymentStatus} />}
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-muted-foreground">{t("card.visitFee")}</span>
            <span className="flex items-center gap-2">
              {booking.discount > 0 && (
                <span className="text-xs text-muted-foreground line-through tabular-nums ltr-nums">
                  {formatEGP(booking.price)}
                </span>
              )}
              <span className="font-semibold tabular-nums text-primary ltr-nums">
                {formatEGP(booking.total)}
              </span>
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2 text-xs text-muted-foreground">
            <span>{L.paymentMethod(booking.paymentMethod)}</span>
            <span className="font-mono ltr-nums">{booking.reference}</span>
          </div>
        </div>

        {/* Refunds — the patient must never wonder where the money went (§8/§9) */}
        {isRefundInFlight(booking.status) && (
          <p
            className={
              booking.status === "refunded"
                ? "flex items-start gap-2 rounded-xl border border-success/20 bg-success/5 p-3 text-sm text-muted-foreground"
                : "flex items-start gap-2 rounded-xl border border-info/20 bg-info/5 p-3 text-sm text-muted-foreground"
            }
          >
            {booking.status === "refunded" ? (
              <Undo2 className="mt-0.5 size-4 shrink-0 text-success" />
            ) : (
              <Hourglass className="mt-0.5 size-4 shrink-0 text-info" />
            )}
            <span>
              {booking.status === "refunded"
                ? t.rich("card.refunded", {
                    amount: formatEGP(booking.refundAmount ?? booking.bookingFee),
                    b: strong,
                  })
                : t.rich("card.refundPending", {
                    amount: formatEGP(booking.refundAmount ?? booking.bookingFee),
                    days: formatNumber(BUSINESS.refundWorkingDays),
                    b: strong,
                  })}
            </span>
          </p>
        )}

        {booking.refundNote && (
          <p className="rounded-xl border border-warning/20 bg-warning/5 p-3 text-xs text-muted-foreground">
            <span className="font-medium text-warning">
              {t("card.refundNoteLabel")}
            </span>
            {localized(booking.refundNote)}
          </p>
        )}

        {isCancelled(booking.status) && cancellationReason && (
          <p className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs text-muted-foreground">
            <span className="font-medium text-destructive">
              {t("card.cancellationReasonLabel")}
            </span>
            {cancellationReason}
          </p>
        )}

        {booking.longWaitReported && (
          <p className="rounded-xl border bg-muted/40 p-3 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">
              {t("card.longWaitLabel")}
            </span>
            {t("card.longWaitBody")}
          </p>
        )}

        <div className="flex flex-wrap gap-2 border-t pt-4">
          {canModify && (
            <>
              <Button
                variant="outline"
                onClick={() => setRescheduleOpen(true)}
                className="h-10 rounded-xl px-4"
              >
                <CalendarClock className="size-4" />
                {t("card.reschedule")}
              </Button>
              <Button
                variant="destructive"
                onClick={() => setCancelOpen(true)}
                className="h-10 rounded-xl px-4"
              >
                <CalendarX className="size-4" />
                {t("card.cancel")}
              </Button>
            </>
          )}

          {canReview && (
            <Button
              onClick={() => setReviewOpen(true)}
              className="h-10 rounded-xl px-4"
            >
              <Star className="size-4" />
              {t("card.leaveReview")}
            </Button>
          )}

          {booking.status === "completed" && booking.hasReview && (
            <Button
              render={<Link href="/patient/reviews" />}
              variant="outline"
              className="h-10 rounded-xl px-4"
            >
              <Star className="size-4" />
              {t("card.viewReview")}
            </Button>
          )}

          {canReportWait && (
            <Button
              variant="outline"
              onClick={() => setLongWaitOpen(true)}
              className="h-10 rounded-xl px-4"
            >
              <Hourglass className="size-4" />
              {t("card.reportLongWait")}
            </Button>
          )}

          {isCancelled(booking.status) && (
            <Button
              render={<Link href="/search" />}
              variant="outline"
              className="h-10 rounded-xl px-4"
            >
              {t("card.bookAgain")}
            </Button>
          )}
        </div>
      </CardContent>

      {canModify && (
        <>
          <CancelBookingDialog
            booking={booking}
            open={cancelOpen}
            onOpenChange={setCancelOpen}
            onCancelled={onChanged}
          />
          <RescheduleDialog
            booking={booking}
            open={rescheduleOpen}
            onOpenChange={setRescheduleOpen}
            onRescheduled={onChanged}
          />
        </>
      )}

      {canReview && (
        <CreateReviewDialog
          booking={booking}
          open={reviewOpen}
          onOpenChange={setReviewOpen}
          onCreated={onChanged}
        />
      )}

      {canReportWait && (
        <LongWaitDialog
          booking={booking}
          open={longWaitOpen}
          onOpenChange={setLongWaitOpen}
          onReported={onChanged}
        />
      )}
    </Card>
  );
}
