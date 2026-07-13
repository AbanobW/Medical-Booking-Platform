"use client";

import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck,
  CalendarX,
  Stethoscope,
  Target,
  UserX,
  Users,
  Wallet,
} from "lucide-react";

import { CategoryBarChart, TrendChart } from "@/components/shared/charts";
import { Reveal } from "@/components/shared/motion";
import {
  ChartSkeleton,
  EmptyState,
  ErrorState,
  StatGridSkeleton,
} from "@/components/shared/states";
import { StatisticsCard } from "@/components/shared/statistics-card";
import { Button } from "@/components/ui/button";
import { useAsync } from "@/hooks/use-async";
import { getAdminStats } from "@/lib/api/stats";
import { formatEGP, formatEGPCompact, formatNumber } from "@/lib/site";

export default function AdminDashboardPage() {
  const { data: stats, error, isLoading, refetch } = useAsync(() => getAdminStats());

  if (isLoading) {
    return (
      <div className="space-y-6">
        <StatGridSkeleton />
        <ChartSkeleton />
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Couldn't load the dashboard"
        description={error.message}
        onRetry={refetch}
      />
    );
  }

  if (!stats) {
    return (
      <EmptyState
        title="No platform data yet"
        description="Statistics will appear here once the platform has users and bookings."
      />
    );
  }

  const hasTrends = stats.bookingTrends.some((point) => point.bookings > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            Platform overview
          </h2>
          <p className="text-sm text-muted-foreground">
            Everything happening across Vesita, at a glance.
          </p>
        </div>

        <Button
          variant="outline"
          className="h-10 rounded-xl px-4"
          render={<Link href="/admin/analytics" />}
        >
          View full analytics
          <ArrowRight className="size-4" />
        </Button>
      </div>

      <Reveal>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatisticsCard
            label="Patients"
            value={formatNumber(stats.totalUsers)}
            change={stats.usersChange}
            icon={Users}
            tone="primary"
            hint="new sign-ups vs last month"
          />
          <StatisticsCard
            label="Providers"
            value={formatNumber(stats.totalProviders)}
            change={stats.providersChange}
            icon={Stethoscope}
            tone="info"
            hint="new providers vs last month"
          />
          <StatisticsCard
            label="Bookings"
            value={formatNumber(stats.totalBookings)}
            change={stats.bookingsChange}
            icon={CalendarCheck}
            tone="success"
          />
          <StatisticsCard
            label="Revenue"
            value={formatEGPCompact(stats.totalRevenue)}
            change={stats.revenueChange}
            icon={Wallet}
            tone="warning"
            hint={formatEGP(stats.totalRevenue)}
          />
        </div>
      </Reveal>

      {/*
        §15 — the health of the marketplace, not just its size. Conversion says
        whether discovery is working; cancellation and no-show say whether the
        bookings we take actually turn into visits.
      */}
      <Reveal>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatisticsCard
            label="Conversion rate"
            value={`${stats.conversionRate}%`}
            change={stats.conversionChange}
            icon={Target}
            tone="primary"
            hint="profile views that become bookings"
          />
          <StatisticsCard
            label="Cancellation rate"
            value={`${stats.cancellationRate}%`}
            change={stats.cancellationRateChange}
            invertChange
            icon={CalendarX}
            tone="warning"
            hint="share of bookings cancelled"
          />
          <StatisticsCard
            label="No-show rate"
            value={`${stats.noShowRate}%`}
            icon={UserX}
            tone="destructive"
            hint="confirmed bookings never attended"
          />
        </div>
      </Reveal>

      {hasTrends ? (
        <TrendChart
          data={stats.bookingTrends}
          title="Booking trends"
          description="Monthly booking volume across every provider type, last 12 months"
        />
      ) : (
        <EmptyState
          title="No bookings yet"
          description="The trend chart appears once bookings start coming in."
        />
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {stats.topSpecialties.length > 0 ? (
          <CategoryBarChart
            data={stats.topSpecialties}
            title="Top specialties"
            description="Bookings by doctor specialty"
            colorIndex={0}
          />
        ) : (
          <EmptyState
            title="No specialty data"
            description="Specialty rankings need completed doctor bookings."
          />
        )}

        {stats.topGovernorates.length > 0 ? (
          <CategoryBarChart
            data={stats.topGovernorates}
            title="Top governorates"
            description="Bookings by provider location"
            colorIndex={1}
          />
        ) : (
          <EmptyState
            title="No location data"
            description="Governorate rankings need bookings with a located provider."
          />
        )}
      </div>
    </div>
  );
}
