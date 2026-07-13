"use client";

import {
  Banknote,
  Check,
  CreditCard,
  Loader2,
  Lock,
  Smartphone,
  Tag,
  Timer,
  TriangleAlert,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { OrderSummary } from "@/components/booking/order-summary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { bookingFeeFor, validateCoupon } from "@/lib/api/bookings";
import { BUSINESS, formatEGP } from "@/lib/site";
import {
  PAYMENT_METHOD_LABELS,
  type Booking,
  type PaymentMethod,
  type Provider,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const METHODS: { value: PaymentMethod; icon: LucideIcon; hint: string }[] = [
  {
    value: "cash",
    icon: Banknote,
    hint: "No online fee. Your booking is confirmed straight away.",
  },
  {
    value: "card",
    icon: CreditCard,
    hint: "Visa, Mastercard or Meeza — the booking fee is charged now.",
  },
  {
    value: "vodafone_cash",
    icon: Smartphone,
    hint: "Confirm the booking fee on your Vodafone wallet.",
  },
  {
    value: "instapay",
    icon: Smartphone,
    hint: "Pay the booking fee by instant bank transfer.",
  },
];

export interface AppliedCoupon {
  code: string;
  discount: number;
}

/** `mm:ss` remaining on a hold, ticking against the real clock. */
function useCountdown(expiresAt: string | undefined, onExpire: () => void) {
  const [remaining, setRemaining] = useState(() =>
    expiresAt ? Math.max(0, new Date(expiresAt).getTime() - Date.now()) : 0,
  );

  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    if (!expiresAt) return;

    const target = new Date(expiresAt).getTime();
    let fired = false;

    const tick = () => {
      const left = Math.max(0, target - Date.now());
      setRemaining(left);

      if (left === 0 && !fired) {
        fired = true;
        onExpireRef.current();
      }
    };

    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [expiresAt]);

  const totalSeconds = Math.ceil(remaining / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return {
    remainingMs: remaining,
    label: `${minutes}:${String(seconds).padStart(2, "0")}`,
    percent: expiresAt
      ? Math.max(
          0,
          Math.min(100, (remaining / (BUSINESS.paymentHoldMinutes * 60_000)) * 100),
        )
      : 0,
  };
}

/**
 * Step 6 — payment (§9).
 *
 * Only the *booking fee* is paid online; it is what confirms the place. The
 * visit fee itself is settled in cash at the clinic, and the summary says so
 * plainly. When an online method is used the place is held for a strict
 * reservation window — and if payment fails or the window lapses, the place is
 * released and the hold discarded. There is no half-booked state.
 */
export function PaymentStep({
  provider,
  serviceName,
  branchName,
  price,
  method,
  onMethodChange,
  coupon,
  onCouponChange,
  notes,
  onNotesChange,
  held,
  isPaying,
  onPay,
  onExpire,
  onCancelHold,
}: {
  provider: Provider;
  serviceName: string;
  branchName?: string;
  price: number;
  method: PaymentMethod;
  onMethodChange: (method: PaymentMethod) => void;
  coupon: AppliedCoupon | null;
  onCouponChange: (coupon: AppliedCoupon | null) => void;
  notes: string;
  onNotesChange: (notes: string) => void;
  /** The live hold, once a place has been claimed for an online payment. */
  held: Booking | null;
  isPaying: boolean;
  onPay: (outcome: "success" | "failure") => void;
  onExpire: () => void;
  onCancelHold: () => void;
}) {
  const [code, setCode] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );

  const fee = held ? held.bookingFee : bookingFeeFor(method);
  const discount = held ? held.discount : (coupon?.discount ?? 0);

  const countdown = useCountdown(held?.holdExpiresAt, onExpire);
  const isUrgent = !!held && countdown.remainingMs < 60_000;

  async function applyCoupon() {
    const trimmed = code.trim();
    if (!trimmed || isChecking) return;

    setIsChecking(true);
    setMessage(null);

    try {
      const result = await validateCoupon(trimmed, price, provider.type);

      if (result.valid) {
        onCouponChange({ code: trimmed.toUpperCase(), discount: result.discount });
        setMessage({ ok: true, text: result.message });
      } else {
        onCouponChange(null);
        setMessage({ ok: false, text: result.message });
      }
    } catch (error) {
      onCouponChange(null);
      setMessage({
        ok: false,
        text:
          error instanceof Error
            ? error.message
            : "We couldn't check that coupon. Try again.",
      });
    } finally {
      setIsChecking(false);
    }
  }

  function removeCoupon() {
    onCouponChange(null);
    setCode("");
    setMessage(null);
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-8">
        {held ? (
          <section className="space-y-4">
            <div
              className={cn(
                "rounded-2xl border p-5 shadow-soft",
                isUrgent
                  ? "border-destructive/40 bg-destructive/5"
                  : "border-primary/30 bg-primary/5",
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-xl",
                      isUrgent
                        ? "bg-destructive/15 text-destructive"
                        : "bg-primary/15 text-primary",
                    )}
                  >
                    <Timer className="size-5" />
                  </span>
                  <div>
                    <p className="font-semibold">
                      Your place is held for{" "}
                      <span className="tabular-nums">{countdown.label}</span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Pay the {formatEGP(fee)} booking fee within the window and the
                      place is yours. Let it lapse and it goes back to the queue.
                    </p>
                  </div>
                </div>
              </div>

              <div
                className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-label="Time left to pay"
                aria-valuenow={Math.round(countdown.percent)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-300",
                    isUrgent ? "bg-destructive" : "bg-primary",
                  )}
                  style={{ width: `${countdown.percent}%` }}
                />
              </div>
            </div>

            <div className="rounded-2xl border bg-card p-5 shadow-soft">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Lock className="size-4 text-primary" />
                Pay the booking fee
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {PAYMENT_METHOD_LABELS[held.paymentMethod]} ·{" "}
                {formatEGP(held.bookingFee)}. The {formatEGP(held.total)} visit fee
                is paid in cash at the clinic.
              </p>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button
                  type="button"
                  onClick={() => onPay("success")}
                  disabled={isPaying}
                  className="h-11 rounded-xl px-5"
                >
                  {isPaying ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Lock className="size-4" />
                  )}
                  Pay {formatEGP(held.bookingFee)} now
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  onClick={onCancelHold}
                  disabled={isPaying}
                  className="h-11 rounded-xl px-4"
                >
                  Release and pick another time
                </Button>
              </div>

              <button
                type="button"
                onClick={() => onPay("failure")}
                disabled={isPaying}
                className="mt-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground underline underline-offset-4 transition-colors hover:text-destructive disabled:opacity-50"
              >
                <TriangleAlert className="size-3.5" />
                Simulate a failed payment
              </button>
            </div>
          </section>
        ) : (
          <>
            <section className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Payment method</h2>
                <p className="text-sm text-muted-foreground">
                  The {formatEGP(BUSINESS.bookingFee)} booking fee is what confirms
                  your place. The visit itself is paid in cash at the clinic.
                </p>
              </div>

              <div
                role="radiogroup"
                aria-label="Payment method"
                className="grid gap-3 sm:grid-cols-2"
              >
                {METHODS.map(({ value, icon: Icon, hint }) => {
                  const isSelected = value === method;
                  const methodFee = bookingFeeFor(value);

                  return (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => onMethodChange(value)}
                      className={cn(
                        "flex items-start gap-3 rounded-2xl border p-4 text-left transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                        isSelected
                          ? "border-primary bg-primary/5 shadow-glow"
                          : "border-border bg-card hover:border-primary/50 hover:shadow-soft",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-10 shrink-0 items-center justify-center rounded-xl",
                          isSelected
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        <Icon className="size-5" />
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 font-medium">
                          <span className="truncate">
                            {PAYMENT_METHOD_LABELS[value]}
                          </span>
                          {isSelected && (
                            <Check
                              className="size-4 shrink-0 text-primary"
                              aria-hidden
                            />
                          )}
                        </span>
                        <span className="mt-0.5 block text-sm text-muted-foreground">
                          {hint}
                        </span>
                        <span className="mt-1 block text-xs font-medium">
                          {methodFee > 0
                            ? `Booking fee ${formatEGP(methodFee)} online`
                            : "No online fee"}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="space-y-3">
              <div>
                <h2 className="text-lg font-semibold">Coupon code</h2>
                <p className="text-sm text-muted-foreground">
                  Applies to the visit fee you settle at the clinic.
                </p>
              </div>

              {coupon ? (
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-success/30 bg-success/5 p-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-success/15 text-success">
                      <Tag className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-mono text-sm font-semibold">
                        {coupon.code}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {message?.text ?? "Coupon applied."}
                      </p>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={removeCoupon}
                    aria-label="Remove coupon"
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void applyCoupon();
                        }
                      }}
                      placeholder="e.g. VESITA20"
                      aria-label="Coupon code"
                      className="h-11 rounded-xl font-mono uppercase"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void applyCoupon()}
                      disabled={!code.trim() || isChecking}
                      className="h-11 shrink-0 rounded-xl px-4"
                    >
                      {isChecking ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Tag className="size-4" />
                      )}
                      Apply
                    </Button>
                  </div>

                  {message && !message.ok && (
                    <p className="text-sm font-medium text-destructive" role="alert">
                      {message.text}
                    </p>
                  )}
                </div>
              )}
            </section>

            <section className="space-y-3">
              <div>
                <h2 className="text-lg font-semibold">
                  Symptoms or notes (optional)
                </h2>
                <p className="text-sm text-muted-foreground">
                  Shared only with the provider you&apos;re booking.
                </p>
              </div>

              <Textarea
                rows={4}
                value={notes}
                onChange={(e) => onNotesChange(e.target.value.slice(0, 500))}
                placeholder="Briefly describe the reason for the visit…"
                aria-label="Symptoms or notes"
                className="rounded-xl"
              />
            </section>
          </>
        )}
      </div>

      <OrderSummary
        serviceName={serviceName}
        branchName={branchName}
        price={price}
        discount={discount}
        bookingFee={fee}
        couponCode={held ? held.couponCode : coupon?.code}
        className="h-fit lg:sticky lg:top-24"
      />
    </div>
  );
}
