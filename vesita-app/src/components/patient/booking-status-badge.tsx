"use client";

import {
  CalendarCheck,
  CalendarX,
  CheckCircle2,
  CreditCard,
  Hourglass,
  Timer,
  Undo2,
  UserX,
  XCircle,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  BOOKING_STATUS_LABELS,
  type BookingStatus,
  type PaymentStatus,
} from "@/lib/types";

/**
 * The nine booking states (§7), each with an icon and a tone.
 *
 * Labels come from `BOOKING_STATUS_LABELS` so the patient-facing wording stays
 * in one place — "Cancelled by you" means the patient here, not the provider.
 */
const STATUS: Record<BookingStatus, { icon: LucideIcon; className: string }> = {
  held: {
    icon: Timer,
    className: "bg-warning/15 text-warning",
  },
  awaiting_payment: {
    icon: CreditCard,
    className: "bg-warning/15 text-warning",
  },
  confirmed: {
    icon: CalendarCheck,
    className: "bg-info/10 text-info",
  },
  completed: {
    icon: CheckCircle2,
    className: "bg-success/10 text-success",
  },
  no_show: {
    icon: UserX,
    className: "bg-destructive/10 text-destructive",
  },
  cancelled_by_patient: {
    icon: XCircle,
    className: "bg-muted text-muted-foreground",
  },
  cancelled_by_provider: {
    icon: CalendarX,
    className: "bg-destructive/10 text-destructive",
  },
  refund_pending: {
    icon: Hourglass,
    className: "bg-info/10 text-info",
  },
  refunded: {
    icon: Undo2,
    className: "bg-success/10 text-success",
  },
};

export function BookingStatusBadge({
  status,
  className,
}: {
  status: BookingStatus;
  className?: string;
}) {
  const { icon: Icon, className: tone } = STATUS[status];

  return (
    <Badge variant="secondary" className={cn("gap-1 font-medium", tone, className)}>
      <Icon />
      {BOOKING_STATUS_LABELS[status]}
    </Badge>
  );
}

const PAYMENT_TONES: Record<PaymentStatus, string> = {
  paid: "bg-success/10 text-success",
  unpaid: "bg-muted text-muted-foreground",
  refunded: "bg-info/10 text-info",
};

const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  paid: "Paid",
  unpaid: "Unpaid",
  refunded: "Refunded",
};

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return (
    <Badge
      variant="secondary"
      className={cn("font-normal", PAYMENT_TONES[status])}
    >
      {PAYMENT_LABELS[status]}
    </Badge>
  );
}
