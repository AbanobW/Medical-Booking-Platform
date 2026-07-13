"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

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
import { Switch } from "@/components/ui/switch";
import { useMutation } from "@/hooks/use-async";
import {
  createPatientProfile,
  updatePatientProfile,
  type PatientProfileInput,
} from "@/lib/api/profiles";
import { CHRONIC_CONDITIONS } from "@/lib/data/clinical";
import { TODAY } from "@/lib/data/seed";
import {
  RELATIONSHIPS,
  RELATIONSHIP_LABELS,
  type PatientProfile,
  type Relationship,
} from "@/lib/types";

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const BLOOD_OPTIONS = BLOOD_TYPES.map((type) => ({ value: type, label: type }));

const GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
];

const profileSchema = z.object({
  relationship: z.enum(["self", "child", "spouse", "parent"], {
    message: "Choose who this profile is for.",
  }),
  fullName: z.string().trim().min(3, "Enter the patient's full name."),
  gender: z.enum(["male", "female"], { message: "Select a gender." }),
  dateOfBirth: z
    .string()
    .min(1, "Select a date of birth.")
    .refine((value) => new Date(`${value}T00:00:00.000Z`) <= TODAY, {
      message: "The date of birth must be in the past.",
    }),
  phone: z
    .string()
    .trim()
    .refine((value) => value === "" || /^01[0125]\d{8}$/.test(value), {
      message: "Enter a valid Egyptian mobile number (11 digits), or leave it blank.",
    }),
  bloodType: z.string(),
  chronicConditions: z.array(z.string()),
  isPregnant: z.boolean(),
});

type ProfileValues = z.infer<typeof profileSchema>;

const BLANK: ProfileValues = {
  relationship: "child",
  fullName: "",
  gender: "male",
  dateOfBirth: "",
  phone: "",
  bloodType: "",
  chronicConditions: [],
  isPregnant: false,
};

function toValues(profile: PatientProfile): ProfileValues {
  return {
    relationship: profile.relationship,
    fullName: profile.fullName,
    gender: profile.gender,
    dateOfBirth: profile.dateOfBirth.slice(0, 10),
    phone: profile.phone ?? "",
    bloodType: profile.bloodType ?? "",
    chronicConditions: [...profile.chronicConditions],
    isPregnant: profile.isPregnant,
  };
}

function toInput(values: ProfileValues): PatientProfileInput {
  return {
    relationship: values.relationship,
    fullName: values.fullName.trim(),
    gender: values.gender,
    dateOfBirth: values.dateOfBirth,
    phone: values.phone.trim() || undefined,
    bloodType: values.bloodType || undefined,
    chronicConditions: values.chronicConditions,
    isPregnant: values.gender === "female" && values.isPregnant,
  };
}

/**
 * Add or edit a patient profile.
 *
 * The form is deliberately explicit about *why* it asks for gender, age,
 * pregnancy and chronic conditions: those four fields are what the booking flow
 * screens a service's eligibility rules against (§3). If they are wrong, the
 * screening is wrong.
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
  const isEdit = profile !== undefined;

  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    values: profile ? toValues(profile) : BLANK,
  });

  const create = useMutation(createPatientProfile);
  const update = useMutation(updatePatientProfile);
  const isPending = create.isPending || update.isPending;

  const gender = form.watch("gender");
  const conditions = form.watch("chronicConditions");

  // "Myself" is offered only when the account doesn't already have one, and is
  // locked while editing — an account has exactly one self profile.
  const relationshipOptions = RELATIONSHIPS.filter(
    (value) => value !== "self" || !hasSelf || profile?.relationship === "self",
  ).map((value) => ({ value, label: RELATIONSHIP_LABELS[value] }));

  async function onSubmit(values: ProfileValues) {
    try {
      if (profile) {
        await update.mutate(profile.id, accountId, toInput(values));
        toast.success(`${values.fullName.trim()}'s profile was updated.`);
      } else {
        await create.mutate(accountId, toInput(values));
        toast.success(`${values.fullName.trim()} was added to your account.`);
      }
      onOpenChange(false);
      form.reset(BLANK);
      onSaved();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Couldn't save this profile. Please try again.",
      );
    }
  }

  function toggleCondition(condition: string, checked: boolean) {
    const next = checked
      ? [...conditions, condition]
      : conditions.filter((c) => c !== condition);

    form.setValue("chronicConditions", next, { shouldDirty: true });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? `Edit ${profile.fullName}` : "Add a patient profile"}
          </DialogTitle>
          <DialogDescription>
            Bookings belong to a patient profile, not to your account — so each
            person&apos;s medical and booking history stays with them. We ask for
            gender, date of birth, pregnancy and chronic conditions because we screen
            every test and scan against them before you book: it is what stops a
            scan being booked for someone it isn&apos;t safe for.
          </DialogDescription>
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
                    <FormLabel>Who is this for?</FormLabel>
                    <FormControl>
                      <AppSelect
                        value={field.value}
                        onValueChange={(value) =>
                          field.onChange(value as Relationship)
                        }
                        options={relationshipOptions}
                        placeholder="Select a relationship"
                        disabled={isPending || profile?.relationship === "self"}
                      />
                    </FormControl>
                    {profile?.relationship === "self" && (
                      <FormDescription>
                        This is your own profile and can&apos;t be reassigned.
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
                    <FormLabel>Full name</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="e.g. Nour Hassan"
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
                    <FormLabel>Gender</FormLabel>
                    <FormControl>
                      <AppSelect
                        value={field.value}
                        onValueChange={(value) => {
                          field.onChange(value as ProfileValues["gender"]);
                          if (value === "male") {
                            form.setValue("isPregnant", false, {
                              shouldDirty: true,
                            });
                          }
                        }}
                        options={GENDER_OPTIONS}
                        placeholder="Select gender"
                        disabled={isPending}
                      />
                    </FormControl>
                    <FormDescription>
                      Some tests and scans are restricted by gender.
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
                    <FormLabel>Date of birth</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="date"
                        className="h-11 rounded-xl"
                        disabled={isPending}
                      />
                    </FormControl>
                    <FormDescription>
                      Age limits apply to several scans.
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
                    <FormLabel>Mobile number (optional)</FormLabel>
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
                name="bloodType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Blood type (optional)</FormLabel>
                    <FormControl>
                      <AppSelect
                        value={field.value}
                        onValueChange={field.onChange}
                        options={BLOOD_OPTIONS}
                        emptyOption="Not known"
                        placeholder="Select blood type"
                        disabled={isPending}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Chronic conditions ------------------------------------------ */}
            <FormField
              control={form.control}
              name="chronicConditions"
              render={() => (
                <FormItem>
                  <FormLabel>Chronic conditions</FormLabel>
                  <FormDescription>
                    Select everything that applies. A condition here can rule a scan
                    out entirely — a pacemaker rules out an MRI, for instance.
                  </FormDescription>
                  <div className="grid gap-2 rounded-xl border p-4 sm:grid-cols-2">
                    {CHRONIC_CONDITIONS.map((condition) => {
                      const id = `condition-${condition.replace(/\s+/g, "-")}`;
                      return (
                        <div key={condition} className="flex items-center gap-2">
                          <Checkbox
                            id={id}
                            checked={conditions.includes(condition)}
                            onCheckedChange={(checked) =>
                              toggleCondition(condition, checked === true)
                            }
                            disabled={isPending}
                          />
                          <Label
                            htmlFor={id}
                            className="text-sm font-normal text-muted-foreground"
                          >
                            {condition}
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Pregnancy — only meaningful for a female profile -------------- */}
            {gender === "female" && (
              <FormField
                control={form.control}
                name="isPregnant"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between gap-4 rounded-xl border p-4">
                    <div className="space-y-1">
                      <FormLabel>Currently pregnant</FormLabel>
                      <FormDescription>
                        X-ray, CT and mammography are never performed during
                        pregnancy. We block those bookings for you.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={(checked) => field.onChange(checked)}
                        disabled={isPending}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
                className="h-10 rounded-xl px-4"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="h-10 rounded-xl px-4"
              >
                {isPending
                  ? "Saving…"
                  : isEdit
                    ? "Save changes"
                    : "Add profile"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
