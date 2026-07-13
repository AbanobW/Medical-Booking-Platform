"use client";

import { useMemo, useState } from "react";
import {
  Ban,
  CircleCheck,
  CircleX,
  Hourglass,
  Loader2,
  RotateCcw,
  Star,
} from "lucide-react";
import { toast } from "sonner";

import {
  ProviderStatusBadge,
  ProviderTypeBadge,
  SuspensionBadge,
} from "@/components/admin/badges";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { SuspendDialog } from "@/components/admin/suspend-dialog";
import { DataTable, type ColumnDef } from "@/components/shared/data-table";
import { ErrorState, TableSkeleton } from "@/components/shared/states";
import { AppSelect } from "@/components/ui/app-select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAsync, useMutation } from "@/hooks/use-async";
import {
  getAdminProviders,
  reinstateProvider,
  setProviderStatus,
  suspendProvider,
} from "@/lib/api/admin";
import { GOVERNORATES, getGovernorateName } from "@/lib/data/egypt";
import { formatDateShort, initialsOf } from "@/lib/format";
import { formatNumber } from "@/lib/site";
import {
  PROVIDER_ROLES,
  type Provider,
  type ProviderRole,
  type ProviderStatus,
  type SuspensionType,
} from "@/lib/types";

const TYPE_LABELS: Record<ProviderRole, string> = {
  doctor: "Doctors",
  lab: "Labs",
  radiology: "Radiology centers",
};

const TYPE_OPTIONS = PROVIDER_ROLES.map((type) => ({
  value: type,
  label: TYPE_LABELS[type],
}));

const STATUS_OPTIONS: { value: ProviderStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "suspended", label: "Suspended" },
];

const GOVERNORATE_OPTIONS = GOVERNORATES.map((g) => ({
  value: g.id,
  label: g.name,
}));

/** One pagination model: fetch the filtered set, let DataTable page it. */
const FULL_PAGE = 1000;

/** Only rejection goes through the plain confirm gate — suspension has its own. */
interface PendingAction {
  provider: Provider;
  status: Extract<ProviderStatus, "rejected">;
}

export default function AdminProvidersPage() {
  const [type, setType] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [governorateId, setGovernorateId] = useState<string>("");

  const { data, error, isLoading, refetch } = useAsync(
    () =>
      getAdminProviders({
        type: (type || undefined) as ProviderRole | undefined,
        status: (status || undefined) as ProviderStatus | undefined,
        governorateId: governorateId || undefined,
        page: 1,
        pageSize: FULL_PAGE,
      }),
    [type, status, governorateId],
  );

  // The pending count is a property of the whole platform, not of the current
  // filters — so it gets its own unfiltered request.
  const { data: pendingSet } = useAsync(
    () => getAdminProviders({ status: "pending", page: 1, pageSize: FULL_PAGE }),
    [],
  );

  const { mutate, isPending } = useMutation(setProviderStatus);
  const { mutate: suspend, isPending: isSuspending } = useMutation(suspendProvider);
  const { mutate: reinstate, isPending: isReinstating } =
    useMutation(reinstateProvider);

  const [confirming, setConfirming] = useState<PendingAction | null>(null);
  const [suspending, setSuspending] = useState<Provider | null>(null);

  const busy = isPending || isSuspending || isReinstating;

  async function changeStatus(provider: Provider, next: ProviderStatus) {
    try {
      await mutate(provider.id, next);
      const verb =
        next === "approved"
          ? "approved"
          : next === "rejected"
            ? "rejected"
            : next === "suspended"
              ? "suspended"
              : "set to pending";
      toast.success(`${provider.name} ${verb}.`);
      setConfirming(null);
      refetch();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not update the provider.",
      );
    }
  }

  /**
   * §13 — the patient impact is the whole point of the distinction, so the
   * result reports it: a soft suspension leaves existing bookings alone, a hard
   * one cancels and refunds them, and we say how many patients that touched.
   */
  async function applySuspension(type: SuspensionType, reason: string) {
    if (!suspending) return;

    try {
      const result = await suspend(suspending.id, type, reason);
      toast.success(
        type === "hard"
          ? `${result.provider.name} hard-suspended. ${result.cancelledBookings} upcoming booking${
              result.cancelledBookings === 1 ? "" : "s"
            } cancelled and refunded — ${
              result.cancelledBookings === 1 ? "that patient has" : "those patients have"
            } been notified.`
          : `${result.provider.name} soft-suspended. Hidden from search and taking no new bookings; existing bookings are honored.`,
      );
      setSuspending(null);
      refetch();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not suspend the provider.",
      );
    }
  }

  async function lift(provider: Provider) {
    try {
      await reinstate(provider.id);
      toast.success(`${provider.name} reinstated and back in search.`);
      refetch();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not reinstate the provider.",
      );
    }
  }

  const columns = useMemo<ColumnDef<Provider, unknown>[]>(
    () => [
      {
        id: "name",
        accessorKey: "name",
        header: "Provider",
        cell: ({ row }) => {
          const provider = row.original;
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
                  {provider.phone}
                </p>
              </div>
            </div>
          );
        },
      },
      {
        id: "type",
        accessorKey: "type",
        header: "Type",
        cell: ({ row }) => <ProviderTypeBadge type={row.original.type} />,
      },
      {
        id: "governorate",
        accessorFn: (p) => getGovernorateName(p.governorateId),
        header: "Governorate",
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground">
            {getGovernorateName(row.original.governorateId)}
          </span>
        ),
      },
      {
        id: "rating",
        accessorKey: "rating",
        header: "Rating",
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Star className="size-3.5 fill-warning text-warning" aria-hidden />
            {row.original.rating.toFixed(1)}
            <span className="text-xs text-muted-foreground">
              ({formatNumber(row.original.reviewCount)})
            </span>
          </span>
        ),
      },
      {
        id: "bookings",
        accessorKey: "bookingCount",
        header: "Bookings",
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatNumber(row.original.bookingCount)}
          </span>
        ),
      },
      {
        id: "status",
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const { status, suspension } = row.original;

          return (
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-1">
                <ProviderStatusBadge status={status} />
                {suspension && <SuspensionBadge suspension={suspension} />}
              </div>

              {suspension && (
                <div className="max-w-56 text-xs text-muted-foreground">
                  <p className="truncate" title={suspension.reason}>
                    {suspension.reason}
                  </p>
                  <p className="tabular-nums">
                    {formatDateShort(suspension.suspendedAt)}
                    {suspension.type === "hard" &&
                      ` · ${suspension.cancelledBookingCount ?? 0} booking${
                        (suspension.cancelledBookingCount ?? 0) === 1 ? "" : "s"
                      } refunded`}
                  </p>
                </div>
              )}
            </div>
          );
        },
      },
      {
        id: "joined",
        accessorKey: "joinedAt",
        header: "Joined",
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground">
            {formatDateShort(row.original.joinedAt)}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => {
          const provider = row.original;

          const isSuspended = provider.status === "suspended";

          return (
            <div className="flex items-center justify-end gap-1.5">
              {!isSuspended && provider.status !== "approved" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg"
                  disabled={busy}
                  onClick={() => changeStatus(provider, "approved")}
                >
                  <CircleCheck className="size-3.5" />
                  Approve
                </Button>
              )}

              {!isSuspended && provider.status !== "rejected" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-lg"
                  disabled={busy}
                  onClick={() => setConfirming({ provider, status: "rejected" })}
                >
                  <CircleX className="size-3.5" />
                  Reject
                </Button>
              )}

              {isSuspended ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg"
                  disabled={busy}
                  onClick={() => lift(provider)}
                >
                  <RotateCcw className="size-3.5" />
                  Reinstate
                </Button>
              ) : (
                <Button
                  variant="destructive"
                  size="sm"
                  className="rounded-lg"
                  disabled={busy}
                  onClick={() => setSuspending(provider)}
                >
                  <Ban className="size-3.5" />
                  Suspend
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [busy],
  );

  const pendingCount = pendingSet?.total ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Providers</h2>
          <p className="text-sm text-muted-foreground">
            {data
              ? `${data.total} provider${data.total === 1 ? "" : "s"} matching the current filters`
              : "Doctors, labs and radiology centers"}
          </p>
        </div>
        {busy && (
          <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Saving…
          </span>
        )}
      </div>

      {pendingCount > 0 && (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-warning/15 text-warning">
                <Hourglass className="size-5" />
              </div>
              <div>
                <p className="font-semibold">
                  {pendingCount} provider{pendingCount === 1 ? "" : "s"} awaiting
                  approval
                </p>
                <p className="text-sm text-muted-foreground">
                  New listings stay hidden from search until you review them.
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              className="h-10 shrink-0 rounded-xl px-4"
              onClick={() => {
                setStatus("pending");
                setType("");
                setGovernorateId("");
              }}
              disabled={status === "pending"}
            >
              Review pending
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <TableSkeleton rows={8} columns={7} />
      ) : error ? (
        <ErrorState
          title="Couldn't load providers"
          description={error.message}
          onRetry={refetch}
        />
      ) : (
        <DataTable
          columns={columns}
          data={data?.items ?? []}
          searchPlaceholder="Search provider, address or phone…"
          pageSize={10}
          emptyTitle="No providers found"
          emptyDescription="Try a different search term, type, status or governorate."
          toolbar={
            <>
              <AppSelect
                value={type}
                onValueChange={setType}
                options={TYPE_OPTIONS}
                emptyOption="All types"
                aria-label="Filter by type"
                className="h-10 w-40"
              />
              <AppSelect
                value={status}
                onValueChange={setStatus}
                options={STATUS_OPTIONS}
                emptyOption="All statuses"
                aria-label="Filter by status"
                className="h-10 w-40"
              />
              <AppSelect
                value={governorateId}
                onValueChange={setGovernorateId}
                options={GOVERNORATE_OPTIONS}
                emptyOption="All governorates"
                aria-label="Filter by governorate"
                className="h-10 w-44"
              />
            </>
          }
        />
      )}

      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={`Reject ${confirming?.provider.name ?? "this provider"}?`}
        description="The application is declined and the listing stays hidden. You can approve them later if they reapply."
        confirmLabel="Reject provider"
        isPending={isPending}
        onConfirm={() => {
          if (confirming) void changeStatus(confirming.provider, confirming.status);
        }}
      />

      <SuspendDialog
        provider={suspending}
        open={suspending !== null}
        onOpenChange={(open) => !open && setSuspending(null)}
        isPending={isSuspending}
        onConfirm={(type, reason) => void applySuspension(type, reason)}
      />
    </div>
  );
}
