"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { changePassword } from "@/lib/api/medpoint/profile";
import { useApiError } from "@/lib/i18n/use-api-error";

type Values = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

/** Change the account password, against `PATCH /v1/users/:id/password`. */
export function ChangePasswordCard() {
  const t = useTranslations("auth");
  const describeError = useApiError();
  const { user } = useAuth();

  const [showPassword, setShowPassword] = useState(false);

  const schema = z
    .object({
      currentPassword: z.string().min(1, t("errors.confirmPassword")),
      newPassword: z.string().min(8, t("errors.passwordMin8")),
      confirmPassword: z.string().min(1, t("errors.confirmPassword")),
    })
    .refine((values) => values.newPassword === values.confirmPassword, {
      message: t("errors.passwordMismatch"),
      path: ["confirmPassword"],
    });

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  async function onSubmit(values: Values) {
    if (!user) return;

    try {
      await changePassword(user.id, {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
        newPasswordConfirmation: values.confirmPassword,
      });

      toast.success(t("changePassword.updated"));
      form.reset();
    } catch (error) {
      // A wrong current password is a 422 on that field — say so next to the
      // input rather than in a toast the user has to map back themselves.
      if (error instanceof ValidationError) {
        const current = error.fieldError("current_password");
        if (current) {
          form.setError("currentPassword", { message: current });
          return;
        }
        const next = error.fieldError("new_password");
        if (next) {
          form.setError("newPassword", { message: next });
          return;
        }
      }
      toast.error(describeError(error));
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("changePassword.title")}</CardTitle>
        <CardDescription>{t("changePassword.description")}</CardDescription>
      </CardHeader>

      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="currentPassword"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>{t("changePassword.currentLabel")}</FormLabel>
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

            <div className="grid gap-5 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("changePassword.newLabel")}</FormLabel>
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
                    <FormLabel>{t("changePassword.confirmLabel")}</FormLabel>
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

            <Button
              type="submit"
              disabled={form.formState.isSubmitting}
              className="h-11 rounded-xl px-4"
            >
              {form.formState.isSubmitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <KeyRound className="size-4" />
              )}
              {t("changePassword.submit")}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
