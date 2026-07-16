"use client";

import { ShieldCheck, UserPlus, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState, type ReactNode } from "react";

import { PatientProfileCard } from "@/components/patient/patient-profile-card";
import { PatientProfileDialog } from "@/components/patient/patient-profile-dialog";
import { useAuth } from "@/components/providers/auth-provider";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { useAsync } from "@/hooks/use-async";
import { getBookings } from "@/lib/api/bookings";
import { getPatientProfiles } from "@/lib/api/profiles";
import { useApiError } from "@/lib/i18n/use-api-error";
import type { PatientProfile } from "@/lib/types";

/** Everything the account has ever booked — enough to count per profile. */
const ALL_BOOKINGS = 500;

export default function PatientProfilesPage() {
  const t = useTranslations("patient");
  const describeError = useApiError();

  const { user } = useAuth();
  const accountId = user?.id ?? "";

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PatientProfile>();

  const profiles = useAsync(
    () => getPatientProfiles(accountId),
    [accountId],
  );

  const bookings = useAsync(
    () => getBookings({ patientId: accountId, pageSize: ALL_BOOKINGS }),
    [accountId],
  );

  // Booking history attaches to the profile (§1), so the count is per profile.
  const countsByProfile = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const booking of bookings.data?.items ?? []) {
      counts[booking.patientProfileId] =
        (counts[booking.patientProfileId] ?? 0) + 1;
    }
    return counts;
  }, [bookings.data]);

  const hasSelf = (profiles.data ?? []).some((p) => p.relationship === "self");

  function refetchAll() {
    profiles.refetch();
    bookings.refetch();
  }

  function openAdd() {
    setEditing(undefined);
    setDialogOpen(true);
  }

  function openEdit(profile: PatientProfile) {
    setEditing(profile);
    setDialogOpen(true);
  }

  const strong = (chunks: ReactNode) => (
    <span className="font-medium text-foreground">{chunks}</span>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            {t("profiles.title")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("profiles.subtitle")}
          </p>
        </div>

        <Button onClick={openAdd} className="h-10 rounded-xl px-4">
          <UserPlus className="size-4" />
          {t("profiles.add")}
        </Button>
      </div>

      <div className="flex items-start gap-3 rounded-2xl border bg-muted/40 p-4 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
        <p>{t.rich("profiles.notice", { b: strong })}</p>
      </div>

      {profiles.isLoading ? (
        <ListSkeleton count={3} />
      ) : profiles.error ? (
        <ErrorState
          title={t("profiles.error")}
          description={describeError(profiles.error)}
          onRetry={profiles.refetch}
        />
      ) : (profiles.data ?? []).length === 0 ? (
        <EmptyState
          icon={Users}
          title={t("profiles.emptyTitle")}
          description={t("profiles.emptyDescription")}
          action={
            <Button onClick={openAdd} className="h-10 rounded-xl px-4">
              <UserPlus className="size-4" />
              {t("profiles.add")}
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {profiles.data!.map((profile) => (
            <PatientProfileCard
              key={profile.id}
              profile={profile}
              bookingCount={countsByProfile[profile.id] ?? 0}
              onEdit={openEdit}
              onDeleted={refetchAll}
            />
          ))}
        </div>
      )}

      {accountId && (
        <PatientProfileDialog
          // Remount on switching between add / edit so the form resets cleanly.
          key={editing?.id ?? "new"}
          accountId={accountId}
          profile={editing}
          hasSelf={hasSelf}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSaved={refetchAll}
        />
      )}
    </div>
  );
}
