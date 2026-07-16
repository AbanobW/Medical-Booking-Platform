"use client";

import { useTranslations } from "next-intl";
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
import { GOVERNORATES, SPECIALTIES } from "@/lib/data/egypt";
import { useApiError } from "@/lib/i18n/use-api-error";
import { useDomain, useFormat } from "@/lib/i18n/use-format";
import type { CategoryCount, TimeSeriesPoint } from "@/lib/types";

/**
 * The stats service hands back English category labels (one dataset, many
 * consumers). Charts are the only place they surface, so they are mapped back
 * onto the dataset's bilingual names at render — the numbers never move.
 */
function useChartLabels() {
  const t = useTranslations("admin.charts");
  const { getSpecialtyName, getGovernorateName } = useDomain();

  const months = (series: TimeSeriesPoint[]) =>
    series.map((point) => ({
      ...point,
      label: t.has(`month.${point.label}`)
        ? t(`month.${point.label}`)
        : point.label,
    }));

  const specialties = (data: CategoryCount[]) =>
    data.map((row) => {
      const specialty = SPECIALTIES.find((s) => s.name === row.name);
      return specialty ? { ...row, name: getSpecialtyName(specialty.id) } : row;
    });

  const governorates = (data: CategoryCount[]) =>
    data.map((row) => {
      const governorate = GOVERNORATES.find((g) => g.name === row.name);
      return governorate
        ? { ...row, name: getGovernorateName(governorate.id) }
        : row;
    });

  /** `byType` / `byPaymentMethod` / `byReason` — a lookup, with the raw name as the fallback. */
  const lookup = (data: CategoryCount[], group: string) =>
    data.map((row) =>
      t.has(`${group}.${row.name}`)
        ? { ...row, name: t(`${group}.${row.name}`) }
        : row,
    );

  return { months, specialties, governorates, lookup };
}

export default function AdminAnalyticsPage() {
  const t = useTranslations("admin");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">
          {t("analytics.title")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("analytics.subtitle")}</p>
      </div>

      <Tabs defaultValue="platform" className="gap-6">
        <div className="overflow-x-auto">
          <TabsList className="h-10">
            <TabsTrigger value="platform">
              <LayoutDashboard aria-hidden />
              {t("analytics.tabs.platform")}
            </TabsTrigger>
            <TabsTrigger value="doctors">
              <Stethoscope aria-hidden />
              {t("analytics.tabs.doctors")}
            </TabsTrigger>
            <TabsTrigger value="labs">
              <Microscope aria-hidden />
              {t("analytics.tabs.labs")}
            </TabsTrigger>
            <TabsTrigger value="radiology">
              <Radiation aria-hidden />
              {t("analytics.tabs.radiology")}
            </TabsTrigger>
            <TabsTrigger value="cancellations">
              <CalendarX aria-hidden />
              {t("analytics.tabs.cancellations")}
            </TabsTrigger>
            <TabsTrigger value="revenue">
              <Wallet aria-hidden />
              {t("analytics.tabs.revenue")}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="platform">
          <PlatformSection />
        </TabsContent>

        <TabsContent value="doctors">
          <ProviderLeaderboard
            type="doctor"
            title={t("analytics.leaderboard.doctors.title")}
            description={t("analytics.leaderboard.doctors.description")}
            colorIndex={0}
          />
        </TabsContent>

        <TabsContent value="labs">
          <ProviderLeaderboard
            type="lab"
            title={t("analytics.leaderboard.labs.title")}
            description={t("analytics.leaderboard.labs.description")}
            colorIndex={1}
          />
        </TabsContent>

        <TabsContent value="radiology">
          <ProviderLeaderboard
            type="radiology"
            title={t("analytics.leaderboard.radiology.title")}
            description={t("analytics.leaderboard.radiology.description")}
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
  const t = useTranslations("admin");
  const describeError = useApiError();
  const { formatEGP, formatEGPCompact, formatNumber } = useFormat();
  const { months, specialties, governorates } = useChartLabels();

  const { data, error, isLoading, refetch } = useAsync(() => getAdminStats());

  /** An unknown rate is a dash, not "—%". */
  const percent = (value: number | null) =>
    value === null ? DASH : `${formatNumber(value)}%`;

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
        title={t("analytics.platform.errorTitle")}
        description={describeError(error)}
        onRetry={refetch}
      />
    );
  }

  if (!data) {
    return (
      <EmptyState
        icon={CalendarCheck}
        title={t("analytics.platform.emptyTitle")}
        description={t("analytics.platform.emptyDescription")}
      />
    );
  }

  return (
    <div className="space-y-6">
      <Reveal>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <StatisticsCard
            label={t("stats.totalBookings")}
            value={formatNumber(data.totalBookings)}
            change={data.bookingsChange}
            icon={CalendarCheck}
            tone="primary"
          />
          <StatisticsCard
            label={t("stats.revenue")}
            value={formatEGPCompact(data.totalRevenue)}
            change={data.revenueChange}
            icon={Wallet}
            tone="success"
            hint={formatEGP(data.totalRevenue)}
          />
          <StatisticsCard
            label={t("stats.conversionRate")}
            value={`${formatNumber(data.conversionRate)}%`}
            change={data.conversionChange}
            icon={Target}
            tone="info"
            hint={t("stats.conversionHint")}
          />
          <StatisticsCard
            label={t("stats.cancellationRate")}
            value={`${formatNumber(data.cancellationRate)}%`}
            change={data.cancellationRateChange}
            invertChange
            icon={CalendarX}
            tone="warning"
            hint={t("stats.cancellationHint")}
          />
          <StatisticsCard
            label={t("stats.noShowRate")}
            value={`${formatNumber(data.noShowRate)}%`}
            icon={UserX}
            tone="destructive"
            hint={t("stats.noShowHint")}
          />
        </div>
      </Reveal>

      <TrendChart
        data={months(data.bookingTrends)}
        title={t("charts.trends.title")}
        description={t("charts.trends.description")}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {data.topSpecialties.length > 0 ? (
          <CategoryBarChart
            data={specialties(data.topSpecialties)}
            title={t("charts.topSpecialties.title")}
            description={t("charts.topSpecialties.description")}
            colorIndex={0}
          />
        ) : (
          <EmptyState
            title={t("charts.topSpecialties.emptyTitle")}
            description={t("charts.topSpecialties.emptyDescription")}
          />
        )}

        {data.topGovernorates.length > 0 ? (
          <CategoryBarChart
            data={governorates(data.topGovernorates)}
            title={t("charts.topLocations.title")}
            description={t("charts.topLocations.description")}
            colorIndex={1}
          />
        ) : (
          <EmptyState
            title={t("charts.topLocations.emptyTitle")}
            description={t("charts.topLocations.emptyDescription")}
          />
        )}
      </div>
    </div>
  );
}

function CancellationSection() {
  const t = useTranslations("admin");
  const describeError = useApiError();
  const { formatNumber } = useFormat();
  const { months, lookup } = useChartLabels();

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
        title={t("analytics.cancellations.errorTitle")}
        description={describeError(error)}
        onRetry={refetch}
      />
    );
  }

  if (!data || data.totalCancellations === 0) {
    return (
      <EmptyState
        icon={CalendarX}
        title={t("analytics.cancellations.emptyTitle")}
        description={t("analytics.cancellations.emptyDescription")}
      />
    );
  }

  return (
    <div className="space-y-6">
      <Reveal>
        <div className="grid gap-4 sm:grid-cols-2">
          <StatisticsCard
            label={t("stats.totalCancellations")}
            value={formatNumber(data.totalCancellations)}
            icon={CalendarX}
            tone="destructive"
            hint={t("stats.totalCancellationsHint")}
          />
          <StatisticsCard
            label={t("stats.cancellationRate")}
            value={`${formatNumber(data.cancellationRate)}%`}
            icon={Percent}
            tone="warning"
            hint={t("stats.cancellationHintAll")}
          />
        </div>
      </Reveal>

      <div className="grid gap-6 lg:grid-cols-2">
        <CategoryBarChart
          data={lookup(data.byReason, "cancelReason")}
          title={t("charts.cancelReasons.title")}
          description={t("charts.cancelReasons.description")}
          colorIndex={3}
        />
        <DonutChart
          data={lookup(data.byType, "providerTypePlural")}
          title={t("charts.cancelByType.title")}
          description={t("charts.cancelByType.description")}
        />
      </div>

      <BookingsChart
        data={months(data.monthly)}
        title={t("charts.bookingsVsCancellations.title")}
        description={t("charts.bookingsVsCancellations.description")}
      />
    </div>
  );
}

function RevenueSection() {
  const t = useTranslations("admin");
  const describeError = useApiError();
  const { formatEGP, formatEGPCompact } = useFormat();
  const { months, lookup } = useChartLabels();

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
        title={t("analytics.revenue.errorTitle")}
        description={describeError(error)}
        onRetry={refetch}
      />
    );
  }

  if (!data || data.totalRevenue === 0) {
    return (
      <EmptyState
        icon={Wallet}
        title={t("analytics.revenue.emptyTitle")}
        description={t("analytics.revenue.emptyDescription")}
      />
    );
  }

  return (
    <div className="space-y-6">
      <Reveal>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatisticsCard
            label={t("stats.totalRevenue")}
            value={formatEGPCompact(data.totalRevenue)}
            icon={Wallet}
            tone="primary"
            hint={formatEGP(data.totalRevenue)}
          />
          <StatisticsCard
            label={t("stats.platformCommission")}
            value={formatEGPCompact(data.platformCommission)}
            icon={Coins}
            tone="success"
            hint={formatEGP(data.platformCommission)}
          />
          <StatisticsCard
            label={t("stats.netToProviders")}
            value={formatEGPCompact(data.netToProviders)}
            icon={Landmark}
            tone="info"
            hint={formatEGP(data.netToProviders)}
          />
          <StatisticsCard
            label={t("stats.averageBookingValue")}
            value={formatEGP(data.averageBookingValue)}
            icon={Banknote}
            tone="warning"
            hint={t("stats.averageBookingValueHint")}
          />
        </div>
      </Reveal>

      <RevenueChart
        data={months(data.monthly)}
        title={t("charts.revenue.title")}
        description={t("charts.revenue.description")}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <DonutChart
          data={lookup(data.byType, "providerTypePlural")}
          title={t("charts.revenueByType.title")}
          description={t("charts.revenueByType.description")}
          format={(value) => formatEGP(value)}
        />
        <DonutChart
          data={lookup(data.byPaymentMethod, "paymentMethod")}
          title={t("charts.revenueByPayment.title")}
          description={t("charts.revenueByPayment.description")}
          format={(value) => formatEGP(value)}
        />
      </div>
    </div>
  );
}
