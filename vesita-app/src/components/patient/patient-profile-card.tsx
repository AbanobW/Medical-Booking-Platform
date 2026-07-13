"use client";

import Link from "next/link";
import {
  Activity,
  Baby,
  CalendarDays,
  Droplet,
  Pencil,
  Phone,
  Trash2,
  UserRound,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useMutation } from "@/hooks/use-async";
import { deletePatientProfile } from "@/lib/api/profiles";
import { ageOf } from "@/lib/eligibility";
import { initialsOf } from "@/lib/format";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { RELATIONSHIP_LABELS, type PatientProfile } from "@/lib/types";

const RELATIONSHIP_TONES: Record<string, string> = {
  self: "bg-primary/10 text-primary",
  child: "bg-info/10 text-info",
  spouse: "bg-success/10 text-success",
  parent: "bg-warning/15 text-warning",
};

export function PatientProfileCard({
  profile,
  bookingCount,
  onEdit,
  onDeleted,
}: {
  profile: PatientProfile;
  bookingCount: number;
  onEdit: (profile: PatientProfile) => void;
  onDeleted: () => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [refusal, setRefusal] = useState<string>();
  const { mutate, isPending } = useMutation(deletePatientProfile);

  const age = ageOf(profile.dateOfBirth);

  async function onDelete() {
    setRefusal(undefined);
    try {
      await mutate(profile.id, profile.accountId);
      toast.success(`${profile.fullName}'s profile was removed.`);
      setConfirmOpen(false);
      onDeleted();
    } catch (error) {
      // The API refuses to remove the "self" profile, or any profile that owns
      // booking history. Show exactly why rather than a generic failure.
      setRefusal(
        error instanceof Error
          ? error.message
          : "This profile couldn't be removed.",
      );
    }
  }

  return (
    <Card className="border-border/60 transition-shadow hover:shadow-card">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start gap-4">
          <Avatar className="size-14 shrink-0 rounded-2xl ring-1 ring-border">
            <AvatarFallback className="rounded-2xl font-semibold">
              {initialsOf(profile.fullName)}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate font-semibold leading-tight">
                {profile.fullName}
              </h3>
              <Badge
                variant="secondary"
                className={RELATIONSHIP_TONES[profile.relationship]}
              >
                {RELATIONSHIP_LABELS[profile.relationship]}
              </Badge>
              {profile.isPregnant && (
                <Badge variant="secondary" className="gap-1 bg-primary/10 text-primary">
                  <Baby />
                  Pregnant
                </Badge>
              )}
            </div>

            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <UserRound className="size-3.5" />
                {profile.gender === "male" ? "Male" : "Female"}
              </span>
              <span className="flex items-center gap-1.5">
                <CalendarDays className="size-3.5" />
                {age} {age === 1 ? "year" : "years"} old
              </span>
              {profile.bloodType && (
                <span className="flex items-center gap-1.5">
                  <Droplet className="size-3.5" />
                  {profile.bloodType}
                </span>
              )}
              {profile.phone && (
                <span className="flex items-center gap-1.5">
                  <Phone className="size-3.5" />
                  {profile.phone}
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Activity className="size-3.5" />
            Chronic conditions
          </p>
          {profile.chronicConditions.length === 0 ? (
            <p className="text-sm text-muted-foreground">None recorded.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {profile.chronicConditions.map((condition) => (
                <Badge
                  key={condition}
                  variant="outline"
                  className="font-normal"
                >
                  {condition}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t pt-4">
          <Button
            render={
              <Link
                href={`/patient/bookings?profile=${profile.id}`}
                aria-label={`View bookings for ${profile.fullName}`}
              />
            }
            variant="outline"
            className="h-10 rounded-xl px-4"
          >
            <CalendarDays className="size-4" />
            {bookingCount} {bookingCount === 1 ? "booking" : "bookings"}
          </Button>

          <Button
            variant="outline"
            onClick={() => onEdit(profile)}
            className="ml-auto h-10 rounded-xl px-4"
          >
            <Pencil className="size-4" />
            Edit
          </Button>

          <Button
            variant="ghost"
            onClick={() => {
              setRefusal(undefined);
              setConfirmOpen(true);
            }}
            className="h-10 rounded-xl px-4 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="size-4" />
            Remove
          </Button>
        </div>
      </CardContent>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10 text-destructive">
              <Trash2 />
            </AlertDialogMedia>
            <AlertDialogTitle>Remove {profile.fullName}?</AlertDialogTitle>
            <AlertDialogDescription>
              This profile will be removed from your account. Booking and medical
              history belongs to the profile, so a profile with bookings on record
              can&apos;t be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {refusal && (
            <p className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-left text-sm text-destructive">
              {refusal}
            </p>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Keep profile</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isPending}
              onClick={onDelete}
            >
              {isPending ? "Removing…" : "Remove profile"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
