"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Eye, EyeOff, Loader2, LogIn } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { z } from "zod";

import { useAuth } from "@/components/providers/auth-provider";
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
import { HOME_FOR_ROLE } from "@/lib/api/auth";
import { useApiError } from "@/lib/i18n/use-api-error";
import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";

type LoginValues = { email: string; password: string };


function LoginView() {
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");
  const describeError = useApiError();

  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const { login } = useAuth();

  const [showPassword, setShowPassword] = useState(false);


  // Built inside the component so the validation messages are translated.
  const schema = useMemo(
    () =>
      z.object({
        email: z.email(tCommon("validation.invalidEmail")),
        password: z.string().min(6, tCommon("validation.passwordTooShort")),
      }),
    [tCommon],
  );

  const form = useForm<LoginValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  function land(role: Role) {
    router.push(next && next.startsWith("/") ? next : HOME_FOR_ROLE[role]);
  }

  async function onSubmit(values: LoginValues) {
    try {
      const user = await login(values.email, values.password);
      toast.success(t("login.welcomeBack", { name: user.name.split(" ")[0] }));
      land(user.role);
    } catch (error) {
      const message = describeError(error);
      form.setError("email", { message });
      toast.error(message);
    }
  }



  const isPending = form.formState.isSubmitting;

  return (
    /*
     * Sign in first, demo second.
     *
     * The page used to open with a bordered five-button "Explore as…" panel and
     * then close with a separate dashed "Demo credentials" box — two competing
     * demo affordances bracketing the form, with the shortcut outranking the
     * thing the page is actually for. Both are now folded into one disclosure at
     * the foot of the page, collapsed by default.
     */
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">{t("login.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("login.subtitle")}</p>
      </header>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("login.emailLabel")}</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    autoComplete="email"
                    placeholder={t("login.emailPlaceholder")}
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
            name="password"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel>{t("login.passwordLabel")}</FormLabel>
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
                    autoComplete="current-password"
                    placeholder={t("password.placeholder")}
                    className="h-11 rounded-xl"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex justify-end">
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              {t("forgotPassword.link")}
            </Link>
          </div>

          <Button
            type="submit"
            disabled={isPending}
            className="h-11 w-full rounded-xl px-4"
          >
            {form.formState.isSubmitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <LogIn className="size-4" />
            )}
            {t("login.submit")}
          </Button>
        </form>
      </Form>


      <p className="text-center text-sm text-muted-foreground">
        {t("login.noAccount")}{" "}
        <Link
          href="/register"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          {t("login.createOne")}
        </Link>
      </p>

    </div>
  );
}

function LoginSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>
      <Skeleton className="h-40 w-full rounded-2xl" />
      <Skeleton className="h-11 w-full rounded-xl" />
      <Skeleton className="h-11 w-full rounded-xl" />
    </div>
  );
}

export default function LoginPage() {
  // `useSearchParams` must sit inside a Suspense boundary or Next 15 fails the
  // production build with a missing-suspense-with-csr-bailout error.
  return (
    <Suspense fallback={<LoginSkeleton />}>
      <LoginView />
    </Suspense>
  );
}
