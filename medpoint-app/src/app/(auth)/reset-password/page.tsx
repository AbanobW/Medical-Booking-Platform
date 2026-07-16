"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Suspense, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { OtpInput } from "@/components/auth/otp-input";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ValidationError } from "@/lib/api/http";
import { requestPasswordReset, resetPassword } from "@/lib/api/medpoint/auth";
import { useApiError } from "@/lib/i18n/use-api-error";

const RESEND_SECONDS = 45;

/** The API's own field names, so a 422 can be mapped back onto the form. */
const FIELD_MAP = {
  otp: "otp",
  password: "password",
} as const;

type ResetValues = {
  otp: string;
  password: string;
  confirmPassword: string;
};

function ResetPasswordView() {
  const t = useTranslations("auth");
  const describeError = useApiError();

  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";

  const [showPassword, setShowPassword] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);

  const schema = z
    .object({
      otp: z.string().length(6, t("errors.otpLength")),
      password: z.string().min(8, t("errors.passwordMin8")),
      confirmPassword: z.string().min(1, t("errors.confirmPassword")),
    })
    .refine((values) => values.password === values.confirmPassword, {
      message: t("errors.passwordMismatch"),
      path: ["confirmPassword"],
    });

  const form = useForm<ResetValues>({
    resolver: zodResolver(schema),
    defaultValues: { otp: "", password: "", confirmPassword: "" },
  });

  // Resend cooldown.
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((n) => n - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  async function onSubmit(values: ResetValues) {
    try {
      await resetPassword({
        email,
        otp: values.otp,
        password: values.password,
        passwordConfirmation: values.confirmPassword,
      });

      toast.success(t("resetPassword.done"));
      router.push("/login");
    } catch (error) {
      // Put the server's complaint on the field it belongs to — a bad code
      // should mark the code boxes, not fire a generic toast.
      if (error instanceof ValidationError) {
        const otpMessage =
          error.fieldError(FIELD_MAP.otp) ?? error.fieldError("email");
        if (otpMessage) {
          form.setError("otp", { message: otpMessage });
          return;
        }
        const passwordMessage = error.fieldError(FIELD_MAP.password);
        if (passwordMessage) {
          form.setError("password", { message: passwordMessage });
          return;
        }
      }

      // A wrong or expired code comes back as a bare 422 with no field errors.
      toast.error(describeError(error));
      form.setError("otp", { message: describeError(error) });
    }
  }

  async function onResend() {
    try {
      await requestPasswordReset(email);
      setSecondsLeft(RESEND_SECONDS);
      toast.success(t("resetPassword.resent"));
    } catch (error) {
      toast.error(describeError(error));
    }
  }

  // Landing here without an email means the flow was entered sideways (a
  // bookmark, a stale tab). There is nothing to reset, so send them back.
  if (!email) {
    return (
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">
            {t("resetPassword.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("resetPassword.missingEmail")}
          </p>
        </header>
        <Button
          render={<Link href="/forgot-password" />}
          className="h-11 w-full rounded-xl px-4"
        >
          {t("forgotPassword.submit")}
        </Button>
      </div>
    );
  }

  const otp = form.watch("otp");

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">
          {t("resetPassword.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t.rich("resetPassword.subtitle", {
            email,
            strong: (chunks) => (
              <strong className="font-medium text-foreground">{chunks}</strong>
            ),
          })}
        </p>
      </header>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          <FormField
            control={form.control}
            name="otp"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("resetPassword.codeLabel")}</FormLabel>
                <FormControl>
                  <OtpInput
                    value={field.value}
                    onChange={field.onChange}
                    disabled={form.formState.isSubmitting}
                    hasError={Boolean(form.formState.errors.otp)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel>{t("resetPassword.newPasswordLabel")}</FormLabel>
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? (
                      <EyeOff className="size-3.5" />
                    ) : (
                      <Eye className="size-3.5" />
                    )}
                    {showPassword ? t("password.hide") : t("password.show")}
                  </button>
                </div>
                <FormControl>
                  <Input
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder={t("password.placeholder")}
                    className="h-11 rounded-xl"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("resetPassword.confirmPasswordLabel")}</FormLabel>
                <FormControl>
                  <Input
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder={t("password.placeholder")}
                    className="h-11 rounded-xl"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            disabled={form.formState.isSubmitting || otp.length < 6}
            className="h-11 w-full rounded-xl px-4"
          >
            {form.formState.isSubmitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <KeyRound className="size-4" />
            )}
            {t("resetPassword.submit")}
          </Button>
        </form>
      </Form>

      <div className="space-y-3 text-center text-sm">
        {secondsLeft > 0 ? (
          <p className="text-muted-foreground">
            {t.rich("resetPassword.resendIn", {
              time: `0:${String(secondsLeft).padStart(2, "0")}`,
              strong: (chunks) => (
                <strong className="font-medium tabular-nums text-foreground">
                  {chunks}
                </strong>
              ),
            })}
          </p>
        ) : (
          <Button
            type="button"
            variant="ghost"
            onClick={onResend}
            className="h-9 rounded-xl px-4"
          >
            {t("resetPassword.resend")}
          </Button>
        )}

        <p className="text-muted-foreground">
          {t("resetPassword.wrongEmail")}{" "}
          <Link
            href="/forgot-password"
            className="font-medium text-primary hover:underline"
          >
            {t("resetPassword.changeIt")}
          </Link>
        </p>
      </div>
    </div>
  );
}

/** `useSearchParams` needs a Suspense boundary above it in the App Router. */
export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <Skeleton className="h-9 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>
      }
    >
      <ResetPasswordView />
    </Suspense>
  );
}
