"use client";

import { Banknote, CreditCard, Wallet } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { useFormat } from "@/lib/i18n/use-format";
import { cn } from "@/lib/utils";

/**
 * The money, split the way the business actually works (§9).
 *
 * The *booking fee* is the only thing paid online — it is what confirms the
 * place. The *visit fee* itself is settled in cash at the clinic. Showing them
 * as one number would be a lie the patient discovers at the counter.
 */
export function OrderSummary({
  serviceName,
  branchName,
  price,
  discount,
  bookingFee,
  cashback,
  couponCode,
  isPaid,
  className,
}: {
  serviceName: string;
  branchName?: string;
  /** The branch price of the service — the visit fee. */
  price: number;
  discount: number;
  /** The online fee. Zero for cash-at-clinic bookings. */
  bookingFee: number;
  /** Only known once the booking exists — omitted during checkout. */
  cashback?: number;
  couponCode?: string;
  /** True once the fee has actually been charged. */
  isPaid?: boolean;
  className?: string;
}) {
  const t = useTranslations("booking");
  const { formatEGP } = useFormat();

  const atClinic = Math.max(price - discount, 0);

  return (
    <div className={cn("rounded-2xl border bg-card p-5 shadow-soft", className)}>
      <p className="text-sm font-semibold">{t("summary.title")}</p>

      <dl className="mt-4 space-y-3 text-sm">
        <div className="flex items-start justify-between gap-4">
          <dt className="min-w-0 text-muted-foreground">
            <span className="block truncate text-foreground">{serviceName}</span>
            {branchName && (
              <span className="block truncate text-xs">{branchName}</span>
            )}
          </dt>
          <dd className="shrink-0 font-medium tabular-nums">{formatEGP(price)}</dd>
        </div>

        {discount > 0 && (
          <div className="flex items-start justify-between gap-4">
            <dt className="flex items-center gap-2 text-muted-foreground">
              {t("summary.discount")}
              {couponCode && (
                <Badge variant="secondary" className="font-mono text-[0.65rem]">
                  {couponCode}
                </Badge>
              )}
            </dt>
            <dd className="shrink-0 font-medium tabular-nums text-success">
              <span className="ltr-nums">−{formatEGP(discount)}</span>
            </dd>
          </div>
        )}

        {cashback !== undefined && cashback > 0 && (
          <div className="flex items-start justify-between gap-4">
            <dt className="flex items-center gap-2 text-muted-foreground">
              <Wallet className="size-3.5" />
              {t("summary.cashback")}
            </dt>
            <dd className="shrink-0 font-medium tabular-nums text-success">
              <span className="ltr-nums">+{formatEGP(cashback)}</span>
            </dd>
          </div>
        )}
      </dl>

      <div className="mt-4 space-y-3 border-t pt-4">
        <div className="flex items-start justify-between gap-4 rounded-xl bg-primary/5 p-3">
          <div className="flex min-w-0 items-start gap-2">
            <CreditCard className="mt-0.5 size-4 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                {isPaid ? t("summary.paidOnline") : t("summary.payOnline")}
              </p>
              <p className="text-xs text-muted-foreground">
                {bookingFee > 0
                  ? t("summary.onlineHint")
                  : t("summary.onlineNone")}
              </p>
            </div>
          </div>
          <p className="shrink-0 text-lg font-bold tabular-nums text-primary">
            {formatEGP(bookingFee)}
          </p>
        </div>

        <div className="flex items-start justify-between gap-4 rounded-xl bg-muted/50 p-3">
          <div className="flex min-w-0 items-start gap-2">
            <Banknote className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="text-sm font-semibold">{t("summary.atClinic")}</p>
              <p className="text-xs text-muted-foreground">
                {t("summary.atClinicHint")}
              </p>
            </div>
          </div>
          <p className="shrink-0 text-lg font-bold tabular-nums">
            {formatEGP(atClinic)}
          </p>
        </div>
      </div>

      {cashback === undefined && (
        <p className="mt-3 text-xs text-muted-foreground">
          {t("summary.cashbackNote")}
        </p>
      )}
    </div>
  );
}
