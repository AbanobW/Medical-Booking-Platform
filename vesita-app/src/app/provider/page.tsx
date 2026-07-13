"use client";

import Link from "next/link";
import {
  CalendarCheck,
  Gauge,
  Hourglass,
  Star,
  TrendingUp,
  UserPlus,
  UserX,
  XCircle,
  Wallet,
} from "lucide-react";

import { useCurrentProvider } from "@/components/provider/use-current-provider";
import {
  BookingStatusBadge,
  LongWaitBadge,
} from "@/components/provider/badges";
import { BookingsChart, RevenueChart } from "@/components/shared/charts";
import { RatingStars } from "@/components/shared/rating";
import { StatisticsCard } from "@/components/shared/statistics-card";
import {
  ChartSkeleton,
  EmptyState,
  ErrorState,
  ListSkeleton,
  StatGridSkeleton,
} from "@/components/shared/states";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAsync } from "@/hooks/use-async";
import { getBookings } from "@/lib/api/bookings";
import { getProviderStats } from "@/lib/api/stats";
import { todayISO } from "@/lib/data/seed";
import { formatDate, formatDuration, formatTime, initialsOf } from "@/lib/format";
import { formatEGP, formatNumber } from "@/lib/site";
import { isCancelled, schedulingModeFor } from "@/lib/types";

export default function ProviderDashboardPage() {
  const { providerId, provider } = useCurrentProvider();

  const stats = useAsync(
    () => getProviderStats(providerId),
    [providerId],
  );

  const today = useAsync(
    () => getBookings({ providerId, page: 1, pageSize: 200 }),
    [providerId],
  );

  const isDoctor = provider ? schedulingModeFor(provider.type) === "session" : false;

  // Cancelled bookings are not "on today" — the four cancellation/refund states
  // all collapse to the same thing here (§7).
  const todaysAppointments = (today.data?.items ?? [])
    .filter((b) => b.date === todayISO() && !isCancelled(b.status))
    .sort((a, b) =>
      isDoctor
        ? (a.queueNumber ?? 0) - (b.queueNumber ?? 0)
        : a.time.localeCompare(b.time),
    );

  return (
    <div className="space-y-6">
      {/* ---------------------------------------------------------------- stats */}
      {stats.isLoading && !stats.data ? (
        <StatGridSkeleton />
      ) : stats.error ? (
        <ErrorState
          title="Couldn't load your statistics"
          description={stats.error.message}
          onRetry={stats.refetch}
        />
      ) : stats.data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatisticsCard
            label="Total Bookings"
            value={formatNumber(stats.data.totalBookings)}
            change={stats.data.bookingsChange}
            icon={CalendarCheck}
            tone="primary"
          />
          <StatisticsCard
            label="Revenue"
            value={formatEGP(stats.data.revenue)}
            change={stats.data.revenueChange}
            icon={Wallet}
            tone="success"
          />
          <StatisticsCard
            label="New Patients"
            value={formatNumber(stats.data.newPatients)}
            change={stats.data.newPatientsChange}
            icon={UserPlus}
            tone="info"
          />
          <StatisticsCard
            label="Cancellations"
            value={formatNumber(stats.data.cancellations)}
            change={stats.data.cancellationsChange}
            invertChange
            icon={XCircle}
            tone="destructive"
          />
        </div>
      ) : null}

      {/* --------------------------------------------- performance (§15) */}
      {stats.isLoading && !stats.data ? (
        <StatGridSkeleton />
      ) : stats.data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatisticsCard
            label="Utilization"
            value={`${stats.data.utilizationRate}%`}
            change={stats.data.utilizationChange}
            icon={Gauge}
            tone="primary"
            hint={
              isDoctor
                ? "How full your sessions run"
                : "How full your slots run"
            }
          />
          <StatisticsCard
            label="Average wait"
            value={formatDuration(stats.data.averageWaitMinutes)}
            icon={Hourglass}
            tone="warning"
            hint="From what patients report in reviews"
          />
          <StatisticsCard
            label="Cancellation rate"
            value={`${stats.data.cancellationRate}%`}
            icon={XCircle}
            tone="destructive"
            hint="Share of your bookings cancelled"
          />
          <StatisticsCard
            label="Missed visits"
            value={`${stats.data.noShowRate}%`}
            icon={UserX}
            tone="info"
            hint="Patients who never arrived"
          />
        </div>
      ) : null}

      {/* --------------------------------------------------------------- charts */}
      {stats.isLoading && !stats.data ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
      ) : stats.data ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <BookingsChart
            data={stats.data.monthly}
            title="Bookings"
            description="Monthly bookings against cancellations, last 12 months"
          />
          <RevenueChart data={stats.data.monthly} />
        </div>
      ) : null}

      {/* ------------------------------------------------- today + avg rating */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <CardTitle className="text-base">Today&apos;s appointments</CardTitle>
              <CardDescription>{formatDate(todayISO())}</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              render={<Link href="/provider/bookings" />}
            >
              All bookings
            </Button>
          </CardHeader>
          <CardContent>
            {today.isLoading && !today.data ? (
              <ListSkeleton count={3} />
            ) : today.error ? (
              <ErrorState
                title="Couldn't load today's appointments"
                description={today.error.message}
                onRetry={today.refetch}
              />
            ) : todaysAppointments.length === 0 ? (
              <EmptyState
                icon={CalendarCheck}
                title="Nothing on today"
                description="You have no appointments scheduled for today."
              />
            ) : (
              <ul className="space-y-3">
                {todaysAppointments.map((booking) => (
                  <li
                    key={booking.id}
                    className="flex flex-wrap items-center gap-4 rounded-2xl border bg-card p-4"
                  >
                    <Avatar className="size-10 shrink-0">
                      <AvatarFallback>
                        {initialsOf(booking.patientInfo.fullName)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {booking.patientInfo.fullName}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">
                        {booking.serviceName}
                      </p>
                      {booking.longWaitReported && (
                        <LongWaitBadge className="mt-1" />
                      )}
                    </div>

                    <span className="text-sm font-semibold tabular-nums">
                      {booking.queueNumber !== undefined
                        ? `#${booking.queueNumber} · ~${formatTime(booking.estimatedTime ?? booking.time)}`
                        : formatTime(booking.time)}
                    </span>
                    <BookingStatusBadge status={booking.status} />
                    <span className="text-sm font-semibold tabular-nums">
                      {formatEGP(booking.total)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Average rating</CardTitle>
            <CardDescription>Across every review you&apos;ve received</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-3 py-6">
            {stats.isLoading && !stats.data ? (
              <ListSkeleton count={1} />
            ) : stats.data ? (
              <>
                <span className="text-5xl font-bold tabular-nums">
                  {stats.data.averageRating.toFixed(1)}
                </span>
                <RatingStars value={stats.data.averageRating} size="lg" />
                <div className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <TrendingUp className="size-4" />
                  <span>{formatNumber(stats.data.totalBookings)} visits served</span>
                </div>
                <Button
                  variant="outline"
                  className="mt-2 h-10 rounded-xl px-4"
                  render={<Link href="/provider/reviews" />}
                >
                  <Star className="size-4" />
                  Read reviews
                </Button>
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
