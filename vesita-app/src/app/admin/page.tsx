"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
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
import { GOVERNORATES, SPECIALTIES } from "@/lib/data/egypt";
import { DASH } from "@/lib/i18n/format";
import { useApiError } from "@/lib/i18n/use-api-error";
import { useDomain, useFormat } from "@/lib/i18n/use-format";
import type { CategoryCount, TimeSeriesPoint } from "@/lib/types";

/**
 * The stats service hands back English category labels (it feeds seeds and
 * charts alike). Charts are the only place they surface, so they are mapped back
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
      return specialty
        ? { ...row, name: getSpecialtyName(specialty.id) }
        : row;
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

export default function AdminDashboardPage() {
  const t = useTranslations("admin");
  const describeError = useApiError();
  const { formatEGP, formatEGPCompact, formatNumber } = useFormat();
  const { months, specialties, governorates } = useChartLabels();

  const { data: stats, error, isLoading, refetch } = useAsync(() => getAdminStats());

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
        title={t("dashboard.errorTitle")}
        description={describeError(error)}
        onRetry={refetch}
      />
    );
  }

  if (!stats) {
    return (
      <EmptyState
        title={t("dashboard.emptyTitle")}
        description={t("dashboard.emptyDescription")}
      />
    );
  }

  const hasTrends = stats.bookingTrends.some((point) => point.bookings > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            {t("dashboard.title")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("dashboard.subtitle")}
          </p>
        </div>

        <Button
          variant="outline"
          className="h-10 rounded-xl px-4"
          render={<Link href="/admin/analytics" />}
        >
          {t("dashboard.viewAnalytics")}
          <ArrowRight className="size-4 rtl:rotate-180" />
        </Button>
      </div>

      <Reveal>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatisticsCard
            label={t("stats.patients")}
            value={formatNumber(stats.totalUsers)}
            change={stats.usersChange ?? undefined}
            icon={Users}
            tone="primary"
            hint={t("stats.patientsHint")}
          />
          <StatisticsCard
            label={t("stats.providers")}
            value={formatNumber(stats.totalProviders)}
            change={stats.providersChange ?? undefined}
            icon={Stethoscope}
            tone="info"
            hint={t("stats.providersHint")}
          />
          <StatisticsCard
            label={t("stats.bookings")}
            value={formatNumber(stats.totalBookings)}
            change={stats.bookingsChange ?? undefined}
            icon={CalendarCheck}
            tone="success"
          />
          <StatisticsCard
            label={t("stats.revenue")}
            value={formatEGPCompact(stats.totalRevenue)}
            change={stats.revenueChange ?? undefined}
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
            label={t("stats.conversionRate")}
            value={percent(stats.conversionRate)}
            change={stats.conversionChange ?? undefined}
            icon={Target}
            tone="primary"
            hint={t("stats.conversionHint")}
          />
          <StatisticsCard
            label={t("stats.cancellationRate")}
            value={percent(stats.cancellationRate)}
            change={stats.cancellationRateChange ?? undefined}
            invertChange
            icon={CalendarX}
            tone="warning"
            hint={t("stats.cancellationHint")}
          />
          <StatisticsCard
            label={t("stats.noShowRate")}
            value={percent(stats.noShowRate)}
            icon={UserX}
            tone="destructive"
            hint={t("stats.noShowHint")}
          />
        </div>
      </Reveal>

      {hasTrends ? (
        <TrendChart
          data={months(stats.bookingTrends)}
          title={t("charts.trends.title")}
          description={t("charts.trends.description")}
        />
      ) : (
        <EmptyState
          title={t("dashboard.noBookingsTitle")}
          description={t("dashboard.noBookingsDescription")}
        />
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {stats.topSpecialties.length > 0 ? (
          <CategoryBarChart
            data={specialties(stats.topSpecialties)}
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

        {stats.topGovernorates.length > 0 ? (
          <CategoryBarChart
            data={governorates(stats.topGovernorates)}
            title={t("charts.topGovernorates.title")}
            description={t("charts.topGovernorates.description")}
            colorIndex={1}
          />
        ) : (
          <EmptyState
            title={t("charts.topGovernorates.emptyTitle")}
            description={t("charts.topGovernorates.emptyDescription")}
          />
        )}
      </div>
    </div>
  );
}
