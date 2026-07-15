"use client";

import Link from "next/link";
import {
  Activity,
  Baby,
  CalendarDays,
  Droplet,
  Pencil,
  Phone,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react";
import { useTranslations } from "next-intl";
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
import { useApiError } from "@/lib/i18n/use-api-error";
import { useDomain, useFormat } from "@/lib/i18n/use-format";
import { useLabels } from "@/lib/i18n/use-labels";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { INSURANCE_ENABLED, type PatientProfile } from "@/lib/types";

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
  const t = useTranslations("patient");
  const L = useLabels();
  const { initialsOf } = useFormat();
  const { getInsurancePlanName } = useDomain();
  const describeError = useApiError();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [refusal, setRefusal] = useState<string>();
  const { mutate, isPending } = useMutation(deletePatientProfile);

  // A freshly auto-created SELF profile may not have a date of birth yet.
  const age = profile.dateOfBirth ? ageOf(profile.dateOfBirth) : null;

  async function onDelete() {
    setRefusal(undefined);
    try {
      await mutate(profile.id, profile.accountId);
      toast.success(t("profileCard.removed", { name: profile.fullName }));
      setConfirmOpen(false);
      onDeleted();
    } catch (error) {
      // The API refuses to remove the "self" profile, or any profile that owns
      // booking history. Show exactly why rather than a generic failure.
      setRefusal(describeError(error));
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
                {L.relationship(profile.relationship)}
              </Badge>
              {profile.isPregnant && (
                <Badge variant="secondary" className="gap-1 bg-primary/10 text-primary">
                  <Baby />
                  {t("profileCard.pregnant")}
                </Badge>
              )}
            </div>

            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <UserRound className="size-3.5" />
                {L.gender(profile.gender)}
              </span>
              {age !== null && (
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="size-3.5" />
                  {t("profileCard.age", { count: age })}
                </span>
              )}
              {profile.bloodType && (
                <span className="flex items-center gap-1.5">
                  <Droplet className="size-3.5" />
                  <span className="ltr-nums">{profile.bloodType}</span>
                </span>
              )}
              {profile.phone && (
                <span className="flex items-center gap-1.5">
                  <Phone className="size-3.5" />
                  <span className="ltr-nums">{profile.phone}</span>
                </span>
              )}
              {/* Insurance stays behind its master switch (§14). */}
              {INSURANCE_ENABLED && profile.insurance && (
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="size-3.5" />
                  {t("profileCard.insurance", {
                    plan: getInsurancePlanName(profile.insurance.planId),
                  })}
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Activity className="size-3.5" />
            {t("profileCard.conditions")}
          </p>
          {profile.chronicConditions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("profileCard.noConditions")}
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {/* Stored in English — the string *is* the identifier (§3). */}
              {profile.chronicConditions.map((condition) => (
                <Badge
                  key={condition}
                  variant="outline"
                  className="font-normal"
                >
                  {L.condition(condition)}
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
                aria-label={t("profileCard.viewBookings", {
                  name: profile.fullName,
                })}
              />
            }
            variant="outline"
            className="h-10 rounded-xl px-4"
          >
            <CalendarDays className="size-4" />
            {t("profileCard.bookings", { count: bookingCount })}
          </Button>

          <Button
            variant="outline"
            onClick={() => onEdit(profile)}
            className="ms-auto h-10 rounded-xl px-4"
          >
            <Pencil className="size-4" />
            {t("profileCard.edit")}
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
            {t("profileCard.remove")}
          </Button>
        </div>
      </CardContent>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10 text-destructive">
              <Trash2 />
            </AlertDialogMedia>
            <AlertDialogTitle>
              {t("profileCard.removeTitle", { name: profile.fullName })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("profileCard.removeDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {refusal && (
            <p className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-start text-sm text-destructive">
              {refusal}
            </p>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>
              {t("profileCard.keep")}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isPending}
              onClick={onDelete}
            >
              {isPending
                ? t("profileCard.removing")
                : t("profileCard.confirmRemove")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
