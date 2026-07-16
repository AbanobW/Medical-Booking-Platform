"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Star } from "lucide-react";

import { PROVIDER_TYPE_META } from "@/components/admin/badges";
import { CategoryBarChart } from "@/components/shared/charts";
import { DataTable, type ColumnDef } from "@/components/shared/data-table";
import {
  ChartSkeleton,
  EmptyState,
  ErrorState,
  TableSkeleton,
} from "@/components/shared/states";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAsync } from "@/hooks/use-async";
import { getTopProviders, type RankedProvider } from "@/lib/api/stats";
import { DASH } from "@/lib/i18n/format";
import { useApiError } from "@/lib/i18n/use-api-error";
import { useDomain, useFormat } from "@/lib/i18n/use-format";
import type { ProviderRole } from "@/lib/types";

/**
 * The booking leaderboard for one provider type: a ranked bar chart over the
 * same rows the table lists, so the shape and the numbers agree.
 */
export function ProviderLeaderboard({
  type,
  title,
  description,
  colorIndex = 0,
  limit = 10,
}: {
  type: ProviderRole;
  title: string;
  description: string;
  colorIndex?: number;
  limit?: number;
}) {
  const t = useTranslations("admin");
  const describeError = useApiError();
  const { initialsOf, formatEGP, formatNumber } = useFormat();
  const { named, getGovernorateName } = useDomain();

  const { data, error, isLoading, refetch } = useAsync(
    () => getTopProviders(type, limit),
    [type, limit],
  );

  const columns = useMemo<ColumnDef<RankedProvider, unknown>[]>(
    () => [
      {
        id: "rank",
        header: t("leaderboard.columns.rank"),
        enableSorting: false,
        cell: ({ row }) => (
          <span className="tabular-nums text-muted-foreground">
            {row.index + 1}
          </span>
        ),
      },
      {
        id: "provider",
        accessorFn: (r) => named(r.provider),
        header: t("leaderboard.columns.provider"),
        cell: ({ row }) => {
          const { provider } = row.original;

          return (
            <div className="flex items-center gap-3">
              <Avatar className="size-9 shrink-0 rounded-xl">
                <AvatarImage src={provider.photo ?? undefined} alt="" />
                <AvatarFallback className="rounded-xl text-xs">
                  {initialsOf(named(provider))}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="font-medium whitespace-nowrap">
                  {named(provider)}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {provider.governorateId
                    ? getGovernorateName(provider.governorateId)
                    : DASH}
                </p>
              </div>
            </div>
          );
        },
      },
      {
        id: "rating",
        accessorFn: (r) => r.provider.rating,
        header: t("leaderboard.columns.rating"),
        cell: ({ row }) => {
          const { rating } = row.original.provider;

          // A star beside a dash would read as an unrated provider scoring zero.
          if (rating === null) {
            return <span className="text-muted-foreground">{DASH}</span>;
          }

          return (
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Star className="size-3.5 fill-warning text-warning" aria-hidden />
              {rating.toFixed(1)}
            </span>
          );
        },
      },
      {
        id: "bookings",
        accessorKey: "bookings",
        header: t("leaderboard.columns.bookings"),
        cell: ({ row }) => (
          <span className="font-medium tabular-nums">
            {formatNumber(row.original.bookings)}
          </span>
        ),
      },
      {
        id: "revenue",
        accessorKey: "revenue",
        header: t("leaderboard.columns.revenue"),
        cell: ({ row }) => (
          <span className="whitespace-nowrap tabular-nums">
            {formatEGP(row.original.revenue)}
          </span>
        ),
      },
      {
        id: "cancellationRate",
        accessorKey: "cancellationRate",
        header: t("leaderboard.columns.cancellationRate"),
        cell: ({ row }) => {
          const rate = row.original.cancellationRate;

          // A colour would grade the provider on a number we do not have.
          if (rate === null) {
            return <span className="text-muted-foreground">{DASH}</span>;
          }

          return (
            <Badge
              variant="secondary"
              className={
                rate >= 20
                  ? "border-0 bg-destructive/10 text-destructive"
                  : rate >= 10
                    ? "border-0 bg-warning/15 text-warning"
                    : "border-0 bg-success/10 text-success"
              }
            >
              <span className="ltr-nums">{rate.toFixed(1)}%</span>
            </Badge>
          );
        },
      },
    ],
    [t, named, getGovernorateName, initialsOf, formatEGP, formatNumber],
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <ChartSkeleton />
        <TableSkeleton rows={6} columns={5} />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        title={t("leaderboard.errorTitle")}
        description={describeError(error)}
        onRetry={refetch}
      />
    );
  }

  const ranked = data ?? [];
  const { icon } = PROVIDER_TYPE_META[type];

  if (ranked.length === 0) {
    return (
      <EmptyState
        icon={icon}
        title={t("leaderboard.emptyTitle")}
        description={t("leaderboard.emptyDescription")}
      />
    );
  }

  // The table can carry a provider whose booking count is unknown; a bar cannot.
  const series = ranked
    .filter((row): row is RankedProvider & { bookings: number } =>
      row.bookings !== null,
    )
    .map((row) => ({ name: named(row.provider), value: row.bookings }));

  return (
    <div className="space-y-6">
      {series.length > 0 ? (
        <CategoryBarChart
          data={series}
          title={title}
          description={description}
          colorIndex={colorIndex}
        />
      ) : (
        <EmptyState
          icon={icon}
          title={t("leaderboard.chartEmptyTitle")}
          description={t("leaderboard.chartEmptyDescription")}
        />
      )}

      <DataTable
        columns={columns}
        data={ranked}
        pageSize={10}
        emptyTitle={t("leaderboard.tableEmptyTitle")}
        emptyDescription={t("leaderboard.tableEmptyDescription")}
      />
    </div>
  );
}
