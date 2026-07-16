"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { AppSelect } from "@/components/ui/app-select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useMutation } from "@/hooks/use-async";
import {
  createPatientProfile,
  updatePatientProfile,
  type PatientProfileInput,
} from "@/lib/api/profiles";
import { now } from "@/lib/time";
import { useApiError } from "@/lib/i18n/use-api-error";
import { useLabels } from "@/lib/i18n/use-labels";
import {
  RELATIONSHIPS,
  type PatientProfile,
  type Relationship,
} from "@/lib/types";

/** Egyptian national IDs are 14 digits. Optional — the API does not require one. */
const EG_NATIONAL_ID = /^\d{14}$/;

/** The validation messages are copy, so the schema is built per-render. */
function buildSchema(t: (key: string) => string) {
  return z.object({
    relationship: z.enum(["self", "child", "spouse", "parent"], {
      message: t("profileDialog.validation.relationship"),
    }),
    fullName: z
      .string()
      .trim()
      .min(3, t("profileDialog.validation.fullName")),
    gender: z.enum(["male", "female"], {
      message: t("profileDialog.validation.gender"),
    }),
    dateOfBirth: z
      .string()
      .min(1, t("profileDialog.validation.dateOfBirthRequired"))
      .refine((value) => new Date(`${value}T00:00:00.000Z`) <= now(), {
        message: t("profileDialog.validation.dateOfBirthPast"),
      }),
    phone: z
      .string()
      .trim()
      .refine((value) => value === "" || /^01[0125]\d{8}$/.test(value), {
        message: t("profileDialog.validation.phone"),
      }),
    nationalId: z
      .string()
      .trim()
      .refine((value) => value === "" || EG_NATIONAL_ID.test(value), {
        message: t("profileDialog.validation.nationalId"),
      }),
  });
}

type ProfileValues = z.infer<ReturnType<typeof buildSchema>>;

const BLANK: ProfileValues = {
  relationship: "child",
  fullName: "",
  gender: "male",
  dateOfBirth: "",
  phone: "",
  nationalId: "",
};

function toValues(profile: PatientProfile): ProfileValues {
  return {
    relationship: profile.relationship,
    fullName: profile.fullName,
    gender: profile.gender,
    dateOfBirth: profile.dateOfBirth.slice(0, 10),
    phone: profile.phone ?? "",
    nationalId: profile.nationalId ?? "",
  };
}

function toInput(values: ProfileValues): PatientProfileInput {
  return {
    relationship: values.relationship,
    fullName: values.fullName.trim(),
    gender: values.gender,
    dateOfBirth: values.dateOfBirth,
    phone: values.phone.trim() || undefined,
    nationalId: values.nationalId.trim() || undefined,
  };
}

/**
 * Add or edit a patient profile.
 *
 * These are exactly the fields `/v1/me/profiles` stores. The form is explicit
 * about *why* it asks for gender and date of birth: they are what the booking
 * flow screens a service's eligibility rules against (§3), so if they are wrong
 * the screening is wrong. A service's pregnancy and chronic-condition rules are
 * shown and acknowledged at booking time instead — nothing on file to screen.
 */
export function PatientProfileDialog({
  accountId,
  profile,
  hasSelf,
  open,
  onOpenChange,
  onSaved,
}: {
  accountId: string;
  /** Omitted when adding a new profile. */
  profile?: PatientProfile;
  /** True when the account already has a "Myself" profile. */
  hasSelf: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const t = useTranslations("patient");
  const L = useLabels();
  const describeError = useApiError();

  const isEdit = profile !== undefined;

  const schema = useMemo(() => buildSchema(t), [t]);

  const form = useForm<ProfileValues>({
    resolver: zodResolver(schema),
    values: profile ? toValues(profile) : BLANK,
  });

  const create = useMutation(createPatientProfile);
  const update = useMutation(updatePatientProfile);
  const isPending = create.isPending || update.isPending;

  const genderOptions = [
    { value: "male", label: L.gender("male") },
    { value: "female", label: L.gender("female") },
  ];

  // "Myself" is offered only when the account doesn't already have one, and is
  // locked while editing — an account has exactly one self profile.
  const relationshipOptions = RELATIONSHIPS.filter(
    (value) => value !== "self" || !hasSelf || profile?.relationship === "self",
  ).map((value) => ({ value, label: L.relationship(value) }));

  async function onSubmit(values: ProfileValues) {
    try {
      if (profile) {
        await update.mutate(profile.id, accountId, toInput(values));
        toast.success(
          t("profileDialog.updated", { name: values.fullName.trim() }),
        );
      } else {
        await create.mutate(accountId, toInput(values));
        toast.success(
          t("profileDialog.created", { name: values.fullName.trim() }),
        );
      }
      onOpenChange(false);
      form.reset(BLANK);
      onSaved();
    } catch (error) {
      toast.error(describeError(error));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? t("profileDialog.editTitle", { name: profile.fullName })
              : t("profileDialog.addTitle")}
          </DialogTitle>
          <DialogDescription>{t("profileDialog.description")}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-6"
            noValidate
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="relationship"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("profileDialog.relationship")}</FormLabel>
                    <FormControl>
                      <AppSelect
                        value={field.value}
                        onValueChange={(value) =>
                          field.onChange(value as Relationship)
                        }
                        options={relationshipOptions}
                        placeholder={t("profileDialog.relationshipPlaceholder")}
                        disabled={isPending || profile?.relationship === "self"}
                      />
                    </FormControl>
                    {profile?.relationship === "self" && (
                      <FormDescription>
                        {t("profileDialog.relationshipSelfLocked")}
                      </FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("profileDialog.fullName")}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder={t("profileDialog.fullNamePlaceholder")}
                        className="h-11 rounded-xl"
                        disabled={isPending}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="gender"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("profileDialog.gender")}</FormLabel>
                    <FormControl>
                      <AppSelect
                        value={field.value}
                        onValueChange={(value) =>
                          field.onChange(value as ProfileValues["gender"])
                        }
                        options={genderOptions}
                        placeholder={t("profileDialog.genderPlaceholder")}
                        disabled={isPending}
                      />
                    </FormControl>
                    <FormDescription>
                      {t("profileDialog.genderHint")}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="dateOfBirth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("profileDialog.dateOfBirth")}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="date"
                        className="h-11 rounded-xl"
                        disabled={isPending}
                      />
                    </FormControl>
                    <FormDescription>
                      {t("profileDialog.dateOfBirthHint")}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("profileDialog.phone")}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="tel"
                        inputMode="numeric"
                        placeholder="01XXXXXXXXX"
                        className="h-11 rounded-xl"
                        disabled={isPending}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="nationalId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("profileDialog.nationalId")}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        inputMode="numeric"
                        maxLength={14}
                        placeholder={t("profileDialog.nationalIdPlaceholder")}
                        className="h-11 rounded-xl"
                        disabled={isPending}
                      />
                    </FormControl>
                    <FormDescription>
                      {t("profileDialog.nationalIdHint")}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
                className="h-10 rounded-xl px-4"
              >
                {t("profileDialog.cancel")}
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="h-10 rounded-xl px-4"
              >
                {isPending
                  ? t("profileDialog.saving")
                  : isEdit
                    ? t("profileDialog.save")
                    : t("profileDialog.add")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
