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
import { useMemo } from "react";

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
import { formatEGP } from "@/lib/site";
import { RELATIONSHIP_LABELS, type PatientProfile, type Provider } from "@/lib/types";

export default function PatientDashboardPage() {
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

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Welcome back{user ? `, ${user.name.split(" ")[0]}` : ""}
          </h2>
          <p className="text-sm text-muted-foreground">
            Here&apos;s what&apos;s happening with your care.
          </p>
        </div>

        <Button
          render={<Link href="/search" />}
          className="h-10 rounded-xl px-4"
        >
          <CalendarPlus className="size-4" />
          Book an appointment
        </Button>
      </div>

      {/* Stats ------------------------------------------------------------ */}
      <section className="space-y-4">
        {stats.isLoading ? (
          <StatGridSkeleton count={4} />
        ) : stats.error ? (
          <ErrorState
            title="Couldn't load your stats"
            description={stats.error.message}
            onRetry={stats.refetch}
          />
        ) : stats.data ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatisticsCard
                label="Upcoming"
                value={stats.data.upcomingCount}
                icon={CalendarClock}
                tone="info"
                hint="Appointments ahead"
              />
              <StatisticsCard
                label="Completed"
                value={stats.data.completedCount}
                icon={CalendarCheck}
                tone="success"
                hint="Visits so far"
              />
              <StatisticsCard
                label="Cancelled"
                value={stats.data.cancelledCount}
                icon={CalendarX}
                tone="destructive"
                hint="Cancelled bookings"
              />
              <StatisticsCard
                label="Total spent"
                value={formatEGP(stats.data.totalSpent)}
                icon={Wallet}
                tone="primary"
                hint="Across completed visits"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <StatisticsCard
                label="Cashback earned"
                value={formatEGP(stats.data.cashbackEarned)}
                icon={Coins}
                tone="warning"
                hint="Credited to your wallet"
              />
              <StatisticsCard
                label="Favorites"
                value={stats.data.favoriteCount}
                icon={Heart}
                tone="destructive"
                hint="Saved providers"
              />
              <StatisticsCard
                label="Reviews written"
                value={stats.data.reviewCount}
                icon={Star}
                tone="warning"
                hint="Thanks for the feedback"
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
              <h3 className="font-semibold">Patient profiles</h3>

              {profiles.isLoading ? (
                <Skeleton className="mt-2 h-4 w-56" />
              ) : profiles.error ? (
                <p className="mt-1 text-sm text-destructive">
                  {profiles.error.message}
                </p>
              ) : (profiles.data ?? []).length === 0 ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  Add yourself and the family you book for — history is kept per
                  person.
                </p>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {profiles.data!.length}
                  </span>{" "}
                  {profiles.data!.length === 1 ? "profile" : "profiles"} —{" "}
                  {profiles
                    .data!.slice(0, 3)
                    .map(
                      (p) =>
                        `${p.fullName.split(" ")[0]} (${RELATIONSHIP_LABELS[p.relationship]})`,
                    )
                    .join(", ")}
                  {profiles.data!.length > 3
                    ? ` +${profiles.data!.length - 3} more`
                    : ""}
                </p>
              )}
            </div>
          </div>

          <Button
            render={<Link href="/patient/profiles" />}
            variant="outline"
            className="h-10 rounded-xl px-4"
          >
            Manage profiles
          </Button>
        </div>
      </section>

      {/* Upcoming --------------------------------------------------------- */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">Upcoming appointments</h3>
          <Button
            render={<Link href="/patient/bookings" />}
            variant="ghost"
            size="sm"
          >
            View all
          </Button>
        </div>

        {upcoming.isLoading ? (
          <ListSkeleton count={2} />
        ) : upcoming.error ? (
          <ErrorState
            title="Couldn't load your appointments"
            description={upcoming.error.message}
            onRetry={upcoming.refetch}
          />
        ) : !upcoming.data || upcoming.data.items.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title="No upcoming appointments"
            description="When you book a doctor, lab or scan, it will show up here."
            action={
              <Button
                render={<Link href="/search" />}
                className="h-10 rounded-xl px-4"
              >
                Find a provider
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
        <h3 className="text-lg font-semibold">Recently completed</h3>

        {completed.isLoading ? (
          <ListSkeleton count={2} />
        ) : completed.error ? (
          <ErrorState
            title="Couldn't load your visit history"
            description={completed.error.message}
            onRetry={completed.refetch}
          />
        ) : !completed.data || completed.data.items.length === 0 ? (
          <EmptyState
            icon={CalendarCheck}
            title="No completed visits yet"
            description="Your visit history will appear here after your first appointment."
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
        <h3 className="text-lg font-semibold">Book again</h3>

        {bookAgain.isLoading ? (
          <ProviderListSkeleton count={3} />
        ) : bookAgain.error ? (
          <ErrorState
            title="Couldn't load your providers"
            description={bookAgain.error.message}
            onRetry={bookAgain.refetch}
          />
        ) : !bookAgain.data || bookAgain.data.length === 0 ? (
          <EmptyState
            icon={CalendarPlus}
            title="Nothing to rebook yet"
            description="Providers you've visited before will appear here for a one-tap rebooking."
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
