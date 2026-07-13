"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarDays, Mail, Save, ShieldCheck } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

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
import { GOVERNORATES } from "@/lib/data/egypt";
import { formatDate, initialsOf } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/types";

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
];

const BLOOD_OPTIONS = BLOOD_TYPES.map((type) => ({ value: type, label: type }));

const GOVERNORATE_OPTIONS = GOVERNORATES.map((governorate) => ({
  value: governorate.id,
  label: governorate.name,
}));

const profileSchema = z.object({
  name: z.string().trim().min(3, "Please enter your full name."),
  phone: z
    .string()
    .trim()
    .regex(/^01[0125]\d{8}$/, "Enter a valid Egyptian mobile number (11 digits)."),
  gender: z.enum(["male", "female"], { message: "Select your gender." }),
  dateOfBirth: z
    .string()
    .min(1, "Select your date of birth.")
    .refine((value) => new Date(value).getTime() < Date.now(), {
      message: "Your date of birth must be in the past.",
    }),
  bloodType: z.string().min(1, "Select your blood type."),
  governorateId: z.string().min(1, "Select your governorate."),
});

type ProfileValues = z.infer<typeof profileSchema>;

export default function PatientProfilePage() {
  const { user, isLoading, updateProfile } = useAuth();

  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    values: user
      ? {
          name: user.name,
          phone: user.phone,
          gender: user.gender ?? "male",
          dateOfBirth: user.dateOfBirth?.slice(0, 10) ?? "",
          bloodType: user.bloodType ?? "",
          governorateId: user.governorateId ?? "",
        }
      : undefined,
  });

  if (isLoading || !user) return <ProfileSkeleton />;

  async function onSubmit(values: ProfileValues) {
    try {
      await updateProfile(values);
      toast.success("Profile updated.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Couldn't save your profile. Please try again.",
      );
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
                {ROLE_LABELS[user.role]}
              </Badge>
            </div>

            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="size-4 shrink-0" />
              {user.email}
            </p>
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarDays className="size-4 shrink-0" />
              Member since {formatDate(user.createdAt)}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Editable details -------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle>Personal details</CardTitle>
          <CardDescription>
            These details pre-fill your booking forms. Your email address can&apos;t be
            changed.
          </CardDescription>
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
                      <FormLabel>Full name</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Your full name"
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
                      <FormLabel>Mobile number</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="tel"
                          inputMode="numeric"
                          placeholder="01XXXXXXXXX"
                          className="h-11 rounded-xl"
                        />
                      </FormControl>
                      <FormDescription>
                        Used for appointment reminders.
                      </FormDescription>
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
                          value={field.value ?? ""}
                          onValueChange={(value) =>
                            field.onChange(value as ProfileValues["gender"])
                          }
                          options={GENDER_OPTIONS}
                          placeholder="Select gender"
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
                          {...field}
                          type="date"
                          className="h-11 rounded-xl"
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
                      <FormLabel>Blood type</FormLabel>
                      <FormControl>
                        <AppSelect
                          value={field.value}
                          onValueChange={field.onChange}
                          options={BLOOD_OPTIONS}
                          placeholder="Select blood type"
                        />
                      </FormControl>
                      <FormDescription>
                        Shared with providers in an emergency.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="governorateId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Governorate</FormLabel>
                      <FormControl>
                        <AppSelect
                          value={field.value}
                          onValueChange={field.onChange}
                          options={GOVERNORATE_OPTIONS}
                          placeholder="Select governorate"
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
                  Reset
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-10 rounded-xl px-4"
                >
                  <Save className="size-4" />
                  {isSubmitting ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
