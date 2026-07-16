"use client";

import { AlertTriangle, Hourglass, UserX } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { useLabels } from "@/lib/i18n/use-labels";
import { cn } from "@/lib/utils";
import type {
  BookingStatus,
  CapacityType,
  PaymentStatus,
  ProviderStatus,
} from "@/lib/types";

/**
 * The nine booking states (§7), in provider-facing wording.
 *
 * "Cancelled by you" here means the *provider* cancelled — the patient-facing
 * labels read the other way round, which is why `bookingStatusProvider` exists
 * alongside `bookingStatus`.
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

export function BookingStatusBadge({
  status,
  className,
}: {
  status: BookingStatus;
  className?: string;
}) {
  const L = useLabels();

  return (
    <Badge
      variant="secondary"
      className={cn("font-medium whitespace-nowrap", BOOKING_TONES[status], className)}
    >
      {status === "no_show" && <UserX className="size-3" />}
      {L.bookingStatusProvider(status)}
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
  const t = useTranslations("provider");

  return (
    <Badge
      variant="secondary"
      className={cn(
        "gap-1 font-medium whitespace-nowrap bg-warning/15 text-warning",
        className,
      )}
      title={t("badges.longWaitTitle")}
    >
      <Hourglass className="size-3" />
      {t("badges.longWait")}
    </Badge>
  );
}

/** Marks a place taken beyond a comfort limit, with the patient's consent (§5). */
export function OverCapacityBadge({ className }: { className?: string }) {
  const t = useTranslations("provider");

  return (
    <Badge
      variant="outline"
      className={cn("gap-1 font-normal whitespace-nowrap", className)}
      title={t("badges.overCapacityTitle")}
    >
      <AlertTriangle className="size-3" />
      {t("badges.overCapacity")}
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
  const t = useTranslations("provider");
  const L = useLabels();

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
      title={L.capacity(type)}
    >
      {type === "strict" ? t("badges.strictLimit") : t("badges.comfortLimit")}
    </Badge>
  );
}

const PAYMENT_TONES: Record<PaymentStatus, string> = {
  paid: "bg-success/10 text-success",
  unpaid: "bg-muted text-muted-foreground",
  refunded: "bg-warning/15 text-warning",
};

export function PaymentStatusBadge({
  status,
  className,
}: {
  status: PaymentStatus;
  className?: string;
}) {
  const L = useLabels();

  return (
    <Badge
      variant="secondary"
      className={cn("font-medium", PAYMENT_TONES[status], className)}
    >
      {L.paymentStatus(status)}
    </Badge>
  );
}

const PROVIDER_TONES: Record<ProviderStatus, string> = {
  approved: "bg-success/10 text-success",
  pending: "bg-warning/15 text-warning",
  rejected: "bg-destructive/10 text-destructive",
  suspended: "bg-destructive/10 text-destructive",
};

export function ProviderStatusBadge({
  status,
  className,
}: {
  status: ProviderStatus;
  className?: string;
}) {
  const t = useTranslations("provider");

  return (
    <Badge
      variant="secondary"
      className={cn("font-medium", PROVIDER_TONES[status], className)}
    >
      {t(`status.${status}`)}
    </Badge>
  );
}
