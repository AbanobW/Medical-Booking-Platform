"use client";

import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { CalendarX, ShieldCheck, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { useBookingNames } from "@/components/patient/booking-names";
import { AppSelect } from "@/components/ui/app-select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMutation } from "@/hooks/use-async";
import { cancelBooking, isWithinFreeCancellation } from "@/lib/api/bookings";
import { useApiError } from "@/lib/i18n/use-api-error";
import { useFormat } from "@/lib/i18n/use-format";
import { BUSINESS } from "@/lib/site";
import { isHold, type Booking } from "@/lib/types";

/**
 * The reasons the seed data already uses, so analytics stay consistent.
 *
 * These strings are the stored *value* — the identifier the API and the reports
 * key off. Only the label the patient reads is translated.
 */
const REASONS = [
  "Schedule conflict",
  "Found another provider",
  "Feeling better",
  "Cost concerns",
  "Provider unavailable",
  "Personal emergency",
  "Other",
];

export function CancelBookingDialog({
  booking,
  open,
  onOpenChange,
  onCancelled,
}: {
  booking: Booking;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCancelled: () => void;
}) {
  const t = useTranslations("patient");
  const { formatDate, formatEGP, formatNumber } = useFormat();
  const describeError = useApiError();
  const names = useBookingNames(booking);

  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const { mutate, isPending } = useMutation(cancelBooking);

  const isOther = reason === "Other";
  const finalReason = isOther ? details.trim() : reason;
  const canSubmit = finalReason.length > 0 && !isPending;

  const options = REASONS.map((value) => ({
    value,
    label: t(`cancel.reasons.${value}`),
  }));

  // Tell the truth about the money *before* the patient decides (§8).
  const feePaid = booking.paymentStatus === "paid" && booking.bookingFee > 0;
  const free = isWithinFreeCancellation(booking);
  const stillHeld = isHold(booking.status);

  const strong = (chunks: ReactNode) => (
    <span className="font-medium text-foreground">{chunks}</span>
  );
  const lost = (chunks: ReactNode) => (
    <span className="font-medium text-destructive">{chunks}</span>
  );
  const emphasis = (chunks: ReactNode) => (
    <span className="font-medium">{chunks}</span>
  );

  async function onConfirm() {
    if (!canSubmit) return;

    try {
      await mutate(booking.id, finalReason);
      toast.success(t("cancel.toastTitle"), {
        description: feePaid
          ? free
            ? t("cancel.toastRefunded", {
                amount: formatEGP(booking.bookingFee),
              })
            : t("cancel.toastNotRefunded", { reference: booking.reference })
          : t("cancel.toastPlain", {
              reference: booking.reference,
              provider: names.provider,
            }),
      });
      onOpenChange(false);
      setReason("");
      setDetails("");
      onCancelled();
    } catch (error) {
      toast.error(describeError(error));
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive">
            <CalendarX />
          </AlertDialogMedia>
          <AlertDialogTitle>{t("cancel.title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("cancel.description", {
              provider: names.provider,
              date: formatDate(booking.date),
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* What happens to the money ---------------------------------------- */}
        <div className="text-start">
          {stillHeld ? (
            <p className="flex items-start gap-2 rounded-xl border bg-muted/40 p-3 text-sm text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>{t("cancel.held")}</span>
            </p>
          ) : !feePaid ? (
            <p className="flex items-start gap-2 rounded-xl border bg-muted/40 p-3 text-sm text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>{t("cancel.notPaid")}</span>
            </p>
          ) : free ? (
            <p className="flex items-start gap-2 rounded-xl border border-success/20 bg-success/5 p-3 text-sm text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" />
              <span>
                {t.rich("cancel.free", {
                  hours: formatNumber(BUSINESS.freeCancellationHours),
                  amount: formatEGP(booking.bookingFee),
                  days: formatNumber(BUSINESS.refundWorkingDays),
                  b: strong,
                })}
              </span>
            </p>
          ) : (
            <p className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-muted-foreground">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
              <span>
                {t.rich("cancel.late", {
                  hours: formatNumber(BUSINESS.freeCancellationHours),
                  amount: formatEGP(booking.bookingFee),
                  b: lost,
                  s: emphasis,
                })}
              </span>
            </p>
          )}
        </div>

        <div className="space-y-3 text-start">
          <div className="space-y-2">
            <Label htmlFor={`cancel-reason-${booking.id}`}>
              {t("cancel.reasonLabel")}
            </Label>
            <AppSelect
              id={`cancel-reason-${booking.id}`}
              value={reason}
              onValueChange={setReason}
              options={options}
              placeholder={t("cancel.reasonPlaceholder")}
              disabled={isPending}
            />
          </div>

          {isOther && (
            <div className="space-y-2">
              <Label htmlFor={`cancel-details-${booking.id}`}>
                {t("cancel.detailsLabel")}
              </Label>
              <Textarea
                id={`cancel-details-${booking.id}`}
                value={details}
                onChange={(event) => setDetails(event.target.value)}
                placeholder={t("cancel.detailsPlaceholder")}
                disabled={isPending}
                rows={3}
              />
            </div>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>
            {t("cancel.keep")}
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={!canSubmit}
            onClick={onConfirm}
          >
            {isPending ? t("cancel.cancelling") : t("cancel.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
