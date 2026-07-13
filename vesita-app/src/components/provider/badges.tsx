"use client";

import { AlertTriangle, Hourglass, UserX } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  BOOKING_STATUS_LABELS_PROVIDER,
  CAPACITY_LABELS,
  type BookingStatus,
  type CapacityType,
  type PaymentStatus,
  type ProviderStatus,
} from "@/lib/types";

/**
 * The nine booking states (§7), in provider-facing wording.
 *
 * "Cancelled by you" here means the *provider* cancelled — the patient-facing
 * labels read the other way round, which is why `BOOKING_STATUS_LABELS_PROVIDER`
 * exists.
 */
const BOOKING_TONES: Record<BookingStatus, string> = {
  held: "bg-warning/15 text-warning",
  awaiting_payment: "bg-warning/15 text-warning",
  confirmed: "bg-info/10 text-info",
  completed: "bg-success/10 text-success",
  no_show: "bg-muted text-muted-foreground",
  cancelled_by_patient: "bg-muted text-muted-foreground",
  cancelled_by_provider: "bg-destructive/10 text-destructive",
  refund_pending: "bg-warning/15 text-warning",
  refunded: "bg-primary/10 text-primary",
};

const BOOKING_LABELS: Record<BookingStatus, string> = BOOKING_STATUS_LABELS_PROVIDER;

export function BookingStatusBadge({
  status,
  className,
}: {
  status: BookingStatus;
  className?: string;
}) {
  return (
    <Badge
      variant="secondary"
      className={cn("font-medium whitespace-nowrap", BOOKING_TONES[status], className)}
    >
      {status === "no_show" && <UserX className="size-3" />}
      {BOOKING_LABELS[status]}
    </Badge>
  );
}

/**
 * The patient arrived and left after a long wait (§8).
 *
 * Deliberately *not* a missed visit: it is a signal against the provider's
 * waiting time, not against the patient.
 */
export function LongWaitBadge({ className }: { className?: string }) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "gap-1 font-medium whitespace-nowrap bg-warning/15 text-warning",
        className,
      )}
      title="This patient arrived and left after a long wait. It counts against your waiting time, not against them."
    >
      <Hourglass className="size-3" />
      Left after a long wait
    </Badge>
  );
}

/** Marks a place taken beyond a comfort limit, with the patient's consent (§5). */
export function OverCapacityBadge({ className }: { className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn("gap-1 font-normal whitespace-nowrap", className)}
      title="Booked beyond your comfort limit — the patient accepted a longer wait."
    >
      <AlertTriangle className="size-3" />
      Over comfort limit
    </Badge>
  );
}

export function CapacityTypeBadge({
  type,
  className,
}: {
  type: CapacityType;
  className?: string;
}) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "font-medium whitespace-nowrap",
        type === "strict"
          ? "bg-destructive/10 text-destructive"
          : "bg-info/10 text-info",
        className,
      )}
      title={CAPACITY_LABELS[type]}
    >
      {type === "strict" ? "Strict limit" : "Comfort limit"}
    </Badge>
  );
}

const PAYMENT_TONES: Record<PaymentStatus, string> = {
  paid: "bg-success/10 text-success",
  unpaid: "bg-muted text-muted-foreground",
  refunded: "bg-warning/15 text-warning",
};

const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  paid: "Paid",
  unpaid: "Unpaid",
  refunded: "Refunded",
};

export function PaymentStatusBadge({
  status,
  className,
}: {
  status: PaymentStatus;
  className?: string;
}) {
  return (
    <Badge
      variant="secondary"
      className={cn("font-medium", PAYMENT_TONES[status], className)}
    >
      {PAYMENT_LABELS[status]}
    </Badge>
  );
}

const PROVIDER_TONES: Record<ProviderStatus, string> = {
  approved: "bg-success/10 text-success",
  pending: "bg-warning/15 text-warning",
  rejected: "bg-destructive/10 text-destructive",
  suspended: "bg-destructive/10 text-destructive",
};

const PROVIDER_LABELS: Record<ProviderStatus, string> = {
  approved: "Approved",
  pending: "Pending review",
  rejected: "Rejected",
  suspended: "Suspended",
};

export function ProviderStatusBadge({
  status,
  className,
}: {
  status: ProviderStatus;
  className?: string;
}) {
  return (
    <Badge
      variant="secondary"
      className={cn("font-medium", PROVIDER_TONES[status], className)}
    >
      {PROVIDER_LABELS[status]}
    </Badge>
  );
}
