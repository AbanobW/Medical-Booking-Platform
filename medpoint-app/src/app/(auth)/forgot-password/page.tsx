"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

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
import { ValidationError } from "@/lib/api/http";
import { requestPasswordReset } from "@/lib/api/medpoint/auth";
import { useApiError } from "@/lib/i18n/use-api-error";

/**
 * Step 1 of the password reset: name the account.
 *
 * The backend answers the same way whether or not the address exists, so the UI
 * must not branch on the result — doing so would turn this into an account
 * enumeration oracle. We always move on to the code screen.
 */
export default function ForgotPasswordPage() {
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");
  const describeError = useApiError();
  const router = useRouter();

  const isAvailable = true;

  const schema = z.object({
    email: z.email(tCommon("validation.invalidEmail")),
  });

  const form = useForm<{ email: string }>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  async function onSubmit({ email }: { email: string }) {
    try {
      await requestPasswordReset(email);
      toast.success(t("forgotPassword.sent"));
      router.push(`/reset-password?email=${encodeURIComponent(email)}`);
    } catch (error) {
      if (error instanceof ValidationError) {
        const message = error.fieldError("email");
        if (message) {
          form.setError("email", { message });
          return;
        }
      }
      toast.error(describeError(error));
    }
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">
          {t("forgotPassword.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("forgotPassword.subtitle")}
        </p>
      </header>

      {!isAvailable && (
        <div className="rounded-2xl border border-warning/30 bg-warning/10 p-4 text-sm">
          <p className="font-medium">{t("forgotPassword.unavailableTitle")}</p>
          <p className="mt-1 text-muted-foreground">
            {t.rich("forgotPassword.unavailableBody", {
              code: (chunks) => (
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                  {chunks}
                </code>
              ),
            })}
          </p>
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("forgotPassword.emailLabel")}</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    autoComplete="email"
                    placeholder={t("forgotPassword.emailPlaceholder")}
                    className="h-11 rounded-xl"
                    disabled={!isAvailable}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            disabled={!isAvailable || form.formState.isSubmitting}
            className="h-11 w-full rounded-xl px-4"
          >
            {form.formState.isSubmitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            {t("forgotPassword.submit")}
          </Button>
        </form>
      </Form>

      <Button
        render={<Link href="/login" />}
        variant="ghost"
        className="h-10 w-full rounded-xl px-4"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" />
        {t("forgotPassword.backToSignIn")}
      </Button>
    </div>
  );
}
