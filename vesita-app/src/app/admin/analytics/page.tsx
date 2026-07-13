"use client";

import {
  Banknote,
  CalendarCheck,
  CalendarX,
  Coins,
  Landmark,
  LayoutDashboard,
  Microscope,
  Percent,
  Radiation,
  Stethoscope,
  Target,
  UserX,
  Wallet,
} from "lucide-react";

import { ProviderLeaderboard } from "@/components/admin/provider-leaderboard";
import {
  BookingsChart,
  CategoryBarChart,
  DonutChart,
  RevenueChart,
  TrendChart,
} from "@/components/shared/charts";
import { Reveal } from "@/components/shared/motion";
import {
  ChartSkeleton,
  EmptyState,
  ErrorState,
  StatGridSkeleton,
} from "@/components/shared/states";
import { StatisticsCard } from "@/components/shared/statistics-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAsync } from "@/hooks/use-async";
import {
  getAdminStats,
  getCancellationAnalytics,
  getRevenueAnalytics,
} from "@/lib/api/stats";
import { formatEGP, formatEGPCompact, formatNumber } from "@/lib/site";

export default function AdminAnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Analytics</h2>
        <p className="text-sm text-muted-foreground">
          Who is booked most, why bookings fall through, and where the money goes.
        </p>
      </div>

      <Tabs defaultValue="platform" className="gap-6">
        <div className="overflow-x-auto">
          <TabsList className="h-10">
            <TabsTrigger value="platform">
              <LayoutDashboard aria-hidden />
              Platform
            </TabsTrigger>
            <TabsTrigger value="doctors">
              <Stethoscope aria-hidden />
              Doctors
            </TabsTrigger>
            <TabsTrigger value="labs">
              <Microscope aria-hidden />
              Labs
            </TabsTrigger>
            <TabsTrigger value="radiology">
              <Radiation aria-hidden />
              Radiology
            </TabsTrigger>
            <TabsTrigger value="cancellations">
              <CalendarX aria-hidden />
              Cancellations
            </TabsTrigger>
            <TabsTrigger value="revenue">
              <Wallet aria-hidden />
              Revenue
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="platform">
          <PlatformSection />
        </TabsContent>

        <TabsContent value="doctors">
          <ProviderLeaderboard
            type="doctor"
            title="Top booked doctors"
            description="The ten doctors with the most bookings"
            colorIndex={0}
          />
        </TabsContent>

        <TabsContent value="labs">
          <ProviderLeaderboard
            type="lab"
            title="Most active labs"
            description="The ten labs with the most bookings"
            colorIndex={1}
          />
        </TabsContent>

        <TabsContent value="radiology">
          <ProviderLeaderboard
            type="radiology"
            title="Most active radiology centers"
            description="The ten radiology centers with the most bookings"
            colorIndex={2}
          />
        </TabsContent>

        <TabsContent value="cancellations">
          <CancellationSection />
        </TabsContent>

        <TabsContent value="revenue">
          <RevenueSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/**
 * Platform reporting (§15) — the health of the whole marketplace: total
 * bookings, revenue, conversion, cancellation, and where the demand actually
 * sits (top specialties, top locations). Top providers live in the tabs beside
 * this one.
 */
function PlatformSection() {
  const { data, error, isLoading, refetch } = useAsync(() => getAdminStats());

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
        title="Couldn't load platform analytics"
        description={error.message}
        onRetry={refetch}
      />
    );
  }

  if (!data || data.totalBookings === 0) {
    return (
      <EmptyState
        icon={CalendarCheck}
        title="No platform activity yet"
        description="Bookings, revenue and conversion appear here once patients start booking."
      />
    );
  }

  return (
    <div className="space-y-6">
      <Reveal>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <StatisticsCard
            label="Total bookings"
            value={formatNumber(data.totalBookings)}
            change={data.bookingsChange}
            icon={CalendarCheck}
            tone="primary"
          />
          <StatisticsCard
            label="Revenue"
            value={formatEGPCompact(data.totalRevenue)}
            change={data.revenueChange}
            icon={Wallet}
            tone="success"
            hint={formatEGP(data.totalRevenue)}
          />
          <StatisticsCard
            label="Conversion rate"
            value={`${data.conversionRate}%`}
            change={data.conversionChange}
            icon={Target}
            tone="info"
            hint="profile views that become bookings"
          />
          <StatisticsCard
            label="Cancellation rate"
            value={`${data.cancellationRate}%`}
            change={data.cancellationRateChange}
            invertChange
            icon={CalendarX}
            tone="warning"
            hint="share of bookings cancelled"
          />
          <StatisticsCard
            label="No-show rate"
            value={`${data.noShowRate}%`}
            icon={UserX}
            tone="destructive"
            hint="confirmed bookings never attended"
          />
        </div>
      </Reveal>

      <TrendChart
        data={data.bookingTrends}
        title="Booking trends"
        description="Monthly booking volume across every provider type, last 12 months"
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {data.topSpecialties.length > 0 ? (
          <CategoryBarChart
            data={data.topSpecialties}
            title="Top specialties"
            description="Bookings by doctor specialty"
            colorIndex={0}
          />
        ) : (
          <EmptyState
            title="No specialty data"
            description="Specialty rankings need doctor bookings."
          />
        )}

        {data.topGovernorates.length > 0 ? (
          <CategoryBarChart
            data={data.topGovernorates}
            title="Top locations"
            description="Bookings by provider governorate"
            colorIndex={1}
          />
        ) : (
          <EmptyState
            title="No location data"
            description="Location rankings need bookings with a located provider."
          />
        )}
      </div>
    </div>
  );
}

function CancellationSection() {
  const { data, error, isLoading, refetch } = useAsync(() =>
    getCancellationAnalytics(),
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <StatGridSkeleton count={2} />
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
        <ChartSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Couldn't load cancellation analytics"
        description={error.message}
        onRetry={refetch}
      />
    );
  }

  if (!data || data.totalCancellations === 0) {
    return (
      <EmptyState
        icon={CalendarX}
        title="No cancellations"
        description="Nothing has been cancelled on the platform yet — a good problem to have."
      />
    );
  }

  return (
    <div className="space-y-6">
      <Reveal>
        <div className="grid gap-4 sm:grid-cols-2">
          <StatisticsCard
            label="Total cancellations"
            value={formatNumber(data.totalCancellations)}
            icon={CalendarX}
            tone="destructive"
            hint="all time, across every provider"
          />
          <StatisticsCard
            label="Cancellation rate"
            value={`${data.cancellationRate}%`}
            icon={Percent}
            tone="warning"
            hint="share of all bookings cancelled"
          />
        </div>
      </Reveal>

      <div className="grid gap-6 lg:grid-cols-2">
        <CategoryBarChart
          data={data.byReason}
          title="Why patients cancel"
          description="Cancellations by stated reason"
          colorIndex={3}
        />
        <DonutChart
          data={data.byType}
          title="Cancellations by provider type"
          description="Where cancellations land"
        />
      </div>

      <BookingsChart
        data={data.monthly}
        title="Bookings vs cancellations"
        description="Monthly booking volume against cancellations, last 12 months"
      />
    </div>
  );
}

function RevenueSection() {
  const { data, error, isLoading, refetch } = useAsync(() => getRevenueAnalytics());

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
        title="Couldn't load revenue analytics"
        description={error.message}
        onRetry={refetch}
      />
    );
  }

  if (!data || data.totalRevenue === 0) {
    return (
      <EmptyState
        icon={Wallet}
        title="No revenue yet"
        description="Revenue is realised when a booking is completed."
      />
    );
  }

  return (
    <div className="space-y-6">
      <Reveal>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatisticsCard
            label="Total revenue"
            value={formatEGPCompact(data.totalRevenue)}
            icon={Wallet}
            tone="primary"
            hint={formatEGP(data.totalRevenue)}
          />
          <StatisticsCard
            label="Platform commission"
            value={formatEGPCompact(data.platformCommission)}
            icon={Coins}
            tone="success"
            hint={formatEGP(data.platformCommission)}
          />
          <StatisticsCard
            label="Net to providers"
            value={formatEGPCompact(data.netToProviders)}
            icon={Landmark}
            tone="info"
            hint={formatEGP(data.netToProviders)}
          />
          <StatisticsCard
            label="Avg. booking value"
            value={formatEGP(data.averageBookingValue)}
            icon={Banknote}
            tone="warning"
            hint="per completed booking"
          />
        </div>
      </Reveal>

      <RevenueChart
        data={data.monthly}
        title="Revenue"
        description="Realised revenue from completed bookings, last 12 months"
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <DonutChart
          data={data.byType}
          title="Revenue by provider type"
          description="Where the money is earned"
          format={(value) => formatEGP(value)}
        />
        <DonutChart
          data={data.byPaymentMethod}
          title="Revenue by payment method"
          description="How patients pay"
          format={(value) => formatEGP(value)}
        />
      </div>
    </div>
  );
}
