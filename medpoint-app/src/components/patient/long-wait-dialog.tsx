"use client";

import { Hourglass, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { useBookingNames } from "@/components/patient/booking-names";
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
import { useApiError } from "@/lib/i18n/use-api-error";
import { useFormat } from "@/lib/i18n/use-format";
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
  const t = useTranslations("patient");
  const { formatDate } = useFormat();
  const describeError = useApiError();
  const names = useBookingNames(booking);

  const { mutate, isPending } = useMutation(reportLongWait);

  const strong = (chunks: ReactNode) => (
    <span className="font-medium text-foreground">{chunks}</span>
  );

  async function onConfirm() {
    try {
      await mutate(booking.id);
      toast.success(t("longWait.toastTitle"), {
        description: t("longWait.toastDescription", {
          provider: names.provider,
        }),
      });
      onOpenChange(false);
      onReported();
    } catch (error) {
      toast.error(describeError(error));
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-warning/15 text-warning">
            <Hourglass />
          </AlertDialogMedia>
          <AlertDialogTitle>{t("longWait.title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("longWait.description", {
              provider: names.provider,
              date: formatDate(booking.date),
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <p className="flex items-start gap-2 rounded-xl border border-success/20 bg-success/5 p-3 text-start text-sm text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" />
          <span>{t.rich("longWait.reassurance", { b: strong })}</span>
        </p>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>
            {t("longWait.never")}
          </AlertDialogCancel>
          <AlertDialogAction disabled={isPending} onClick={onConfirm}>
            {isPending ? t("longWait.recording") : t("longWait.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
