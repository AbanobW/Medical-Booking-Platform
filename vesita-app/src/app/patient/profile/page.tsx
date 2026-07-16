"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarDays, Mail, Save, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { ChangePasswordCard } from "@/components/patient/change-password-card";
import { useAuth } from "@/components/providers/auth-provider";
import { ProfileSkeleton } from "@/components/shared/states";
import { AppSelect } from "@/components/ui/app-select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { TODAY } from "@/lib/data/seed";
import { useApiError } from "@/lib/i18n/use-api-error";
import { useFormat } from "@/lib/i18n/use-format";
import { useLabels } from "@/lib/i18n/use-labels";

/**
 * The account, as the API defines it.
 *
 * These four fields are exactly what can be written back: `name` and `phone`
 * through `PUT /v1/profile`, `gender` and `dateOfBirth` through
 * `PATCH /v1/users/:id`. Blood type and governorate used to sit here too; the
 * API has no column for either, so they were only ever saved to the mock.
 *
 * Gender and date of birth stay optional — an account can exist without them
 * and the API accepts them unset, so requiring them here would block someone
 * from correcting a typo in their own name. The booking flow reads its clinical
 * facts off the patient profile (§1), not off the account.
 *
 * The validation messages are copy, so the schema is built per-render.
 */
function buildSchema(t: (key: string) => string) {
  return z
    .object({
      name: z.string().trim().min(3, t("account.validation.name")),
      phone: z
        .string()
        .trim()
        .regex(/^01[0125]\d{8}$/, t("account.validation.phone")),
      gender: z.enum(["male", "female"]).optional(),
      dateOfBirth: z.string().optional(),
    })
    .superRefine((values, ctx) => {
      if (values.dateOfBirth && new Date(values.dateOfBirth).getTime() >= TODAY.getTime()) {
        ctx.addIssue({
          code: "custom",
          path: ["dateOfBirth"],
          message: t("account.validation.dateOfBirthPast"),
        });
      }
    });
}

type ProfileValues = z.infer<ReturnType<typeof buildSchema>>;

export default function PatientProfilePage() {
  const t = useTranslations("patient");
  const L = useLabels();
  const { formatDate, initialsOf } = useFormat();
  const describeError = useApiError();

  const { user, isLoading, updateProfile } = useAuth();

  const schema = useMemo(() => buildSchema(t), [t]);

  const form = useForm<ProfileValues>({
    resolver: zodResolver(schema),
    values: user
      ? {
          name: user.name,
          phone: user.phone,
          gender: user.gender ?? "male",
          dateOfBirth: user.dateOfBirth?.slice(0, 10) ?? "",
        }
      : undefined,
  });

  const genderOptions = [
    { value: "male", label: L.gender("male") },
    { value: "female", label: L.gender("female") },
  ];

  if (isLoading || !user) return <ProfileSkeleton />;

  async function onSubmit(values: ProfileValues) {
    try {
      await updateProfile(values);
      toast.success(t("account.saved"));
    } catch (error) {
      toast.error(describeError(error));
    }
  }

  const { isSubmitting, isDirty } = form.formState;

  return (
    <div className="space-y-6">
      {/* Identity --------------------------------------------------------- */}
      <Card className="overflow-hidden">
        <CardContent className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
          <Avatar className="size-24 shrink-0 rounded-2xl ring-1 ring-border">
            <AvatarImage
              src={user.avatar}
              alt={user.name}
              className="rounded-2xl object-cover"
            />
            <AvatarFallback className="rounded-2xl text-xl font-semibold">
              {initialsOf(user.name)}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-xl font-bold">{user.name}</h2>
              <Badge variant="secondary" className="gap-1">
                <ShieldCheck />
                {L.role(user.role)}
              </Badge>
            </div>

            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="size-4 shrink-0" />
              <span className="ltr-nums">{user.email}</span>
            </p>
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarDays className="size-4 shrink-0" />
              {t("account.memberSince", { date: formatDate(user.createdAt) })}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Editable details -------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle>{t("account.detailsTitle")}</CardTitle>
          <CardDescription>{t("account.detailsDescription")}</CardDescription>
        </CardHeader>

        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-6"
              noValidate
            >
              <div className="grid gap-5 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("account.fullName")}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder={t("account.fullNamePlaceholder")}
                          className="h-11 rounded-xl"
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
                      <FormLabel>{t("account.phone")}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="tel"
                          inputMode="numeric"
                          placeholder="01XXXXXXXXX"
                          className="h-11 rounded-xl"
                        />
                      </FormControl>
                      <FormDescription>{t("account.phoneHint")}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="gender"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("account.gender")}</FormLabel>
                      <FormControl>
                        <AppSelect
                          value={field.value ?? ""}
                          onValueChange={(value) =>
                            field.onChange(value as ProfileValues["gender"])
                          }
                          options={genderOptions}
                          placeholder={t("account.genderPlaceholder")}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dateOfBirth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("account.dateOfBirth")}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="date"
                          className="h-11 rounded-xl"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end gap-2 border-t pt-5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => form.reset()}
                  disabled={!isDirty || isSubmitting}
                  className="h-10 rounded-xl px-4"
                >
                  {t("account.reset")}
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-10 rounded-xl px-4"
                >
                  <Save className="size-4" />
                  {isSubmitting ? t("account.saving") : t("account.save")}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <ChangePasswordCard />
    </div>
  );
}
