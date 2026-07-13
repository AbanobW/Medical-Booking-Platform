"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Loader2, Plus, UserPlus, X } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AppSelect } from "@/components/ui/app-select";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { ErrorState } from "@/components/shared/states";
import { createPatientProfile } from "@/lib/api/profiles";
import { CHRONIC_CONDITIONS } from "@/lib/data/clinical";
import { TODAY, toISODate } from "@/lib/data/seed";
import { ageOf } from "@/lib/eligibility";
import {
  RELATIONSHIP_LABELS,
  type Gender,
  type PatientProfile,
  type Relationship,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const TODAY_ISO = toISODate(TODAY);
const EG_PHONE = /^01[0125][0-9]{8}$/;

/** "self" is created with the account — a family member is one of the other three. */
const FAMILY_RELATIONSHIPS: Relationship[] = ["child", "spouse", "parent"];

const schema = z.object({
  relationship: z.enum(["child", "spouse", "parent"], "Choose a relationship."),
  fullName: z.string().min(3, "Please enter their full name."),
  gender: z.enum(["male", "female"], "Please select a gender."),
  dateOfBirth: z
    .string()
    .min(1, "Please enter a date of birth.")
    .refine((value) => value <= TODAY_ISO, {
      message: "Date of birth can't be in the future.",
    }),
  phone: z
    .string()
    .refine((value) => value === "" || EG_PHONE.test(value), {
      message: "Enter a valid Egyptian mobile number, e.g. 01012345678.",
    }),
  isPregnant: z.boolean(),
  chronicConditions: z.array(z.string()),
});

type ProfileFormValues = z.infer<typeof schema>;

/**
 * Step 1 — who is this booking for? (§1)
 *
 * A booking belongs to a patient profile, never to the account: medical and
 * booking history attach to the person seen, whoever did the booking.
 */
export function ProfilePicker({
  accountId,
  profiles,
  isLoading,
  error,
  onRetry,
  selectedId,
  onSelect,
  onCreated,
}: {
  accountId: string;
  profiles: PatientProfile[] | undefined;
  isLoading: boolean;
  error?: Error;
  onRetry: () => void;
  selectedId?: string;
  onSelect: (id: string) => void;
  onCreated: (profile: PatientProfile) => void;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      relationship: "child",
      fullName: "",
      gender: "male",
      dateOfBirth: "",
      phone: "",
      isPregnant: false,
      chronicConditions: [],
    },
  });

  const gender = form.watch("gender");

  async function save(values: ProfileFormValues) {
    setIsSaving(true);
    try {
      const profile = await createPatientProfile(accountId, {
        relationship: values.relationship,
        fullName: values.fullName.trim(),
        gender: values.gender,
        dateOfBirth: values.dateOfBirth,
        phone: values.phone.trim() || undefined,
        chronicConditions: values.chronicConditions,
        isPregnant: values.gender === "female" && values.isPregnant,
      });

      onCreated(profile);
      form.reset();
      setIsAdding(false);
      toast.success(`${profile.fullName} was added to your account.`);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "We couldn't add that family member. Please try again.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Who is this booking for?</h2>
        <p className="text-sm text-muted-foreground">
          The visit, and the medical history that comes from it, belongs to this
          person — not to the account.
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 2 }, (_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <ErrorState description={error.message} onRetry={onRetry} />
      ) : (
        <>
          {profiles && profiles.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {profiles.map((profile) => (
                <ProfileCard
                  key={profile.id}
                  profile={profile}
                  isSelected={profile.id === selectedId}
                  onSelect={() => onSelect(profile.id)}
                />
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed bg-card/50 px-6 py-8 text-center text-sm text-muted-foreground">
              This account has no patient profiles yet. Add the person this
              booking is for below.
            </p>
          )}

          {isAdding ? (
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(save)}
                className="space-y-5 rounded-2xl border bg-card p-5 shadow-soft"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">Add a family member</h3>
                    <p className="text-sm text-muted-foreground">
                      They stay private to your account and are never linked to
                      anyone else&apos;s.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setIsAdding(false)}
                    aria-label="Cancel adding a family member"
                  >
                    <X className="size-4" />
                  </Button>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="relationship"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Relationship</FormLabel>
                        <FormControl>
                          <AppSelect
                            value={field.value}
                            onValueChange={(value) => field.onChange(value)}
                            options={FAMILY_RELATIONSHIPS.map((r) => ({
                              value: r,
                              label: RELATIONSHIP_LABELS[r],
                            }))}
                            aria-label="Relationship"
                          />
                        </FormControl>
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
                            placeholder="Mariam Hassan"
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
                    name="gender"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Gender</FormLabel>
                        <FormControl>
                          <AppSelect
                            value={field.value}
                            onValueChange={(value) => {
                              field.onChange(value as Gender);
                              if (value === "male") {
                                form.setValue("isPregnant", false);
                              }
                            }}
                            options={[
                              { value: "male", label: "Male" },
                              { value: "female", label: "Female" },
                            ]}
                            aria-label="Gender"
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
                        <FormLabel>Date of birth</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            max={TODAY_ISO}
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
                        <FormLabel>Mobile number (optional)</FormLabel>
                        <FormControl>
                          <Input
                            type="tel"
                            inputMode="numeric"
                            placeholder="01012345678"
                            className="h-11 rounded-xl"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {gender === "female" && (
                    <FormField
                      control={form.control}
                      name="isPregnant"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Currently pregnant</FormLabel>
                          <div className="flex h-11 items-center gap-3 rounded-xl border px-4">
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={(checked: boolean) =>
                                  field.onChange(checked)
                                }
                              />
                            </FormControl>
                            <span className="text-sm text-muted-foreground">
                              {field.value ? "Yes" : "No"}
                            </span>
                          </div>
                          <FormDescription>
                            Some scans are not performed during pregnancy.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>

                <FormField
                  control={form.control}
                  name="chronicConditions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Chronic conditions</FormLabel>
                      <FormDescription>
                        We screen these against a test or scan&apos;s eligibility
                        rules before the booking is taken.
                      </FormDescription>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {CHRONIC_CONDITIONS.map((condition) => {
                          const checked = field.value.includes(condition);
                          const id = `condition-${condition.replace(/\s+/g, "-")}`;

                          return (
                            <div
                              key={condition}
                              className="flex items-center gap-3 rounded-xl border bg-background px-3 py-2.5"
                            >
                              <Checkbox
                                id={id}
                                checked={checked}
                                onCheckedChange={(next: boolean) =>
                                  field.onChange(
                                    next
                                      ? [...field.value, condition]
                                      : field.value.filter(
                                          (c: string) => c !== condition,
                                        ),
                                  )
                                }
                              />
                              <Label
                                htmlFor={id}
                                className="cursor-pointer text-sm font-normal"
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

                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-11 rounded-xl px-4"
                    onClick={() => setIsAdding(false)}
                    disabled={isSaving}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="h-11 rounded-xl px-5"
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <UserPlus className="size-4" />
                    )}
                    Save family member
                  </Button>
                </div>
              </form>
            </Form>
          ) : (
            <button
              type="button"
              onClick={() => setIsAdding(true)}
              className="flex w-full items-center gap-3 rounded-2xl border border-dashed bg-card/50 p-4 text-left transition-all hover:border-primary hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <Plus className="size-5" />
              </span>
              <span>
                <span className="block font-medium">Add a family member</span>
                <span className="block text-sm text-muted-foreground">
                  Book for a child, spouse or parent under your own account.
                </span>
              </span>
            </button>
          )}
        </>
      )}
    </div>
  );
}

function ProfileCard({
  profile,
  isSelected,
  onSelect,
}: {
  profile: PatientProfile;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const age = ageOf(profile.dateOfBirth);

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isSelected}
      className={cn(
        "flex w-full flex-col gap-2 rounded-2xl border p-4 text-left transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        isSelected
          ? "border-primary bg-primary/5 shadow-glow"
          : "border-border bg-card hover:border-primary/50 hover:shadow-soft",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-semibold">
            <span className="truncate">{profile.fullName}</span>
            {isSelected && (
              <Check className="size-4 shrink-0 text-primary" aria-hidden />
            )}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {age} years old · {profile.gender === "male" ? "Male" : "Female"}
          </p>
        </div>

        <Badge variant={isSelected ? "default" : "secondary"} className="shrink-0">
          {RELATIONSHIP_LABELS[profile.relationship]}
        </Badge>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {profile.isPregnant && (
          <Badge variant="outline" className="text-[0.7rem] font-normal">
            Pregnant
          </Badge>
        )}
        {profile.chronicConditions.length > 0 ? (
          profile.chronicConditions.map((condition) => (
            <Badge
              key={condition}
              variant="outline"
              className="text-[0.7rem] font-normal"
            >
              {condition}
            </Badge>
          ))
        ) : (
          <span className="text-xs text-muted-foreground">
            No chronic conditions recorded
          </span>
        )}
      </div>
    </button>
  );
}
