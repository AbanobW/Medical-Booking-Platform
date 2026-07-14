"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Loader2, MailCheck, RotateCw, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { OtpInput } from "@/components/auth/otp-input";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { HOME_FOR_ROLE, OTP_CODE, resendOtp, verifyOtp } from "@/lib/api/auth";
import { useApiError } from "@/lib/i18n/use-api-error";

const RESEND_SECONDS = 45;

export default function VerifyPage() {
  const t = useTranslations("auth");
  const describeError = useApiError();

  const router = useRouter();
  const { user, isLoading } = useAuth();

  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);

  // Resend cooldown.
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  const submit = useCallback(
    async (value: string) => {
      if (value.length !== 6 || isVerifying) return;

      setIsVerifying(true);
      setError(null);

      try {
        await verifyOtp(value);
        toast.success(t("verify.verified"));
        router.push(user ? HOME_FOR_ROLE[user.role] : "/patient");
      } catch (err) {
        const message = describeError(err);
        setError(message);
        setCode("");
        toast.error(message);
      } finally {
        setIsVerifying(false);
      }
    },
    [describeError, isVerifying, router, t, user],
  );

  async function onResend() {
    setIsResending(true);
    try {
      await resendOtp();
      setSecondsLeft(RESEND_SECONDS);
      setCode("");
      setError(null);
      toast.success(t("verify.resent"));
    } catch (err) {
      toast.error(describeError(err));
    } finally {
      setIsResending(false);
    }
  }

  const destination = user?.phone ?? t("verify.fallbackDestination");

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <MailCheck className="size-6" />
        </span>
        <h1 className="text-3xl font-bold tracking-tight">{t("verify.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {isLoading
            ? t("verify.loading")
            : t.rich("verify.sentTo", {
                destination,
                strong: (chunks) => (
                  <span className="font-medium text-foreground">{chunks}</span>
                ),
              })}
        </p>
      </header>

      <div className="space-y-4">
        <OtpInput
          value={code}
          onChange={(next) => {
            setCode(next);
            if (error) setError(null);
          }}
          onComplete={(value) => void submit(value)}
          disabled={isVerifying}
          hasError={!!error}
        />

        {error && (
          <p className="text-sm font-medium text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>

      <Button
        type="button"
        onClick={() => void submit(code)}
        disabled={code.length !== 6 || isVerifying}
        className="h-11 w-full rounded-xl px-4"
      >
        {isVerifying ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <ShieldCheck className="size-4" />
        )}
        {t("verify.submit")}
      </Button>

      <div className="flex flex-col items-center gap-2">
        {secondsLeft > 0 ? (
          <p className="text-sm text-muted-foreground">
            {t.rich("verify.resendIn", {
              time: `${String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:${String(
                secondsLeft % 60,
              ).padStart(2, "0")}`,
              strong: (chunks) => (
                <span className="ltr-nums font-medium tabular-nums text-foreground">
                  {chunks}
                </span>
              ),
            })}
          </p>
        ) : (
          <Button
            type="button"
            variant="ghost"
            onClick={() => void onResend()}
            disabled={isResending}
            className="h-9 rounded-xl"
          >
            {isResending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RotateCw className="size-4" />
            )}
            {t("verify.resend")}
          </Button>
        )}
      </div>

      <div className="rounded-xl border border-dashed bg-muted/40 p-3 text-center text-xs text-muted-foreground">
        {t.rich("verify.demoHint", {
          code: OTP_CODE,
          strong: (chunks) => (
            <code className="ltr-nums rounded bg-background px-1.5 py-0.5 font-mono text-sm font-semibold tracking-widest text-foreground">
              {chunks}
            </code>
          ),
        })}
      </div>

      <p className="text-center text-sm text-muted-foreground">
        {t("verify.wrongAccount")}{" "}
        <Link
          href="/login"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          {t("verify.useAnother")}
        </Link>
      </p>
    </div>
  );
}
