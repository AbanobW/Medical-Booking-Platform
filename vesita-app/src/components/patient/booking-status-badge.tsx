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
import { useLabels } from "@/lib/i18n/use-labels";
import { cn } from "@/lib/utils";
import type { BookingStatus, PaymentStatus } from "@/lib/types";

/**
 * The nine booking states (§7), each with an icon and a tone.
 *
 * The wording comes from `useLabels().bookingStatus` — the *patient-facing*
 * vocabulary, where "cancelled by you" means the patient cancelled, not the
 * provider.
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
  const L = useLabels();
  const { icon: Icon, className: tone } = STATUS[status];

  return (
    <Badge variant="secondary" className={cn("gap-1 font-medium", tone, className)}>
      <Icon />
      {L.bookingStatus(status)}
    </Badge>
  );
}

const PAYMENT_TONES: Record<PaymentStatus, string> = {
  paid: "bg-success/10 text-success",
  unpaid: "bg-muted text-muted-foreground",
  refunded: "bg-info/10 text-info",
};

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const L = useLabels();

  return (
    <Badge
      variant="secondary"
      className={cn("font-normal", PAYMENT_TONES[status])}
    >
      {L.paymentStatus(status)}
    </Badge>
  );
}
