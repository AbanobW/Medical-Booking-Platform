"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ShieldCheck } from "lucide-react";
import { useEffect } from "react";
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
import type {
  ConsultationType,
  EligibilityRules,
  Gender,
  LabTest,
  PreparationInstructions,
  ProviderRole,
  RadiologyScan,
} from "@/lib/types";

export type EditableService = ConsultationType | LabTest | RadiologyScan;

// ---------------------------------------------------------------------------
// Multi-line fields are edited as text and stored as lists.
// ---------------------------------------------------------------------------

const toLines = (text: string): string[] =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

const fromLines = (lines: string[]): string => lines.join("\n");

/** One flat shape covers all three provider types; the UI shows what applies. */
const serviceSchema = z.object({
  name: z.string().min(2, "Give this service a name."),
  nameAr: z.string(),
  category: z.string(),
  description: z.string().min(5, "Add a short description."),
  price: z.number().min(0, "Price can't be negative."),
  durationMinutes: z
    .number()
    .int()
    .min(5, "At least 5 minutes.")
    .max(480, "That's too long."),
  resultTimeHours: z
    .number()
    .int()
    .min(1, "At least 1 hour.")
    .max(720, "That's too long."),
  contrastRequired: z.boolean(),
  isActive: z.boolean(),

  // -- Preparation (§3) -----------------------------------------------------
  fastingRequired: z.boolean(),
  fastingHours: z
    .number()
    .int()
    .min(1, "At least 1 hour.")
    .max(24, "A fast longer than a day isn't realistic.")
    .optional(),
  waterAllowed: z.boolean(),
  medicationRestrictions: z.string(),
  arrivalInstructions: z.string(),
  documentsRequired: z.string(),

  // -- Eligibility (§3) -----------------------------------------------------
  genderRestriction: z.enum(["any", "male", "female"]),
  minAge: z.number().int().min(0).max(120).optional(),
  maxAge: z.number().int().min(0).max(120).optional(),
  pregnancySafe: z.boolean(),
  excludedConditions: z.array(z.string()),
});

type ServiceFormValues = z.infer<typeof serviceSchema>;

/** Arabic name, category, preparation and eligibility are lab/radiology only. */
function schemaFor(type: ProviderRole) {
  return serviceSchema.superRefine((values, ctx) => {
    if (type === "doctor") return;

    if (values.nameAr.trim().length < 2) {
      ctx.addIssue({
        code: "custom",
        path: ["nameAr"],
        message: "Add the Arabic name.",
      });
    }
    if (values.category.trim().length < 2) {
      ctx.addIssue({
        code: "custom",
        path: ["category"],
        message: "Pick a category.",
      });
    }
    if (values.arrivalInstructions.trim().length < 5) {
      ctx.addIssue({
        code: "custom",
        path: ["arrivalInstructions"],
        message: "Tell the patient when to arrive and what to bring.",
      });
    }
    if (values.fastingRequired && values.fastingHours === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["fastingHours"],
        message: "Say how many hours they must fast.",
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
        message: "The maximum age can't be below the minimum.",
      });
    }
  });
}

const EMPTY: ServiceFormValues = {
  name: "",
  nameAr: "",
  category: "",
  description: "",
  price: 0,
  durationMinutes: 30,
  resultTimeHours: 24,
  contrastRequired: false,
  isActive: true,

  fastingRequired: false,
  fastingHours: undefined,
  waterAllowed: true,
  medicationRestrictions: "",
  arrivalInstructions: "Arrive 10 minutes before your appointment.",
  documentsRequired: "National ID",

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
    nameAr: service.kind === "consultation" ? "" : service.nameAr,
    category: service.kind === "consultation" ? "" : service.category,
    description: service.description,
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
    medicationRestrictions: fromLines(prep?.medicationRestrictions ?? []),
    arrivalInstructions: prep?.arrivalInstructions ?? EMPTY.arrivalInstructions,
    documentsRequired: fromLines(prep?.documentsRequired ?? ["National ID"]),

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
    medicationRestrictions: toLines(values.medicationRestrictions),
    arrivalInstructions: values.arrivalInstructions.trim(),
    documentsRequired: toLines(values.documentsRequired),
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
  if (type === "doctor") {
    return {
      name: values.name,
      description: values.description,
      price: values.price,
      durationMinutes: values.durationMinutes,
      isActive: values.isActive,
    };
  }

  const shared = {
    name: values.name,
    nameAr: values.nameAr,
    category: values.category,
    description: values.description,
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

const NOUN: Record<ProviderRole, string> = {
  doctor: "consultation type",
  lab: "test",
  radiology: "scan",
};

const GENDER_OPTIONS = [
  { value: "any", label: "Anyone" },
  { value: "male", label: "Men only" },
  { value: "female", label: "Women only" },
];

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
  const form = useForm<ServiceFormValues>({
    resolver: zodResolver(schemaFor(providerType)),
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
  const fastingRequired = form.watch("fastingRequired");
  const excluded = form.watch("excludedConditions");

  async function onSubmit(values: ServiceFormValues) {
    const payload = toPayload(providerType, values);

    try {
      if (service) {
        await update.mutate(providerId, service.id, payload);
        toast.success(`${values.name} updated.`);
      } else {
        await create.mutate(providerId, payload);
        toast.success(`${values.name} added.`);
      }
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't save this service.",
      );
    }
  }

  function toggleCondition(condition: string, checked: boolean) {
    const current = form.getValues("excludedConditions");
    form.setValue(
      "excludedConditions",
      checked
        ? [...current, condition]
        : current.filter((c) => c !== condition),
      { shouldDirty: true },
    );
  }

  return (
    <Dialog open={open} onOpenChange={(next: boolean) => onOpenChange(next)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {service ? "Edit" : "Add"} {NOUN[providerType]}
          </DialogTitle>
          <DialogDescription>
            {providerType === "doctor"
              ? "Consultation types are what patients pick when they book you."
              : `Patients book individual ${NOUN[providerType]}s or a package that includes them.`}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
            id="service-form"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder={
                        providerType === "doctor"
                          ? "In-clinic consultation"
                          : providerType === "lab"
                            ? "Complete blood count"
                            : "Brain MRI"
                      }
                      className="h-10 rounded-xl"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {clinical && (
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="nameAr"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Arabic name</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          dir="rtl"
                          placeholder="صورة دم كاملة"
                          className="h-10 rounded-xl"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder={providerType === "lab" ? "Hematology" : "MRI"}
                          className="h-10 rounded-xl"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={3}
                      placeholder="What the patient should expect."
                      className="rounded-xl"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price (EGP)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        step={10}
                        value={String(field.value)}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                        onBlur={field.onBlur}
                        name={field.name}
                        className="h-10 rounded-xl"
                      />
                    </FormControl>
                    <FormDescription>
                      {clinical
                        ? "A branch can price this differently — this is the default."
                        : "Your consultation fee."}
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
                      <FormLabel>Result time (hours)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          step={1}
                          value={String(field.value)}
                          onChange={(e) => field.onChange(Number(e.target.value))}
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
                      <FormLabel>Duration (minutes)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={5}
                          step={5}
                          value={String(field.value)}
                          onChange={(e) => field.onChange(Number(e.target.value))}
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
                      <FormLabel>Contrast required</FormLabel>
                      <FormDescription>
                        A contrast agent is administered for this scan.
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
            )}

            {/* ------------------------------------------- preparation (§3) */}
            {clinical && (
              <>
                <Separator />

                <Alert>
                  <ShieldCheck className="size-4" />
                  <AlertTitle>The patient must acknowledge all of this</AlertTitle>
                  <AlertDescription>
                    Everything you set below is shown to the patient during
                    booking, and they <strong>cannot complete the booking</strong>{" "}
                    until they have confirmed they have read the preparation and
                    that the profile they are booking for meets the rules. That is
                    the point of it: nobody turns up un-fasted, and nobody books a{" "}
                    {NOUN[providerType]} they cannot have.
                  </AlertDescription>
                </Alert>

                <div className="space-y-4 rounded-2xl border p-4">
                  <div>
                    <h4 className="font-semibold">Preparation</h4>
                    <p className="text-sm text-muted-foreground">
                      What the patient must do before they arrive.
                    </p>
                  </div>

                  <FormField
                    control={form.control}
                    name="fastingRequired"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-xl border p-4">
                        <div className="space-y-0.5">
                          <FormLabel>Fasting required</FormLabel>
                          <FormDescription>
                            The patient must not eat before the{" "}
                            {NOUN[providerType]}.
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
                            <FormLabel>Fasting hours</FormLabel>
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
                              <FormLabel>Water allowed</FormLabel>
                              <FormDescription>
                                Plain water during the fast.
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

                  <FormField
                    control={form.control}
                    name="medicationRestrictions"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Medication restrictions</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            rows={3}
                            placeholder={
                              "Stop metformin 48 hours before a contrast scan.\nPause biotin supplements for 48 hours."
                            }
                            className="rounded-xl"
                          />
                        </FormControl>
                        <FormDescription>
                          One per line. Medicines to pause — or to keep taking.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="arrivalInstructions"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Arrival instructions</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            rows={2}
                            placeholder="Arrive 30 minutes early. Leave all metal at home."
                            className="rounded-xl"
                          />
                        </FormControl>
                        <FormDescription>
                          When to arrive and anything they must do on the day.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="documentsRequired"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Documents required</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            rows={3}
                            placeholder={"National ID\nDoctor's referral\nPrevious imaging"}
                            className="rounded-xl"
                          />
                        </FormControl>
                        <FormDescription>
                          One per line. What the patient must bring with them.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* ---------------------------------------- eligibility (§3) */}
                <div className="space-y-4 rounded-2xl border p-4">
                  <div>
                    <h4 className="font-semibold">Eligibility</h4>
                    <p className="text-sm text-muted-foreground">
                      Who may book this {NOUN[providerType]}. A profile that fails
                      these rules is blocked from booking, and told why.
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <FormField
                      control={form.control}
                      name="genderRestriction"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Gender</FormLabel>
                          <FormControl>
                            <AppSelect
                              value={field.value}
                              onValueChange={(value) =>
                                field.onChange(value || "any")
                              }
                              options={GENDER_OPTIONS}
                              className="h-10"
                              aria-label="Gender restriction"
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
                          <FormLabel>Minimum age</FormLabel>
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
                              placeholder="Any"
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
                          <FormLabel>Maximum age</FormLabel>
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
                              placeholder="Any"
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
                          <FormLabel>Safe during pregnancy</FormLabel>
                          <FormDescription>
                            Turn this off for anything unsafe in pregnancy —
                            ionising radiation, for instance. Pregnant profiles are
                            then blocked from booking it.
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
                    <Label>Excluded conditions</Label>
                    <p className="text-sm text-muted-foreground">
                      A profile carrying any of these cannot book this{" "}
                      {NOUN[providerType]}.
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {CHRONIC_CONDITIONS.map((condition) => {
                        const checked = excluded.includes(condition);
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
                              aria-label={condition}
                            />
                            <span>{condition}</span>
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
                    <FormLabel>Active</FormLabel>
                    <FormDescription>
                      Inactive services are hidden from patients.
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
            Cancel
          </Button>
          <Button
            type="submit"
            form="service-form"
            disabled={isPending}
            className="h-10 rounded-xl px-4"
          >
            {isPending ? "Saving…" : service ? "Save changes" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
