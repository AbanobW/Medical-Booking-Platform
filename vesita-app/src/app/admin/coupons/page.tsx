"use client";

import { useMemo, useState } from "react";
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
import { TODAY } from "@/lib/data/seed";
import { formatDateShort } from "@/lib/format";
import { formatEGP } from "@/lib/site";
import type { Coupon } from "@/lib/types";

const NOW = TODAY.toISOString();

/** A slim usage meter — the number carries the value, the bar carries the shape. */
function UsageMeter({ used, limit }: { used: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const exhausted = limit > 0 && used >= limit;

  return (
    <div className="min-w-32 space-y-1.5">
      <p className="text-xs tabular-nums text-muted-foreground">
        {used} / {limit} used
      </p>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Coupon usage"
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
  const { data, error, isLoading, refetch } = useAsync(() => getCoupons());

  const [editing, setEditing] = useState<Coupon | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<Coupon | null>(null);

  const { mutate: remove, isPending: isDeleting } = useMutation(deleteCoupon);

  async function confirmDelete() {
    if (!deleting) return;

    try {
      await remove(deleting.id);
      toast.success(`Coupon ${deleting.code} deleted.`);
      setDeleting(null);
      refetch();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not delete the coupon.",
      );
    }
  }

  const columns = useMemo<ColumnDef<Coupon, unknown>[]>(
    () => [
      {
        id: "code",
        accessorKey: "code",
        header: "Code",
        cell: ({ row }) => (
          <div className="min-w-40">
            <p className="font-mono font-semibold tracking-wide">
              {row.original.code}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {row.original.description}
            </p>
          </div>
        ),
      },
      {
        id: "discount",
        accessorKey: "discountValue",
        header: "Discount",
        cell: ({ row }) => {
          const coupon = row.original;
          return (
            <div className="whitespace-nowrap">
              <p className="font-medium tabular-nums">
                {coupon.discountType === "percentage"
                  ? `${coupon.discountValue}%`
                  : formatEGP(coupon.discountValue)}
              </p>
              <p className="text-xs text-muted-foreground">
                {coupon.maxDiscount
                  ? `Max ${formatEGP(coupon.maxDiscount)}`
                  : "No cap"}
              </p>
            </div>
          );
        },
      },
      {
        id: "minOrderValue",
        accessorKey: "minOrderValue",
        header: "Min. order",
        cell: ({ row }) => (
          <span className="whitespace-nowrap tabular-nums text-muted-foreground">
            {row.original.minOrderValue > 0
              ? formatEGP(row.original.minOrderValue)
              : "—"}
          </span>
        ),
      },
      {
        id: "appliesTo",
        header: "Applies to",
        enableSorting: false,
        cell: ({ row }) => <AppliesToBadges appliesTo={row.original.appliesTo} />,
      },
      {
        id: "usage",
        accessorKey: "usageCount",
        header: "Usage",
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
        header: "Expires",
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground">
            {formatDateShort(row.original.expiresAt)}
          </span>
        ),
      },
      {
        id: "state",
        accessorKey: "isActive",
        header: "State",
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
              aria-label={`Edit ${row.original.code}`}
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
              aria-label={`Delete ${row.original.code}`}
              className="text-destructive hover:text-destructive"
              onClick={() => setDeleting(row.original)}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  const coupons = data ?? [];
  const activeCount = coupons.filter(
    (c) => c.isActive && c.expiresAt >= NOW,
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
      New coupon
    </Button>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Coupons</h2>
          <p className="text-sm text-muted-foreground">
            {coupons.length > 0
              ? `${coupons.length} coupon${coupons.length === 1 ? "" : "s"} · ${activeCount} live right now`
              : "Discount codes patients can redeem at checkout"}
          </p>
        </div>
        <Badge variant="outline" className="gap-1">
          <Ticket aria-hidden />
          {activeCount} active
        </Badge>
      </div>

      {isLoading ? (
        <TableSkeleton rows={6} columns={6} />
      ) : error ? (
        <ErrorState
          title="Couldn't load coupons"
          description={error.message}
          onRetry={refetch}
        />
      ) : coupons.length === 0 ? (
        <EmptyState
          icon={Ticket}
          title="No coupons yet"
          description="Create a discount code to run your first promotion."
          action={newButton}
        />
      ) : (
        <DataTable
          columns={columns}
          data={coupons}
          searchPlaceholder="Search by code or description…"
          pageSize={10}
          toolbar={newButton}
          emptyTitle="No matching coupons"
          emptyDescription="Try a different code or description."
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
        title={`Delete ${deleting?.code ?? "this coupon"}?`}
        description="The code stops working immediately. Bookings that already used it keep their discount. This cannot be undone."
        confirmLabel="Delete coupon"
        isPending={isDeleting}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
