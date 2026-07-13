"use client";

import { Hourglass, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

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
import { useMutation } from "@/hooks/use-async";
import { reportLongWait } from "@/lib/api/bookings";
import type { Booking } from "@/lib/types";

/**
 * "I arrived but left after a long wait" (§8).
 *
 * This is emphatically *not* a missed visit. A missed visit means the patient
 * did not arrive, and only the provider can record one. This report goes the
 * other way: it counts against the provider's waiting-time reputation, where the
 * responsibility actually lies. The copy has to make that unmistakable, because
 * a patient who fears being penalised will simply never tell us.
 */
export function LongWaitDialog({
  booking,
  open,
  onOpenChange,
  onReported,
}: {
  booking: Booking;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReported: () => void;
}) {
  const { mutate, isPending } = useMutation(reportLongWait);

  async function onConfirm() {
    try {
      await mutate(booking.id);
      toast.success("Thank you — that's recorded against the waiting time.", {
        description: `${booking.providerName}'s waiting-time rating reflects this. Nothing is held against you.`,
      });
      onOpenChange(false);
      onReported();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Couldn't record that right now. Please try again.",
      );
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-warning/15 text-warning">
            <Hourglass />
          </AlertDialogMedia>
          <AlertDialogTitle>You waited too long and left?</AlertDialogTitle>
          <AlertDialogDescription>
            Tell us and we&apos;ll record it against {booking.providerName}&apos;s
            waiting time on {booking.date}.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <p className="flex items-start gap-2 rounded-xl border border-success/20 bg-success/5 p-3 text-left text-sm text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" />
          <span>
            This is <span className="font-medium text-foreground">not</span> a missed
            visit and nothing is held against you. You turned up — the wait didn&apos;t
            hold up its end. It feeds the provider&apos;s waiting-time reputation, so
            other patients see an honest picture before they book.
          </span>
        </p>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Never mind</AlertDialogCancel>
          <AlertDialogAction disabled={isPending} onClick={onConfirm}>
            {isPending ? "Recording…" : "Yes, I left after a long wait"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
