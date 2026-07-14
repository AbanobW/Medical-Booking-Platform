"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { useBookingNames } from "@/components/patient/booking-names";
import { CalendarPicker } from "@/components/shared/calendar-picker";
import { ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAsync, useMutation } from "@/hooks/use-async";
import { rescheduleBooking } from "@/lib/api/bookings";
import { getAvailability } from "@/lib/api/providers";
import { useApiError } from "@/lib/i18n/use-api-error";
import { useFormat } from "@/lib/i18n/use-format";
import type { Booking } from "@/lib/types";

export function RescheduleDialog({
  booking,
  open,
  onOpenChange,
  onRescheduled,
}: {
  booking: Booking;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRescheduled: () => void;
}) {
  const t = useTranslations("patient");
  const { formatDate, formatTime } = useFormat();
  const names = useBookingNames(booking);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("reschedule.title")}</DialogTitle>
          <DialogDescription>
            {t("reschedule.description", {
              provider: names.provider,
              date: formatDate(booking.date),
              time: formatTime(booking.time),
            })}
          </DialogDescription>
        </DialogHeader>

        {/* Mounted only while open, so availability is fetched on demand. */}
        <RescheduleBody
          booking={booking}
          onOpenChange={onOpenChange}
          onRescheduled={onRescheduled}
        />
      </DialogContent>
    </Dialog>
  );
}

function RescheduleBody({
  booking,
  onOpenChange,
  onRescheduled,
}: {
  booking: Booking;
  onOpenChange: (open: boolean) => void;
  onRescheduled: () => void;
}) {
  const t = useTranslations("patient");
  const { formatDate, formatTime } = useFormat();
  const describeError = useApiError();

  const [date, setDate] = useState<string | undefined>();
  const [time, setTime] = useState<string | undefined>();

  const { data, error, isLoading, refetch } = useAsync(
    () => getAvailability(booking.providerId, 30),
    [booking.providerId],
  );

  const { mutate, isPending } = useMutation(rescheduleBooking);

  async function onConfirm() {
    if (!date || !time) return;

    try {
      await mutate(booking.id, date, time);
      toast.success(t("reschedule.toastTitle"), {
        description: t("reschedule.toastDescription", {
          date: formatDate(date),
          time: formatTime(time),
        }),
      });
      onOpenChange(false);
      onRescheduled();
    } catch (err) {
      toast.error(describeError(err));
    }
  }

  if (error) {
    return (
      <ErrorState
        title={t("reschedule.error")}
        description={describeError(error)}
        onRetry={refetch}
      />
    );
  }

  return (
    <>
      <CalendarPicker
        availability={data ?? {}}
        isLoading={isLoading}
        selectedDate={date}
        onSelectDate={(next) => {
          setDate(next);
          setTime(undefined);
        }}
        selectedTime={time}
        onSelectTime={setTime}
      />

      <DialogFooter>
        <Button
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={isPending}
          className="h-10 rounded-xl px-4"
        >
          {t("reschedule.keep")}
        </Button>
        <Button
          onClick={onConfirm}
          disabled={!date || !time || isPending}
          className="h-10 rounded-xl px-4"
        >
          {isPending ? t("reschedule.rescheduling") : t("reschedule.confirm")}
        </Button>
      </DialogFooter>
    </>
  );
}
