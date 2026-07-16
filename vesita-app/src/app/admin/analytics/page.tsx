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
  Radiation,
  Stethoscope,
  Target,
  UserX,
  Wallet,
} from "lucide-react";

import { ProviderLeaderboard } from "@/components/admin/provider-leaderboard";
import {
  CategoryBarChart,
  DonutChart,
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
import { DASH } from "@/lib/i18n/format";
import { useApiError } from "@/lib/i18n/use-api-error";
import { useDomain, useFormat } from "@/lib/i18n/use-format";
import type { CategoryCount, TimeSeriesPoint } from "@/lib/types";

/** The analytics service counts rows as `{ label, count }`; charts read `CategoryCount`. */
function toCategories(rows: { label: string; count: number }[]): CategoryCount[] {
  return rows.map((row) => ({ name: row.label, value: row.count }));
}

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
            change={data.bookingsChange ?? undefined}
            icon={CalendarCheck}
            tone="primary"
          />
          <StatisticsCard
            label={t("stats.revenue")}
            value={formatEGPCompact(data.totalRevenue)}
            change={data.revenueChange ?? undefined}
            icon={Wallet}
            tone="success"
            hint={formatEGP(data.totalRevenue)}
          />
          <StatisticsCard
            label={t("stats.conversionRate")}
            value={percent(data.conversionRate)}
            change={data.conversionChange ?? undefined}
            icon={Target}
            tone="info"
            hint={t("stats.conversionHint")}
          />
          <StatisticsCard
            label={t("stats.cancellationRate")}
            value={percent(data.cancellationRate)}
            change={data.cancellationRateChange ?? undefined}
            invertChange
            icon={CalendarX}
            tone="warning"
            hint={t("stats.cancellationHint")}
          />
          <StatisticsCard
            label={t("stats.noShowRate")}
            value={percent(data.noShowRate)}
            icon={UserX}
            tone="destructive"
            hint={t("stats.noShowHint")}
          />
        </div>
      </Reveal>

      {data.bookingTrends.length > 0 ? (
        <TrendChart
          data={months(data.bookingTrends)}
          title={t("charts.trends.title")}
          description={t("charts.trends.description")}
        />
      ) : (
        <EmptyState
          title={t("charts.trends.emptyTitle")}
          description={t("charts.trends.emptyDescription")}
        />
      )}

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
  const { formatEGP, formatEGPCompact } = useFormat();
  const { lookup } = useChartLabels();

  const { data, error, isLoading, refetch } = useAsync(() =>
    getCancellationAnalytics(),
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <StatGridSkeleton count={1} />
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
        title={t("analytics.cancellations.errorTitle")}
        description={describeError(error)}
        onRetry={refetch}
      />
    );
  }

  if (!data) {
    return (
      <EmptyState
        icon={CalendarX}
        title={t("analytics.cancellations.emptyTitle")}
        description={t("analytics.cancellations.emptyDescription")}
      />
    );
  }

  const byReason = lookup(toCategories(data.byReason), "cancelReason");
  const byRole = lookup(toCategories(data.byRole), "providerTypePlural");

  return (
    <div className="space-y-6">
      <Reveal>
        <div className="grid gap-4 sm:grid-cols-2">
          <StatisticsCard
            label={t("stats.refundedTotal")}
            value={formatEGPCompact(data.refundedTotal)}
            icon={Banknote}
            tone="destructive"
            hint={
              data.refundedTotal === null
                ? t("stats.refundedTotalHint")
                : formatEGP(data.refundedTotal)
            }
          />
        </div>
      </Reveal>

      <div className="grid gap-6 lg:grid-cols-2">
        {byReason.length > 0 ? (
          <CategoryBarChart
            data={byReason}
            title={t("charts.cancelReasons.title")}
            description={t("charts.cancelReasons.description")}
            colorIndex={3}
          />
        ) : (
          <EmptyState
            title={t("charts.cancelReasons.emptyTitle")}
            description={t("charts.cancelReasons.emptyDescription")}
          />
        )}

        {byRole.length > 0 ? (
          <DonutChart
            data={byRole}
            title={t("charts.cancelByType.title")}
            description={t("charts.cancelByType.description")}
          />
        ) : (
          <EmptyState
            title={t("charts.cancelByType.emptyTitle")}
            description={t("charts.cancelByType.emptyDescription")}
          />
        )}
      </div>
    </div>
  );
}

function RevenueSection() {
  const t = useTranslations("admin");
  const describeError = useApiError();
  const { formatEGP, formatEGPCompact } = useFormat();

  const { data, error, isLoading, refetch } = useAsync(() => getRevenueAnalytics());

  if (isLoading) {
    return (
      <div className="space-y-6">
        <StatGridSkeleton count={3} />
        <ChartSkeleton />
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

  if (!data) {
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatisticsCard
            label={t("stats.totalRevenue")}
            value={formatEGPCompact(data.grossTotal)}
            icon={Wallet}
            tone="primary"
            hint={formatEGP(data.grossTotal)}
          />
          <StatisticsCard
            label={t("stats.platformCommission")}
            value={formatEGPCompact(data.commissionTotal)}
            icon={Coins}
            tone="success"
            hint={formatEGP(data.commissionTotal)}
          />
          <StatisticsCard
            label={t("stats.netToProviders")}
            value={formatEGPCompact(data.netTotal)}
            icon={Landmark}
            tone="info"
            hint={formatEGP(data.netTotal)}
          />
        </div>
      </Reveal>

      {/*
        `monthly` splits each month into commission and net. Every chart wrapper
        plots a `TimeSeriesPoint`, and gross is not the sum of the two — VAT and
        the flat platform fee sit outside both — so there is no series to draw
        until the shapes meet. See BACKEND-GAPS.md.
      */}
      <EmptyState
        icon={Wallet}
        title={t("charts.revenue.emptyTitle")}
        description={t("charts.revenue.emptyDescription")}
      />
    </div>
  );
}
