"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Eye, EyeOff, Loader2, UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { z } from "zod";

import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { HOME_FOR_ROLE } from "@/lib/api/auth";
import { ValidationError } from "@/lib/api/http";
import { requiresOtpAfterSignup } from "@/lib/api/session";
import { useApiError } from "@/lib/i18n/use-api-error";

/** Egyptian mobile numbers: 010/011/012/015 followed by eight digits. */
const EG_PHONE = /^01[0125][0-9]{8}$/;

/**
 * `POST /v1/auth/register` takes `full_name`, `email`, `password` and `phone` —
 * nothing else. `confirmPassword` and `terms` are deliberate extras: neither is
 * sent, they exist to catch a typo and to record consent before the account is
 * created. Anything beyond those belongs on the profile screens, where it has
 * an endpoint that stores it.
 */
type RegisterValues = {
  name: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  terms: boolean;
};

const WIRE_FIELD_MAP: Record<string, keyof RegisterValues> = {
  full_name: "name",
  name: "name",
  email: "email",
  phone: "phone",
  password: "password",
};

export default function RegisterPage() {
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");
  const describeError = useApiError();

  const router = useRouter();
  const { register } = useAuth();
  const [showPassword, setShowPassword] = useState(false);

  const schema = useMemo(() => {
    return z
      .object({
        name: z
          .string()
          .min(3, t("errors.nameTooShort"))
          .max(60, t("errors.nameTooLong")),
        email: z.email(tCommon("validation.invalidEmail")),
        phone: z.string().regex(EG_PHONE, t("errors.invalidPhone")),
        password: z.string().min(8, t("errors.passwordMin8")),
        confirmPassword: z.string().min(1, t("errors.confirmPassword")),
        terms: z.boolean().refine((v) => v === true, {
          message: t("errors.acceptTerms"),
        }),
      })
      .superRefine((values, ctx) => {
        if (values.password !== values.confirmPassword) {
          ctx.addIssue({
            code: "custom",
            message: t("errors.passwordMismatch"),
            path: ["confirmPassword"],
          });
        }
      });
  }, [t, tCommon]);

  const form = useForm<RegisterValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
      terms: false,
    },
  });

  function applyValidationError(error: ValidationError) {
    let attached = false;
    for (const [wireField, messages] of Object.entries(error.fields)) {
      const formField = WIRE_FIELD_MAP[wireField];
      const message = messages[0];
      if (formField && message) {
        form.setError(formField, { message });
        attached = true;
      }
    }
    return attached;
  }

  async function onSubmit(values: RegisterValues) {
    try {
      const user = await register({
        name: values.name,
        email: values.email,
        phone: values.phone,
        password: values.password,
        role: "patient",
      });

      if (requiresOtpAfterSignup()) {
        toast.success(t("register.created"));
        router.push("/verify");
        return;
      }

      toast.success(t("login.welcomeBack", { name: user.name.split(" ")[0] }));
      router.push(HOME_FOR_ROLE[user.role]);
    } catch (error) {
      if (error instanceof ValidationError && applyValidationError(error)) {
        toast.error(describeError(error));
        return;
      }
      const message = describeError(error);
      form.setError("email", { message });
      toast.error(message);
    }
  }

  const isPending = form.formState.isSubmitting;

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">
          {t("register.title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("register.subtitle")}</p>
      </header>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("register.nameLabel")}</FormLabel>
                <FormControl>
                  <Input
                    autoComplete="name"
                    placeholder={t("register.namePlaceholder")}
                    className="h-11 rounded-xl"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid gap-5 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("register.emailLabel")}</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      autoComplete="email"
                      placeholder={t("register.emailPlaceholder")}
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
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("register.phoneLabel")}</FormLabel>
                  <FormControl>
                    <Input
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel"
                      placeholder={t("register.phonePlaceholder")}
                      className="h-11 rounded-xl"
                      dir="ltr"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>{t("register.passwordLabel")}</FormLabel>
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
                  <FormLabel>{t("register.confirmPasswordLabel")}</FormLabel>
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
          </div>

          <FormField
            control={form.control}
            name="terms"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-start gap-3 rounded-xl border bg-card/50 p-3">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={(checked: boolean) => field.onChange(checked)}
                      className="mt-0.5"
                    />
                  </FormControl>
                  <FormLabel className="block text-sm font-normal leading-relaxed text-muted-foreground">
                    {t.rich("register.terms", {
                      terms: (chunks) => (
                        <Link
                          href="/terms"
                          className="font-medium text-primary underline-offset-4 hover:underline"
                        >
                          {chunks}
                        </Link>
                      ),
                      privacy: (chunks) => (
                        <Link
                          href="/privacy"
                          className="font-medium text-primary underline-offset-4 hover:underline"
                        >
                          {chunks}
                        </Link>
                      ),
                    })}
                  </FormLabel>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            disabled={isPending}
            className="h-11 w-full rounded-xl px-4"
          >
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <UserPlus className="size-4" />
            )}
            {t("register.submit")}
          </Button>
        </form>
      </Form>

      <p className="text-center text-sm text-muted-foreground">
        {t("register.haveAccount")}{" "}
        <Link
          href="/login"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          {t("register.signIn")}
        </Link>
      </p>
    </div>
  );
}
