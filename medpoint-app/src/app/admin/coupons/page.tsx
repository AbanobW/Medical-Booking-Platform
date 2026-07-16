"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Pencil, Plus, Ticket, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppliesToBadges, CouponStateBadge } from "@/components/admin/badges";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { CouponDialog } from "@/components/admin/coupon-dialog";
import { DataTable, type ColumnDef } from "@/components/shared/data-table";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAsync, useMutation } from "@/hooks/use-async";
import { deleteCoupon, getCoupons } from "@/lib/api/admin";
import { now } from "@/lib/time";
import { useApiError } from "@/lib/i18n/use-api-error";
import { DASH } from "@/lib/i18n/format";
import { useDomain, useFormat } from "@/lib/i18n/use-format";
import type { Coupon } from "@/lib/types";

const NOW = now().toISOString();

/**
 * A slim usage meter — the number carries the value, the bar carries the shape.
 *
 * `limit` is null when the coupon is unlimited (the API's null `max_uses`).
 * There is no proportion to draw against infinity, so the bar gives way to the
 * count alone rather than showing a full or empty track that means neither.
 */
function UsageMeter({ used, limit }: { used: number; limit: number | null }) {
  const t = useTranslations("admin");

  if (limit === null) {
    return (
      <p className="min-w-32 text-xs tabular-nums text-muted-foreground">
        {t("coupons.usage.unlimited", { used })}
      </p>
    );
  }

  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const exhausted = limit > 0 && used >= limit;

  return (
    <div className="min-w-32 space-y-1.5">
      <p className="text-xs tabular-nums text-muted-foreground">
        {t("coupons.usage.used", { used, limit })}
      </p>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t("coupons.usage.aria")}
      >
        <div
          className={exhausted ? "h-full bg-destructive" : "h-full bg-primary"}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function AdminCouponsPage() {
  const t = useTranslations("admin");
  const describeError = useApiError();
  const { formatDateShort, formatEGP, formatNumber } = useFormat();
  const { localized } = useDomain();

  const { data, error, isLoading, refetch } = useAsync(() => getCoupons());

  const [editing, setEditing] = useState<Coupon | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<Coupon | null>(null);

  const { mutate: remove, isPending: isDeleting } = useMutation(deleteCoupon);

  async function confirmDelete() {
    if (!deleting) return;

    try {
      await remove(deleting.id);
      toast.success(t("coupons.deleted", { code: deleting.code }));
      setDeleting(null);
      refetch();
    } catch (err) {
      toast.error(describeError(err));
    }
  }

  const columns = useMemo<ColumnDef<Coupon, unknown>[]>(
    () => [
      {
        id: "code",
        accessorKey: "code",
        header: t("coupons.columns.code"),
        cell: ({ row }) => (
          <div className="min-w-40">
            <p className="font-mono font-semibold tracking-wide" dir="ltr">
              {row.original.code}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {localized(row.original.description)}
            </p>
          </div>
        ),
      },
      {
        id: "discount",
        accessorKey: "discountValue",
        header: t("coupons.columns.discount"),
        cell: ({ row }) => {
          const coupon = row.original;
          return (
            <div className="whitespace-nowrap">
              <p className="ltr-nums font-medium tabular-nums">
                {coupon.discountType === "percentage"
                  ? `${formatNumber(coupon.discountValue)}%`
                  : formatEGP(coupon.discountValue)}
              </p>
              <p className="text-xs text-muted-foreground">
                {coupon.maxDiscount
                  ? t("coupons.maxDiscount", {
                      amount: formatEGP(coupon.maxDiscount),
                    })
                  : t("coupons.noCap")}
              </p>
            </div>
          );
        },
      },
      {
        id: "minOrderValue",
        accessorKey: "minOrderValue",
        header: t("coupons.columns.minOrder"),
        cell: ({ row }) => (
          <span className="whitespace-nowrap tabular-nums text-muted-foreground">
            {row.original.minOrderValue
              ? formatEGP(row.original.minOrderValue)
              : DASH}
          </span>
        ),
      },
      {
        id: "appliesTo",
        header: t("coupons.columns.appliesTo"),
        enableSorting: false,
        cell: ({ row }) => <AppliesToBadges appliesTo={row.original.appliesTo} />,
      },
      {
        id: "usage",
        accessorKey: "usageCount",
        header: t("coupons.columns.usage"),
        cell: ({ row }) => (
          <UsageMeter
            used={row.original.usageCount}
            limit={row.original.usageLimit}
          />
        ),
      },
      {
        id: "expiresAt",
        accessorKey: "expiresAt",
        header: t("coupons.columns.expires"),
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground">
            {row.original.expiresAt
              ? formatDateShort(row.original.expiresAt)
              : t("coupons.neverExpires")}
          </span>
        ),
      },
      {
        id: "state",
        accessorKey: "isActive",
        header: t("coupons.columns.state"),
        cell: ({ row }) => (
          <CouponStateBadge
            isActive={row.original.isActive}
            expiresAt={row.original.expiresAt}
            now={NOW}
          />
        ),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("coupons.editAria", { code: row.original.code })}
              onClick={() => {
                setEditing(row.original);
                setDialogOpen(true);
              }}
            >
              <Pencil className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("coupons.deleteAria", { code: row.original.code })}
              className="text-destructive hover:text-destructive"
              onClick={() => setDeleting(row.original)}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ),
      },
    ],
    [t, localized, formatDateShort, formatEGP, formatNumber],
  );

  const coupons = data ?? [];
  const activeCount = coupons.filter(
    (c) => c.isActive && (c.expiresAt === null || c.expiresAt >= NOW),
  ).length;

  const newButton = (
    <Button
      className="h-10 rounded-xl px-4"
      onClick={() => {
        setEditing(null);
        setDialogOpen(true);
      }}
    >
      <Plus className="size-4" />
      {t("coupons.new")}
    </Button>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            {t("coupons.title")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {coupons.length > 0
              ? t("coupons.count", {
                  count: coupons.length,
                  active: formatNumber(activeCount),
                })
              : t("coupons.subtitle")}
          </p>
        </div>
        <Badge variant="outline" className="gap-1">
          <Ticket aria-hidden />
          {t("coupons.activeBadge", { count: formatNumber(activeCount) })}
        </Badge>
      </div>

      {isLoading ? (
        <TableSkeleton rows={6} columns={6} />
      ) : error ? (
        <ErrorState
          title={t("coupons.errorTitle")}
          description={describeError(error)}
          onRetry={refetch}
        />
      ) : coupons.length === 0 ? (
        <EmptyState
          icon={Ticket}
          title={t("coupons.emptyTitle")}
          description={t("coupons.emptyDescription")}
          action={newButton}
        />
      ) : (
        <DataTable
          columns={columns}
          data={coupons}
          searchPlaceholder={t("coupons.searchPlaceholder")}
          pageSize={10}
          toolbar={newButton}
          emptyTitle={t("coupons.tableEmptyTitle")}
          emptyDescription={t("coupons.tableEmptyDescription")}
        />
      )}

      <CouponDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        coupon={editing}
        onSaved={refetch}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t("coupons.deleteConfirm.title", {
          code: deleting?.code ?? t("coupons.deleteConfirm.fallbackName"),
        })}
        description={t("coupons.deleteConfirm.description")}
        confirmLabel={t("coupons.deleteConfirm.confirmLabel")}
        isPending={isDeleting}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
