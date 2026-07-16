"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AppSelect } from "@/components/ui/app-select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useMutation } from "@/hooks/use-async";
import {
  createService,
  updateService,
  type NewService,
} from "@/lib/api/provider-admin";
import { CHRONIC_CONDITIONS } from "@/lib/data/clinical";
import { useApiError } from "@/lib/i18n/use-api-error";
import { useLabels } from "@/lib/i18n/use-labels";
import type {
  ConsultationType,
  EligibilityRules,
  Gender,
  LabTest,
  LocalizedText,
  PreparationInstructions,
  ProviderRole,
  RadiologyScan,
} from "@/lib/types";

export type EditableService = ConsultationType | LabTest | RadiologyScan;

/** A plain `(key, values) => string` view of the `provider` namespace. */
type T = (key: string, values?: Record<string, string | number>) => string;

// ---------------------------------------------------------------------------
// Bilingual fields. Everything a patient reads is stored in both languages, so
// the editor asks for both: a paired textarea per list, zipped line by line.
// ---------------------------------------------------------------------------

const toLines = (text: string): string[] =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

const fromLines = (lines: string[]): string => lines.join("\n");

/** `["a"]`, `["أ"]` → `[{ en: "a", ar: "أ" }]`. A missing line falls back. */
function zipLines(english: string, arabic: string): LocalizedText[] {
  const en = toLines(english);
  const ar = toLines(arabic);

  return Array.from({ length: Math.max(en.length, ar.length) }, (_, i) => ({
    en: en[i] ?? ar[i] ?? "",
    ar: ar[i] ?? en[i] ?? "",
  }));
}

const unzipLines = (list: LocalizedText[] | undefined, key: "en" | "ar") =>
  fromLines((list ?? []).map((item) => item[key]));

/** Seeded in both languages: the patient reads whichever they browse in. */
const ARRIVAL_DEFAULT: LocalizedText = {
  en: "Arrive 10 minutes before your appointment.",
  ar: "احضر قبل موعدك بـ 10 دقائق.",
};

const DOCUMENTS_DEFAULT: LocalizedText[] = [
  { en: "National ID", ar: "بطاقة الرقم القومي" },
];

/** One flat shape covers all three provider types; the UI shows what applies. */
function baseSchema(t: T) {
  return z.object({
    name: z.string().min(2, t("serviceDialog.validation.name")),
    nameAr: z.string().min(2, t("serviceDialog.validation.nameArabic")),
    category: z.string(),
    description: z.string().min(5, t("serviceDialog.validation.description")),
    descriptionAr: z
      .string()
      .min(5, t("serviceDialog.validation.descriptionArabic")),
    // Nullable throughout: the API leaves these unanswered on an existing
    // service, and the editor shows an empty field rather than a made-up one.
    price: z.number().min(0, t("serviceDialog.validation.priceNegative")).nullable(),
    durationMinutes: z
      .number()
      .int()
      .min(5, t("serviceDialog.validation.minMinutes"))
      .max(480, t("serviceDialog.validation.tooLong"))
      .nullable(),
    resultTimeHours: z
      .number()
      .int()
      .min(1, t("serviceDialog.validation.minHour"))
      .max(720, t("serviceDialog.validation.tooLong"))
      .nullable(),
    contrastRequired: z.boolean().nullable(),
    isActive: z.boolean(),

    // -- Preparation (§3) ---------------------------------------------------
    fastingRequired: z.boolean(),
    fastingHours: z
      .number()
      .int()
      .min(1, t("serviceDialog.validation.minHour"))
      .max(24, t("serviceDialog.validation.fastTooLong"))
      .optional(),
    waterAllowed: z.boolean(),
    medicationRestrictions: z.string(),
    medicationRestrictionsAr: z.string(),
    arrivalInstructions: z.string(),
    arrivalInstructionsAr: z.string(),
    documentsRequired: z.string(),
    documentsRequiredAr: z.string(),

    // -- Eligibility (§3) ---------------------------------------------------
    genderRestriction: z.enum(["any", "male", "female"]),
    minAge: z.number().int().min(0).max(120).optional(),
    maxAge: z.number().int().min(0).max(120).optional(),
    pregnancySafe: z.boolean(),
    excludedConditions: z.array(z.string()),
  });
}

type ServiceFormValues = z.infer<ReturnType<typeof baseSchema>>;

/** Category, preparation and eligibility are lab/radiology only. */
function schemaFor(type: ProviderRole, t: T) {
  return baseSchema(t).superRefine((values, ctx) => {
    if (type === "doctor") return;

    if (values.category.trim().length < 2) {
      ctx.addIssue({
        code: "custom",
        path: ["category"],
        message: t("serviceDialog.validation.category"),
      });
    }
    if (values.arrivalInstructions.trim().length < 5) {
      ctx.addIssue({
        code: "custom",
        path: ["arrivalInstructions"],
        message: t("serviceDialog.validation.arrival"),
      });
    }
    if (values.arrivalInstructionsAr.trim().length < 5) {
      ctx.addIssue({
        code: "custom",
        path: ["arrivalInstructionsAr"],
        message: t("serviceDialog.validation.arrivalArabic"),
      });
    }
    if (values.fastingRequired && values.fastingHours === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["fastingHours"],
        message: t("serviceDialog.validation.fastingHours"),
      });
    }
    if (
      values.minAge !== undefined &&
      values.maxAge !== undefined &&
      values.maxAge < values.minAge
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["maxAge"],
        message: t("serviceDialog.validation.ageRange"),
      });
    }
  });
}

const EMPTY: ServiceFormValues = {
  name: "",
  nameAr: "",
  category: "",
  description: "",
  descriptionAr: "",
  price: 0,
  durationMinutes: 30,
  resultTimeHours: 24,
  contrastRequired: false,
  isActive: true,

  fastingRequired: false,
  fastingHours: undefined,
  waterAllowed: true,
  medicationRestrictions: "",
  medicationRestrictionsAr: "",
  arrivalInstructions: ARRIVAL_DEFAULT.en,
  arrivalInstructionsAr: ARRIVAL_DEFAULT.ar,
  documentsRequired: unzipLines(DOCUMENTS_DEFAULT, "en"),
  documentsRequiredAr: unzipLines(DOCUMENTS_DEFAULT, "ar"),

  genderRestriction: "any",
  minAge: undefined,
  maxAge: undefined,
  pregnancySafe: true,
  excludedConditions: [],
};

function genderRestrictionOf(
  genders: Gender[] | undefined,
): ServiceFormValues["genderRestriction"] {
  if (!genders || genders.length !== 1) return "any";
  return genders[0];
}

function toFormValues(service: EditableService | null): ServiceFormValues {
  if (!service) return EMPTY;

  const prep: PreparationInstructions | undefined =
    service.kind === "consultation" ? undefined : service.preparation;
  const rules: EligibilityRules | undefined =
    service.kind === "consultation" ? undefined : service.eligibility;

  return {
    name: service.name,
    nameAr: service.nameAr,
    category: service.kind === "consultation" ? "" : (service.category ?? ""),
    description: service.description?.en ?? "",
    descriptionAr: service.description?.ar ?? "",
    price: service.price,
    durationMinutes:
      service.kind === "test" ? EMPTY.durationMinutes : service.durationMinutes,
    resultTimeHours:
      service.kind === "test" ? service.resultTimeHours : EMPTY.resultTimeHours,
    contrastRequired: service.kind === "scan" ? service.contrastRequired : false,
    isActive: service.isActive,

    fastingRequired: prep?.fastingRequired ?? false,
    fastingHours: prep?.fastingHours,
    waterAllowed: prep?.waterAllowed ?? true,
    medicationRestrictions: unzipLines(prep?.medicationRestrictions, "en"),
    medicationRestrictionsAr: unzipLines(prep?.medicationRestrictions, "ar"),
    arrivalInstructions:
      prep?.arrivalInstructions.en ?? EMPTY.arrivalInstructions,
    arrivalInstructionsAr:
      prep?.arrivalInstructions.ar ?? EMPTY.arrivalInstructionsAr,
    documentsRequired: prep?.documentsRequired.length
      ? unzipLines(prep.documentsRequired, "en")
      : EMPTY.documentsRequired,
    documentsRequiredAr: prep?.documentsRequired.length
      ? unzipLines(prep.documentsRequired, "ar")
      : EMPTY.documentsRequiredAr,

    genderRestriction: genderRestrictionOf(rules?.genders),
    minAge: rules?.minAge,
    maxAge: rules?.maxAge,
    pregnancySafe: rules?.pregnancySafe ?? true,
    excludedConditions: rules?.excludedConditions ?? [],
  };
}

function preparationOf(values: ServiceFormValues): PreparationInstructions {
  return {
    fastingRequired: values.fastingRequired,
    fastingHours: values.fastingRequired ? values.fastingHours : undefined,
    waterAllowed: values.waterAllowed,
    medicationRestrictions: zipLines(
      values.medicationRestrictions,
      values.medicationRestrictionsAr,
    ),
    arrivalInstructions: {
      en: values.arrivalInstructions.trim(),
      ar: values.arrivalInstructionsAr.trim(),
    },
    documentsRequired: zipLines(
      values.documentsRequired,
      values.documentsRequiredAr,
    ),
  };
}

function eligibilityOf(values: ServiceFormValues): EligibilityRules {
  return {
    genders:
      values.genderRestriction === "any"
        ? undefined
        : [values.genderRestriction as Gender],
    minAge: values.minAge,
    maxAge: values.maxAge,
    pregnancySafe: values.pregnancySafe,
    excludedConditions: values.excludedConditions,
  };
}

/** Strips the fields that don't belong to this provider type. */
function toPayload(type: ProviderRole, values: ServiceFormValues): NewService {
  const description: LocalizedText = {
    en: values.description.trim(),
    ar: values.descriptionAr.trim(),
  };

  if (type === "doctor") {
    return {
      name: values.name,
      nameAr: values.nameAr,
      description,
      price: values.price,
      durationMinutes: values.durationMinutes,
      isActive: values.isActive,
    };
  }

  const shared = {
    name: values.name,
    nameAr: values.nameAr,
    category: values.category,
    description,
    price: values.price,
    isActive: values.isActive,
    preparation: preparationOf(values),
    eligibility: eligibilityOf(values),
  };

  if (type === "lab") {
    return {
      ...shared,
      resultTimeHours: values.resultTimeHours,
      // The catalogue flag and the preparation instructions are the same fact.
      fastingRequired: values.fastingRequired,
    };
  }

  return {
    ...shared,
    durationMinutes: values.durationMinutes,
    contrastRequired: values.contrastRequired,
  };
}

const ADD_KEYS = {
  doctor: "serviceDialog.addDoctor",
  lab: "serviceDialog.addLab",
  radiology: "serviceDialog.addRadiology",
} as const;

const EDIT_KEYS = {
  doctor: "serviceDialog.editDoctor",
  lab: "serviceDialog.editLab",
  radiology: "serviceDialog.editRadiology",
} as const;

const DESCRIPTION_KEYS = {
  doctor: "serviceDialog.descriptionDoctor",
  lab: "serviceDialog.descriptionLab",
  radiology: "serviceDialog.descriptionRadiology",
} as const;

const NAME_PLACEHOLDER_KEYS = {
  doctor: "serviceDialog.namePlaceholderDoctor",
  lab: "serviceDialog.namePlaceholderLab",
  radiology: "serviceDialog.namePlaceholderRadiology",
} as const;

export function ServiceDialog({
  providerId,
  providerType,
  service,
  open,
  onOpenChange,
  onSaved,
}: {
  providerId: string;
  providerType: ProviderRole;
  /** `null` = create. */
  service: EditableService | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const tRich = useTranslations("provider");
  const tCommon = useTranslations("common");
  const describeError = useApiError();
  const L = useLabels();

  // The Zod messages are translations too, so the schema is built from `t`.
  const t = useCallback<T>(
    (key, values) => tRich(key as never, values as never),
    [tRich],
  );

  const schema = useMemo(() => schemaFor(providerType, t), [providerType, t]);

  const form = useForm<ServiceFormValues>({
    resolver: zodResolver(schema),
    defaultValues: toFormValues(service),
  });

  const create = useMutation(createService);
  const update = useMutation(updateService);
  const isPending = create.isPending || update.isPending;

  useEffect(() => {
    if (open) form.reset(toFormValues(service));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, service]);

  const clinical = providerType !== "doctor";
  /** The clinical sections only ever render for a lab or a radiology centre. */
  const suffix = providerType === "lab" ? "Lab" : "Radiology";

  const fastingRequired = form.watch("fastingRequired");
  const excluded = form.watch("excludedConditions");

  const genderOptions = [
    { value: "any", label: t("serviceDialog.genderAny") },
    { value: "male", label: t("serviceDialog.genderMale") },
    { value: "female", label: t("serviceDialog.genderFemale") },
  ];

  async function onSubmit(values: ServiceFormValues) {
    const payload = toPayload(providerType, values);

    try {
      if (service) {
        await update.mutate(providerId, service.id, payload);
        toast.success(t("serviceDialog.updated", { name: values.name }));
      } else {
        await create.mutate(providerId, payload);
        toast.success(t("serviceDialog.added", { name: values.name }));
      }
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error(describeError(error));
    }
  }

  function toggleCondition(condition: string, checked: boolean) {
    const current = form.getValues("excludedConditions");
    form.setValue(
      "excludedConditions",
      checked ? [...current, condition] : current.filter((c) => c !== condition),
      { shouldDirty: true },
    );
  }

  return (
    <Dialog open={open} onOpenChange={(next: boolean) => onOpenChange(next)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {service ? t(EDIT_KEYS[providerType]) : t(ADD_KEYS[providerType])}
          </DialogTitle>
          <DialogDescription>
            {t(DESCRIPTION_KEYS[providerType])}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
            id="service-form"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("serviceDialog.nameEnglish")}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        dir="ltr"
                        placeholder={t(NAME_PLACEHOLDER_KEYS[providerType])}
                        className="h-10 rounded-xl text-start"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="nameAr"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("serviceDialog.nameArabic")}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        dir="rtl"
                        placeholder={t("serviceDialog.nameArabicPlaceholder")}
                        className="h-10 rounded-xl text-start"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {clinical && (
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("serviceDialog.category")}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder={t(
                          `serviceDialog.categoryPlaceholder${suffix}`,
                        )}
                        className="h-10 rounded-xl"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("serviceDialog.descriptionEnglish")}</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        dir="ltr"
                        rows={3}
                        placeholder={t("serviceDialog.descriptionPlaceholder")}
                        className="rounded-xl text-start"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="descriptionAr"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("serviceDialog.descriptionArabic")}</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        dir="rtl"
                        rows={3}
                        placeholder={t("serviceDialog.descriptionPlaceholderAr")}
                        className="rounded-xl text-start"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <p className="text-xs text-muted-foreground">
              {t("serviceDialog.bilingualHint")}
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("serviceDialog.price")}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        step={10}
                        value={field.value === null ? "" : String(field.value)}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value === "" ? null : Number(e.target.value),
                          )
                        }
                        onBlur={field.onBlur}
                        name={field.name}
                        className="h-10 rounded-xl"
                      />
                    </FormControl>
                    <FormDescription>
                      {clinical
                        ? t("serviceDialog.priceHintClinical")
                        : t("serviceDialog.priceHintDoctor")}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {providerType === "lab" ? (
                <FormField
                  control={form.control}
                  name="resultTimeHours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("serviceDialog.resultTime")}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          step={1}
                          value={field.value === null ? "" : String(field.value)}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value === "" ? null : Number(e.target.value),
                            )
                          }
                          onBlur={field.onBlur}
                          name={field.name}
                          className="h-10 rounded-xl"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : (
                <FormField
                  control={form.control}
                  name="durationMinutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("serviceDialog.duration")}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={5}
                          step={5}
                          value={field.value === null ? "" : String(field.value)}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value === "" ? null : Number(e.target.value),
                            )
                          }
                          onBlur={field.onBlur}
                          name={field.name}
                          className="h-10 rounded-xl"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            {providerType === "radiology" && (
              <FormField
                control={form.control}
                name="contrastRequired"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-xl border p-4">
                    <div className="space-y-0.5">
                      <FormLabel>{t("serviceDialog.contrastRequired")}</FormLabel>
                      <FormDescription>
                        {t("serviceDialog.contrastHint")}
                      </FormDescription>
                    </div>
                    <FormControl>
                      {/* A switch has no third position: an unanswered
                          `contrastRequired` shows off until it is set. */}
                      <Switch
                        checked={field.value === true}
                        onCheckedChange={(checked: boolean) => field.onChange(checked)}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            )}

            {/* ------------------------------------------- preparation (§3) */}
            {clinical && (
              <>
                <Separator />

                <Alert>
                  <ShieldCheck className="size-4" />
                  <AlertTitle>{t("serviceDialog.acknowledgeTitle")}</AlertTitle>
                  <AlertDescription>
                    {tRich.rich(
                      suffix === "Lab"
                        ? "serviceDialog.acknowledgeBodyLab"
                        : "serviceDialog.acknowledgeBodyRadiology",
                      { strong: (chunks) => <strong>{chunks}</strong> },
                    )}
                  </AlertDescription>
                </Alert>

                <div className="space-y-4 rounded-2xl border p-4">
                  <div>
                    <h4 className="font-semibold">
                      {t("serviceDialog.preparation")}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {t("serviceDialog.preparationHint")}
                    </p>
                  </div>

                  <FormField
                    control={form.control}
                    name="fastingRequired"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-xl border p-4">
                        <div className="space-y-0.5">
                          <FormLabel>
                            {t("serviceDialog.fastingRequired")}
                          </FormLabel>
                          <FormDescription>
                            {t(`serviceDialog.fastingHint${suffix}`)}
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={(checked: boolean) =>
                              field.onChange(checked)
                            }
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {fastingRequired && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="fastingHours"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              {t("serviceDialog.fastingHours")}
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min={1}
                                max={24}
                                step={1}
                                value={
                                  field.value === undefined ? "" : String(field.value)
                                }
                                onChange={(e) =>
                                  field.onChange(
                                    e.target.value === ""
                                      ? undefined
                                      : Number(e.target.value),
                                  )
                                }
                                onBlur={field.onBlur}
                                name={field.name}
                                placeholder="12"
                                className="h-10 rounded-xl"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="waterAllowed"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-xl border p-4">
                            <div className="space-y-0.5">
                              <FormLabel>
                                {t("serviceDialog.waterAllowed")}
                              </FormLabel>
                              <FormDescription>
                                {t("serviceDialog.waterAllowedHint")}
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={(checked: boolean) =>
                                  field.onChange(checked)
                                }
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="medicationRestrictions"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {t("serviceDialog.medicationEnglish")}
                          </FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              dir="ltr"
                              rows={3}
                              placeholder={t("serviceDialog.medicationPlaceholder")}
                              className="rounded-xl text-start"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="medicationRestrictionsAr"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {t("serviceDialog.medicationArabic")}
                          </FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              dir="rtl"
                              rows={3}
                              placeholder={t("serviceDialog.medicationPlaceholderAr")}
                              className="rounded-xl text-start"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("serviceDialog.medicationHint")}
                  </p>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="arrivalInstructions"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {t("serviceDialog.arrivalEnglish")}
                          </FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              dir="ltr"
                              rows={2}
                              placeholder={t("serviceDialog.arrivalPlaceholder")}
                              className="rounded-xl text-start"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="arrivalInstructionsAr"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {t("serviceDialog.arrivalArabic")}
                          </FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              dir="rtl"
                              rows={2}
                              placeholder={t("serviceDialog.arrivalPlaceholderAr")}
                              className="rounded-xl text-start"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("serviceDialog.arrivalHint")}
                  </p>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="documentsRequired"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {t("serviceDialog.documentsEnglish")}
                          </FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              dir="ltr"
                              rows={3}
                              placeholder={t("serviceDialog.documentsPlaceholder")}
                              className="rounded-xl text-start"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="documentsRequiredAr"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {t("serviceDialog.documentsArabic")}
                          </FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              dir="rtl"
                              rows={3}
                              placeholder={t("serviceDialog.documentsPlaceholderAr")}
                              className="rounded-xl text-start"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("serviceDialog.documentsHint")}
                  </p>
                </div>

                {/* ---------------------------------------- eligibility (§3) */}
                <div className="space-y-4 rounded-2xl border p-4">
                  <div>
                    <h4 className="font-semibold">
                      {t("serviceDialog.eligibility")}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {t(`serviceDialog.eligibilityHint${suffix}`)}
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <FormField
                      control={form.control}
                      name="genderRestriction"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("serviceDialog.gender")}</FormLabel>
                          <FormControl>
                            <AppSelect
                              value={field.value}
                              onValueChange={(value) =>
                                field.onChange(value || "any")
                              }
                              options={genderOptions}
                              className="h-10"
                              aria-label={t("serviceDialog.genderAria")}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="minAge"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("serviceDialog.minAge")}</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={0}
                              max={120}
                              step={1}
                              value={field.value === undefined ? "" : String(field.value)}
                              onChange={(e) =>
                                field.onChange(
                                  e.target.value === ""
                                    ? undefined
                                    : Number(e.target.value),
                                )
                              }
                              onBlur={field.onBlur}
                              name={field.name}
                              placeholder={t("serviceDialog.agePlaceholder")}
                              className="h-10 rounded-xl"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="maxAge"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("serviceDialog.maxAge")}</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={0}
                              max={120}
                              step={1}
                              value={field.value === undefined ? "" : String(field.value)}
                              onChange={(e) =>
                                field.onChange(
                                  e.target.value === ""
                                    ? undefined
                                    : Number(e.target.value),
                                )
                              }
                              onBlur={field.onBlur}
                              name={field.name}
                              placeholder={t("serviceDialog.agePlaceholder")}
                              className="h-10 rounded-xl"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="pregnancySafe"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-xl border p-4">
                        <div className="space-y-0.5">
                          <FormLabel>
                            {t("serviceDialog.pregnancySafe")}
                          </FormLabel>
                          <FormDescription>
                            {t("serviceDialog.pregnancySafeHint")}
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={(checked: boolean) =>
                              field.onChange(checked)
                            }
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <div className="space-y-2">
                    <Label>{t("serviceDialog.excludedConditions")}</Label>
                    <p className="text-sm text-muted-foreground">
                      {t(`serviceDialog.excludedHint${suffix}`)}
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {CHRONIC_CONDITIONS.map((condition) => {
                        const checked = excluded.includes(condition);
                        const label = L.condition(condition);

                        return (
                          <label
                            key={condition}
                            className="flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm"
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(next: boolean) =>
                                toggleCondition(condition, next)
                              }
                              aria-label={label}
                            />
                            <span>{label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </>
            )}

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-xl border p-4">
                  <div className="space-y-0.5">
                    <FormLabel>{t("serviceDialog.active")}</FormLabel>
                    <FormDescription>
                      {t("serviceDialog.activeHint")}
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={(checked: boolean) => field.onChange(checked)}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </form>
        </Form>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-10 rounded-xl px-4"
          >
            {tCommon("actions.cancel")}
          </Button>
          <Button
            type="submit"
            form="service-form"
            disabled={isPending}
            className="h-10 rounded-xl px-4"
          >
            {isPending
              ? tCommon("states.saving")
              : service
                ? tCommon("actions.saveChanges")
                : t("serviceDialog.add")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
