"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
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
import { GOVERNORATES } from "@/lib/data/egypt";
import { useApiError } from "@/lib/i18n/use-api-error";
import { useDomain, useFormat } from "@/lib/i18n/use-format";
import {
  PROVIDER_ROLES,
  type Provider,
  type ProviderRole,
  type ProviderStatus,
  type SuspensionType,
} from "@/lib/types";

const PROVIDER_STATUSES: ProviderStatus[] = [
  "pending",
  "approved",
  "rejected",
  "suspended",
];

/** One pagination model: fetch the filtered set, let DataTable page it. */
const FULL_PAGE = 1000;

/** Only rejection goes through the plain confirm gate — suspension has its own. */
interface PendingAction {
  provider: Provider;
  status: Extract<ProviderStatus, "rejected">;
}

export default function AdminProvidersPage() {
  const t = useTranslations("admin");
  const tCommon = useTranslations("common");
  const describeError = useApiError();
  const { formatDateShort, initialsOf, formatNumber } = useFormat();
  const { named, getGovernorateName } = useDomain();

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
      const name = named(provider);
      toast.success(
        next === "approved"
          ? t("providers.toast.approved", { name })
          : next === "rejected"
            ? t("providers.toast.rejected", { name })
            : next === "suspended"
              ? t("providers.toast.suspended", { name })
              : t("providers.toast.pending", { name }),
      );
      setConfirming(null);
      refetch();
    } catch (err) {
      toast.error(describeError(err));
    }
  }

  /**
   * §13 — the patient impact is the whole point of the distinction, so the
   * result reports it: a soft suspension leaves existing bookings alone, a hard
   * one cancels and refunds them, and we say how many patients that touched.
   */
  async function applySuspension(suspensionType: SuspensionType, reason: string) {
    if (!suspending) return;

    try {
      const result = await suspend(suspending.id, suspensionType, reason);
      const name = named(result.provider);

      toast.success(
        suspensionType === "hard"
          ? t("providers.toast.hardSuspended", {
              name,
              count: result.cancelledBookings,
            })
          : t("providers.toast.softSuspended", { name }),
      );
      setSuspending(null);
      refetch();
    } catch (err) {
      toast.error(describeError(err));
    }
  }

  async function lift(provider: Provider) {
    try {
      await reinstate(provider.id);
      toast.success(
        t("providers.toast.reinstated", { name: named(provider) }),
      );
      refetch();
    } catch (err) {
      toast.error(describeError(err));
    }
  }

  const typeOptions = useMemo(
    () =>
      PROVIDER_ROLES.map((role) => ({
        value: role,
        label: t(`providers.typeOptions.${role}`),
      })),
    [t],
  );

  const statusOptions = useMemo(
    () =>
      PROVIDER_STATUSES.map((s) => ({
        value: s,
        label: t(`badges.providerStatus.${s}`),
      })),
    [t],
  );

  const governorateOptions = useMemo(
    () =>
      GOVERNORATES.map((g) => ({
        value: g.id,
        label: getGovernorateName(g.id),
      })),
    [getGovernorateName],
  );

  const columns = useMemo<ColumnDef<Provider, unknown>[]>(
    () => [
      {
        id: "name",
        accessorFn: (p) => named(p),
        header: t("providers.columns.provider"),
        cell: ({ row }) => {
          const provider = row.original;
          return (
            <div className="flex items-center gap-3">
              <Avatar className="size-9 shrink-0 rounded-xl">
                <AvatarImage src={provider.photo} alt="" />
                <AvatarFallback className="rounded-xl text-xs">
                  {initialsOf(named(provider))}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="font-medium whitespace-nowrap">
                  {named(provider)}
                </p>
                <p className="ltr-nums truncate text-xs text-muted-foreground">
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
        header: t("providers.columns.type"),
        cell: ({ row }) => <ProviderTypeBadge type={row.original.type} />,
      },
      {
        id: "governorate",
        accessorFn: (p) => getGovernorateName(p.governorateId),
        header: t("providers.columns.governorate"),
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground">
            {getGovernorateName(row.original.governorateId)}
          </span>
        ),
      },
      {
        id: "rating",
        accessorKey: "rating",
        header: t("providers.columns.rating"),
        cell: ({ row }) => (
          <span className="ltr-nums inline-flex items-center gap-1 tabular-nums">
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
        header: t("providers.columns.bookings"),
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatNumber(row.original.bookingCount)}
          </span>
        ),
      },
      {
        id: "status",
        accessorKey: "status",
        header: t("providers.columns.status"),
        cell: ({ row }) => {
          const { status: rowStatus, suspension } = row.original;

          return (
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-1">
                <ProviderStatusBadge status={rowStatus} />
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
                      ` · ${t("providers.refunded", {
                        count: suspension.cancelledBookingCount ?? 0,
                      })}`}
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
        header: t("providers.columns.joined"),
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
                  {t("providers.actions.approve")}
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
                  {t("providers.actions.reject")}
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
                  {t("providers.actions.reinstate")}
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
                  {t("providers.actions.suspend")}
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [busy, t, named, getGovernorateName, formatDateShort, formatNumber, initialsOf],
  );

  const pendingCount = pendingSet?.total ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            {t("providers.title")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {data
              ? t("providers.count", { count: data.total })
              : t("providers.subtitle")}
          </p>
        </div>
        {busy && (
          <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {tCommon("states.saving")}
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
                  {t("providers.pending.banner", { count: pendingCount })}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("providers.pending.description")}
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
              {t("providers.pending.review")}
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <TableSkeleton rows={8} columns={7} />
      ) : error ? (
        <ErrorState
          title={t("providers.errorTitle")}
          description={describeError(error)}
          onRetry={refetch}
        />
      ) : (
        <DataTable
          columns={columns}
          data={data?.items ?? []}
          searchPlaceholder={t("providers.searchPlaceholder")}
          pageSize={10}
          emptyTitle={t("providers.emptyTitle")}
          emptyDescription={t("providers.emptyDescription")}
          toolbar={
            <>
              <AppSelect
                value={type}
                onValueChange={setType}
                options={typeOptions}
                emptyOption={t("providers.filters.allTypes")}
                aria-label={t("providers.filters.typeAria")}
                className="h-10 w-40"
              />
              <AppSelect
                value={status}
                onValueChange={setStatus}
                options={statusOptions}
                emptyOption={t("providers.filters.allStatuses")}
                aria-label={t("providers.filters.statusAria")}
                className="h-10 w-40"
              />
              <AppSelect
                value={governorateId}
                onValueChange={setGovernorateId}
                options={governorateOptions}
                emptyOption={t("providers.filters.allGovernorates")}
                aria-label={t("providers.filters.governorateAria")}
                className="h-10 w-44"
              />
            </>
          }
        />
      )}

      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={t("providers.rejectConfirm.title", {
          name: confirming
            ? named(confirming.provider)
            : t("providers.rejectConfirm.fallbackName"),
        })}
        description={t("providers.rejectConfirm.description")}
        confirmLabel={t("providers.rejectConfirm.confirmLabel")}
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
        onConfirm={(suspensionType, reason) =>
          void applySuspension(suspensionType, reason)
        }
      />
    </div>
  );
}
