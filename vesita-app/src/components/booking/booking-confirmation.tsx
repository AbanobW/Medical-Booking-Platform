"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Copy,
  Home,
  MapPin,
  Stethoscope,
  Users,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { OrderSummary } from "@/components/booking/order-summary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EASE } from "@/components/shared/motion";
import { formatDate, formatTime } from "@/lib/format";
import {
  BOOKING_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  type Booking,
} from "@/lib/types";

/** The final step — the booking exists. Show exactly what was agreed. */
export function BookingConfirmation({
  booking,
  branchName,
}: {
  booking: Booking;
  branchName?: string;
}) {
  async function copyReference() {
    try {
      await navigator.clipboard.writeText(booking.reference);
      toast.success("Reference copied to your clipboard.");
    } catch {
      toast.error("Couldn't copy — please write the reference down.");
    }
  }

  const isSession = booking.queueNumber !== undefined;

  const details = [
    {
      icon: Stethoscope,
      label: "Provider",
      value: `${booking.providerName} · ${booking.providerSpecialty}`,
    },
    { icon: CalendarDays, label: "Date", value: formatDate(booking.date) },
    isSession
      ? {
          icon: Users,
          label: "Your place in the session",
          value: `#${booking.queueNumber} · session starts ${formatTime(booking.time)}${
            booking.estimatedTime
              ? `, seen around ~${formatTime(booking.estimatedTime)}`
              : ""
          }`,
        }
      : {
          icon: Clock,
          label: "Appointment time",
          value: formatTime(booking.time),
        },
    {
      icon: MapPin,
      label: branchName ? `Branch · ${branchName}` : "Branch",
      value: booking.address,
    },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-8 text-center">
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="mx-auto flex size-20 items-center justify-center rounded-full bg-success/15 text-success"
      >
        <CheckCircle2 className="size-11" />
      </motion.div>

      <motion.div
        initial={{ y: 12, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.15, ease: EASE }}
        className="space-y-3"
      >
        <h1 className="text-3xl font-bold tracking-tight">Booking confirmed</h1>
        <p className="text-muted-foreground">
          {isSession ? (
            <>
              You are{" "}
              <span className="font-medium text-foreground">
                number {booking.queueNumber}
              </span>{" "}
              in the queue for {booking.patientInfo.fullName}
              {booking.estimatedTime && (
                <>
                  , expected to be seen around{" "}
                  <span className="font-medium text-foreground">
                    ~{formatTime(booking.estimatedTime)}
                  </span>
                </>
              )}
              . It&apos;s an estimate, not an exact minute.
            </>
          ) : (
            <>
              {booking.patientInfo.fullName} is booked for{" "}
              <span className="font-medium text-foreground">
                {formatTime(booking.time)}
              </span>{" "}
              on {formatDate(booking.date)}.
            </>
          )}
        </p>

        <div className="inline-flex items-center gap-3 rounded-xl border border-dashed bg-card px-4 py-2">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            Reference
          </span>
          <span className="font-mono text-lg font-bold tracking-wider">
            {booking.reference}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => void copyReference()}
            aria-label="Copy booking reference"
          >
            <Copy className="size-4" />
          </Button>
        </div>
      </motion.div>

      <motion.div
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.25, ease: EASE }}
        className="space-y-4 text-left"
      >
        <div className="rounded-2xl border bg-card p-5 shadow-soft">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">{booking.serviceName}</p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">
                {BOOKING_STATUS_LABELS[booking.status]}
              </Badge>
              <Badge variant="outline">
                {PAYMENT_METHOD_LABELS[booking.paymentMethod]}
              </Badge>
              {booking.overCapacity && (
                <Badge variant="outline">Over the comfort limit — longer wait</Badge>
              )}
            </div>
          </div>

          <dl className="grid gap-4 sm:grid-cols-2">
            {details.map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex gap-3">
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0">
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    {label}
                  </dt>
                  <dd className="text-sm font-medium">{value}</dd>
                </div>
              </div>
            ))}
          </dl>

          {booking.acknowledgement && (
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-success/30 bg-success/5 p-3">
              <ClipboardCheck className="mt-0.5 size-4 shrink-0 text-success" />
              <div>
                <p className="text-sm font-medium">Acknowledgement recorded</p>
                <p className="text-xs text-muted-foreground">
                  You confirmed you have read the preparation instructions and
                  that {booking.patientInfo.fullName} meets the eligibility
                  requirements.
                </p>
              </div>
            </div>
          )}

          {booking.patientInfo.notes && (
            <div className="mt-4 rounded-xl bg-muted/50 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Your notes
              </p>
              <p className="mt-1 text-sm">{booking.patientInfo.notes}</p>
            </div>
          )}
        </div>

        <OrderSummary
          serviceName={booking.serviceName}
          branchName={branchName}
          price={booking.price}
          discount={booking.discount}
          bookingFee={booking.bookingFee}
          cashback={booking.cashback}
          couponCode={booking.couponCode}
          isPaid={booking.paymentStatus === "paid"}
        />

        {booking.cashback > 0 && (
          <p className="flex items-center justify-center gap-2 text-sm text-success">
            <Wallet className="size-4" />
            You earned cashback on this booking.
          </p>
        )}
      </motion.div>

      <motion.div
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.35, ease: EASE }}
        className="flex flex-col gap-3 sm:flex-row sm:justify-center"
      >
        <Button
          className="h-11 rounded-xl px-5"
          render={<Link href="/patient/bookings" />}
        >
          View my bookings
        </Button>
        <Button
          variant="outline"
          className="h-11 rounded-xl px-5"
          render={<Link href="/" />}
        >
          <Home className="size-4" />
          Back to home
        </Button>
      </motion.div>
    </div>
  );
}
