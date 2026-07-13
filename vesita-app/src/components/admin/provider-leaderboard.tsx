"use client";

import { useMemo } from "react";
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
import { getGovernorateName } from "@/lib/data/egypt";
import { initialsOf } from "@/lib/format";
import { formatEGP, formatNumber } from "@/lib/site";
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
  const { data, error, isLoading, refetch } = useAsync(
    () => getTopProviders(type, limit),
    [type, limit],
  );

  const columns = useMemo<ColumnDef<RankedProvider, unknown>[]>(
    () => [
      {
        id: "rank",
        header: "#",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="tabular-nums text-muted-foreground">
            {row.index + 1}
          </span>
        ),
      },
      {
        id: "provider",
        accessorFn: (r) => r.provider.name,
        header: "Provider",
        cell: ({ row }) => {
          const { provider } = row.original;

          return (
            <div className="flex items-center gap-3">
              <Avatar className="size-9 shrink-0 rounded-xl">
                <AvatarImage src={provider.photo} alt="" />
                <AvatarFallback className="rounded-xl text-xs">
                  {initialsOf(provider.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="font-medium whitespace-nowrap">{provider.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {getGovernorateName(provider.governorateId)}
                </p>
              </div>
            </div>
          );
        },
      },
      {
        id: "rating",
        accessorFn: (r) => r.provider.rating,
        header: "Rating",
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Star className="size-3.5 fill-warning text-warning" aria-hidden />
            {row.original.provider.rating.toFixed(1)}
          </span>
        ),
      },
      {
        id: "bookings",
        accessorKey: "bookings",
        header: "Bookings",
        cell: ({ row }) => (
          <span className="font-medium tabular-nums">
            {formatNumber(row.original.bookings)}
          </span>
        ),
      },
      {
        id: "revenue",
        accessorKey: "revenue",
        header: "Revenue",
        cell: ({ row }) => (
          <span className="whitespace-nowrap tabular-nums">
            {formatEGP(row.original.revenue)}
          </span>
        ),
      },
      {
        id: "cancellationRate",
        accessorKey: "cancellationRate",
        header: "Cancellation rate",
        cell: ({ row }) => {
          const rate = row.original.cancellationRate;

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
              {rate.toFixed(1)}%
            </Badge>
          );
        },
      },
    ],
    [],
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
        title={`Couldn't load ${title.toLowerCase()}`}
        description={error.message}
        onRetry={refetch}
      />
    );
  }

  const ranked = (data ?? []).filter((row) => row.bookings > 0);

  if (ranked.length === 0) {
    const { icon } = PROVIDER_TYPE_META[type];

    return (
      <EmptyState
        icon={icon}
        title="No bookings yet"
        description={`${title} appears here once these providers start taking bookings.`}
      />
    );
  }

  return (
    <div className="space-y-6">
      <CategoryBarChart
        data={ranked.map((row) => ({
          name: row.provider.name,
          value: row.bookings,
        }))}
        title={title}
        description={description}
        colorIndex={colorIndex}
      />

      <DataTable
        columns={columns}
        data={ranked}
        pageSize={10}
        emptyTitle="No providers"
        emptyDescription="Nothing to rank yet."
      />
    </div>
  );
}
