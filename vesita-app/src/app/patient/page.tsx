"use client";

import Link from "next/link";
import {
  CalendarCheck,
  CalendarClock,
  CalendarPlus,
  CalendarX,
  Coins,
  Heart,
  Star,
  Users,
  Wallet,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, type ReactNode } from "react";

import { BookingCard } from "@/components/patient/booking-card";
import { useAuth } from "@/components/providers/auth-provider";
import { ProviderCardCompact } from "@/components/shared/provider-card";
import { StatisticsCard } from "@/components/shared/statistics-card";
import {
  EmptyState,
  ErrorState,
  ListSkeleton,
  ProviderListSkeleton,
  StatGridSkeleton,
} from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAsync } from "@/hooks/use-async";
import { getBookings } from "@/lib/api/bookings";
import { getPatientProfiles } from "@/lib/api/profiles";
import { getProviderById } from "@/lib/api/providers";
import { getPatientStats } from "@/lib/api/stats";
import { useApiError } from "@/lib/i18n/use-api-error";
import { useFormat } from "@/lib/i18n/use-format";
import { useLabels } from "@/lib/i18n/use-labels";
import type { PatientProfile, Provider } from "@/lib/types";

export default function PatientDashboardPage() {
  const t = useTranslations("patient");
  const L = useLabels();
  const { formatEGP, formatNumber, locale } = useFormat();
  const describeError = useApiError();

  const { user } = useAuth();
  const patientId = user?.id ?? "";

  const stats = useAsync(
    () => getPatientStats(patientId),
    [patientId],
  );

  const upcoming = useAsync(
    () => getBookings({ patientId, when: "upcoming", pageSize: 5 }),
    [patientId],
  );

  const completed = useAsync(
    () => getBookings({ patientId, status: "completed", pageSize: 3 }),
    [patientId],
  );

  // Bookings belong to a patient profile (§1), so the cards need to name them.
  const profiles = useAsync(
    () => getPatientProfiles(patientId),
    [patientId],
  );

  const profilesById = useMemo(() => {
    const map: Record<string, PatientProfile> = {};
    for (const profile of profiles.data ?? []) map[profile.id] = profile;
    return map;
  }, [profiles.data]);

  // "Book again" — the providers behind the most recent completed visits.
  const bookAgain = useAsync(async (): Promise<Provider[]> => {
    const past = await getBookings({
      patientId,
      status: "completed",
      pageSize: 20,
    });

    const ids = Array.from(new Set(past.items.map((b) => b.providerId))).slice(0, 4);
    const providers = await Promise.all(
      ids.map((id) => getProviderById(id).catch(() => null)),
    );

    return providers.filter((p): p is Provider => p !== null);
  }, [patientId]);

  function refetchAll() {
    stats.refetch();
    upcoming.refetch();
    completed.refetch();
    bookAgain.refetch();
    profiles.refetch();
  }

  const strong = (chunks: ReactNode) => (
    <span className="font-medium text-foreground">{chunks}</span>
  );

  const profileList = profiles.data ?? [];
  // Arabic separates a list with the Arabic comma, not the Latin one.
  const separator = locale === "ar" ? "، " : ", ";
  const profileNames =
    profileList
      .slice(0, 3)
      .map((p) =>
        t("dashboard.profiles.entry", {
          name: p.fullName.split(" ")[0],
          relationship: L.relationship(p.relationship),
        }),
      )
      .join(separator) +
    (profileList.length > 3
      ? t("dashboard.profiles.more", { count: profileList.length - 3 })
      : "");

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            {user
              ? t("dashboard.welcome", { name: user.name.split(" ")[0] })
              : t("dashboard.welcomeAnonymous")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("dashboard.subtitle")}
          </p>
        </div>

        <Button
          render={<Link href="/search" />}
          className="h-10 rounded-xl px-4"
        >
          <CalendarPlus className="size-4" />
          {t("dashboard.book")}
        </Button>
      </div>

      {/* Stats ------------------------------------------------------------ */}
      <section className="space-y-4">
        {stats.isLoading ? (
          <StatGridSkeleton count={4} />
        ) : stats.error ? (
          <ErrorState
            title={t("dashboard.stats.error")}
            description={describeError(stats.error)}
            onRetry={stats.refetch}
          />
        ) : stats.data ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatisticsCard
                label={t("dashboard.stats.upcoming")}
                value={formatNumber(stats.data.upcomingCount)}
                icon={CalendarClock}
                tone="info"
                hint={t("dashboard.stats.upcomingHint")}
              />
              <StatisticsCard
                label={t("dashboard.stats.completed")}
                value={formatNumber(stats.data.completedCount)}
                icon={CalendarCheck}
                tone="success"
                hint={t("dashboard.stats.completedHint")}
              />
              <StatisticsCard
                label={t("dashboard.stats.cancelled")}
                value={formatNumber(stats.data.cancelledCount)}
                icon={CalendarX}
                tone="destructive"
                hint={t("dashboard.stats.cancelledHint")}
              />
              <StatisticsCard
                label={t("dashboard.stats.totalSpent")}
                value={formatEGP(stats.data.totalSpent)}
                icon={Wallet}
                tone="primary"
                hint={t("dashboard.stats.totalSpentHint")}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <StatisticsCard
                label={t("dashboard.stats.cashback")}
                value={formatEGP(stats.data.cashbackEarned)}
                icon={Coins}
                tone="warning"
                hint={t("dashboard.stats.cashbackHint")}
              />
              <StatisticsCard
                label={t("dashboard.stats.favorites")}
                value={formatNumber(stats.data.favoriteCount)}
                icon={Heart}
                tone="destructive"
                hint={t("dashboard.stats.favoritesHint")}
              />
              <StatisticsCard
                label={t("dashboard.stats.reviews")}
                value={formatNumber(stats.data.reviewCount)}
                icon={Star}
                tone="warning"
                hint={t("dashboard.stats.reviewsHint")}
              />
            </div>
          </>
        ) : null}
      </section>

      {/* Patient profiles -------------------------------------------------- */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-card p-5 shadow-soft">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Users className="size-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold">{t("dashboard.profiles.title")}</h3>

              {profiles.isLoading ? (
                <Skeleton className="mt-2 h-4 w-56" />
              ) : profiles.error ? (
                <p className="mt-1 text-sm text-destructive">
                  {describeError(profiles.error)}
                </p>
              ) : profileList.length === 0 ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("dashboard.profiles.empty")}
                </p>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">
                  {t.rich("dashboard.profiles.summary", {
                    count: profileList.length,
                    names: profileNames,
                    b: strong,
                  })}
                </p>
              )}
            </div>
          </div>

          <Button
            render={<Link href="/patient/profiles" />}
            variant="outline"
            className="h-10 rounded-xl px-4"
          >
            {t("dashboard.profiles.manage")}
          </Button>
        </div>
      </section>

      {/* Upcoming --------------------------------------------------------- */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">
            {t("dashboard.upcoming.title")}
          </h3>
          <Button
            render={<Link href="/patient/bookings" />}
            variant="ghost"
            size="sm"
          >
            {t("dashboard.upcoming.viewAll")}
          </Button>
        </div>

        {upcoming.isLoading ? (
          <ListSkeleton count={2} />
        ) : upcoming.error ? (
          <ErrorState
            title={t("dashboard.upcoming.error")}
            description={describeError(upcoming.error)}
            onRetry={upcoming.refetch}
          />
        ) : !upcoming.data || upcoming.data.items.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title={t("dashboard.upcoming.emptyTitle")}
            description={t("dashboard.upcoming.emptyDescription")}
            action={
              <Button
                render={<Link href="/search" />}
                className="h-10 rounded-xl px-4"
              >
                {t("dashboard.upcoming.find")}
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {upcoming.data.items.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                profile={profilesById[booking.patientProfileId]}
                onChanged={refetchAll}
              />
            ))}
          </div>
        )}
      </section>

      {/* Recently completed ----------------------------------------------- */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold">
          {t("dashboard.completed.title")}
        </h3>

        {completed.isLoading ? (
          <ListSkeleton count={2} />
        ) : completed.error ? (
          <ErrorState
            title={t("dashboard.completed.error")}
            description={describeError(completed.error)}
            onRetry={completed.refetch}
          />
        ) : !completed.data || completed.data.items.length === 0 ? (
          <EmptyState
            icon={CalendarCheck}
            title={t("dashboard.completed.emptyTitle")}
            description={t("dashboard.completed.emptyDescription")}
          />
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {completed.data.items.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                profile={profilesById[booking.patientProfileId]}
                onChanged={refetchAll}
              />
            ))}
          </div>
        )}
      </section>

      {/* Book again ------------------------------------------------------- */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold">
          {t("dashboard.bookAgain.title")}
        </h3>

        {bookAgain.isLoading ? (
          <ProviderListSkeleton count={3} />
        ) : bookAgain.error ? (
          <ErrorState
            title={t("dashboard.bookAgain.error")}
            description={describeError(bookAgain.error)}
            onRetry={bookAgain.refetch}
          />
        ) : !bookAgain.data || bookAgain.data.length === 0 ? (
          <EmptyState
            icon={CalendarPlus}
            title={t("dashboard.bookAgain.emptyTitle")}
            description={t("dashboard.bookAgain.emptyDescription")}
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {bookAgain.data.map((provider) => (
              <ProviderCardCompact key={provider.id} provider={provider} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
