"use client";

import { useState } from "react";
import { CalendarX, ShieldCheck, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

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
import { BUSINESS, formatEGP } from "@/lib/site";
import { isHold, type Booking } from "@/lib/types";

/** The reasons the seed data already uses, so analytics stay consistent. */
const REASONS = [
  "Schedule conflict",
  "Found another provider",
  "Feeling better",
  "Cost concerns",
  "Provider unavailable",
  "Personal emergency",
  "Other",
];

const OPTIONS = REASONS.map((reason) => ({ value: reason, label: reason }));

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
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const { mutate, isPending } = useMutation(cancelBooking);

  const isOther = reason === "Other";
  const finalReason = isOther ? details.trim() : reason;
  const canSubmit = finalReason.length > 0 && !isPending;

  // Tell the truth about the money *before* the patient decides (§8).
  const feePaid = booking.paymentStatus === "paid" && booking.bookingFee > 0;
  const free = isWithinFreeCancellation(booking);
  const stillHeld = isHold(booking.status);

  async function onConfirm() {
    if (!canSubmit) return;

    try {
      await mutate(booking.id, finalReason);
      toast.success("Booking cancelled.", {
        description: feePaid
          ? free
            ? `Your ${formatEGP(booking.bookingFee)} booking fee is being refunded.`
            : `Reference ${booking.reference} · the booking fee was not refunded.`
          : `Reference ${booking.reference} · ${booking.providerName}`,
      });
      onOpenChange(false);
      setReason("");
      setDetails("");
      onCancelled();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Couldn't cancel this booking. Please try again.",
      );
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive">
            <CalendarX />
          </AlertDialogMedia>
          <AlertDialogTitle>Cancel this appointment?</AlertDialogTitle>
          <AlertDialogDescription>
            Your appointment with {booking.providerName} on{" "}
            {booking.date} will be cancelled. It can&apos;t be undone — you would need
            to book again.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* What happens to the money ---------------------------------------- */}
        <div className="text-left">
          {stillHeld ? (
            <p className="flex items-start gap-2 rounded-xl border bg-muted/40 p-3 text-sm text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>
                This place is only being held — nothing has been charged, so there is
                nothing to refund.
              </span>
            </p>
          ) : !feePaid ? (
            <p className="flex items-start gap-2 rounded-xl border bg-muted/40 p-3 text-sm text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>
                You haven&apos;t paid an online booking fee for this appointment, so
                cancelling costs you nothing.
              </span>
            </p>
          ) : free ? (
            <p className="flex items-start gap-2 rounded-xl border border-success/20 bg-success/5 p-3 text-sm text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" />
              <span>
                You&apos;re cancelling more than {BUSINESS.freeCancellationHours} hours
                ahead, so your{" "}
                <span className="font-medium text-foreground">
                  {formatEGP(booking.bookingFee)}
                </span>{" "}
                booking fee is refunded in full, back to the way you paid. Banks can
                take up to {BUSINESS.refundWorkingDays} working days to show it.
              </span>
            </p>
          ) : (
            <p className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-muted-foreground">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
              <span>
                You&apos;re cancelling less than {BUSINESS.freeCancellationHours} hours
                before the appointment, so your{" "}
                <span className="font-medium text-destructive">
                  {formatEGP(booking.bookingFee)}
                </span>{" "}
                booking fee is <span className="font-medium">not refunded</span>. The
                visit fee itself was never charged — you only pay that at the clinic.
              </span>
            </p>
          )}
        </div>

        <div className="space-y-3 text-left">
          <div className="space-y-2">
            <Label htmlFor={`cancel-reason-${booking.id}`}>
              Why are you cancelling?
            </Label>
            <AppSelect
              id={`cancel-reason-${booking.id}`}
              value={reason}
              onValueChange={setReason}
              options={OPTIONS}
              placeholder="Choose a reason"
              disabled={isPending}
            />
          </div>

          {isOther && (
            <div className="space-y-2">
              <Label htmlFor={`cancel-details-${booking.id}`}>
                Tell us more
              </Label>
              <Textarea
                id={`cancel-details-${booking.id}`}
                value={details}
                onChange={(event) => setDetails(event.target.value)}
                placeholder="Add a short explanation…"
                disabled={isPending}
                rows={3}
              />
            </div>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>
            Keep appointment
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={!canSubmit}
            onClick={onConfirm}
          >
            {isPending ? "Cancelling…" : "Cancel booking"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
