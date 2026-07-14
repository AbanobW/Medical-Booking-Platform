"use client";

import {
  CheckCheck,
  ClipboardList,
  Hourglass,
  Info,
  UserX,
  Wallet,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import {
  BookingStatusBadge,
  LongWaitBadge,
  OverCapacityBadge,
  PaymentStatusBadge,
} from "@/components/provider/badges";
import { CancelSessionDialog } from "@/components/provider/cancel-session-dialog";
import { ReasonDialog } from "@/components/provider/reason-dialog";
import { useCurrentProvider } from "@/components/provider/use-current-provider";
import { DataTable, type ColumnDef } from "@/components/shared/data-table";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/shared/states";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAsync, useMutation } from "@/hooks/use-async";
import {
  cancelByProvider,
  getBookings,
  markCompleted,
  markNoShow,
  processRefund,
} from "@/lib/api/bookings";
import { todayISO } from "@/lib/data/seed";
import { useApiError } from "@/lib/i18n/use-api-error";
import { useDomain, useFormat } from "@/lib/i18n/use-format";
import { useLabels } from "@/lib/i18n/use-labels";
import {
  canTransition,
  isHold,
  schedulingModeFor,
  type Booking,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Tabs — the nine states (§7), grouped the way a provider thinks about them.
// ---------------------------------------------------------------------------

type TabKey =
  | "confirmed"
  | "holds"
  | "completed"
  | "no_show"
  | "cancelled"
  | "refunds"
  | "all";

const TABS: { key: TabKey; match: (b: Booking) => boolean }[] = [
  { key: "confirmed", match: (b) => b.status === "confirmed" },
  { key: "holds", match: (b) => isHold(b.status) },
  { key: "completed", match: (b) => b.status === "completed" },
  { key: "no_show", match: (b) => b.status === "no_show" },
  {
    key: "cancelled",
    match: (b) =>
      b.status === "cancelled_by_patient" || b.status === "cancelled_by_provider",
  },
  {
    key: "refunds",
    match: (b) => b.status === "refund_pending" || b.status === "refunded",
  },
  { key: "all", match: () => true },
];

/**
 * A missed visit can only be recorded *after* the session has ended (§8).
 *
 * The API enforces this too — the button is disabled rather than left to fail,
 * so the rule is visible instead of only being punished.
 */
function sessionHasEnded(booking: Booking): boolean {
  return new Date(`${booking.date}T${booking.time}:00.000Z`).getTime() <= Date.now();
}

export default function ProviderBookingsPage() {
  const t = useTranslations("provider");
  const describeError = useApiError();
  const { formatDateShort, formatTime, formatEGP } = useFormat();
  const { bookingServiceName } = useDomain();
  const L = useLabels();

  const { providerId, provider } = useCurrentProvider();
  const [tab, setTab] = useState<TabKey>("confirmed");

  // Everything is loaded once: the tabs are counted from it, and the session
  // cancellation dialog counts the affected patients from the same list.
  const bookings = useAsync(
    () => getBookings({ providerId, page: 1, pageSize: 500 }),
    [providerId],
  );

  const complete = useMutation(markCompleted);
  const noShow = useMutation(markNoShow);
  const cancel = useMutation(cancelByProvider);
  const refund = useMutation(processRefund);

  const isPending =
    complete.isPending || noShow.isPending || cancel.isPending || refund.isPending;

  const all = useMemo(() => bookings.data?.items ?? [], [bookings.data]);
  const rows = useMemo(
    () => all.filter(TABS.find((entry) => entry.key === tab)!.match),
    [all, tab],
  );

  const branchName = useMemo(() => {
    const names = new Map(
      (provider?.branches ?? []).map((b) => [b.id, b.name] as const),
    );
    return (id?: string) => (id ? (names.get(id) ?? "—") : "—");
  }, [provider]);

  const isDoctor = provider ? schedulingModeFor(provider.type) === "session" : false;

  async function run(action: () => Promise<unknown>, message: string) {
    try {
      await action();
      bookings.refetch();
      toast.success(message);
    } catch (error) {
      toast.error(describeError(error));
    }
  }

  const columns = useMemo<ColumnDef<Booking, unknown>[]>(
    () => [
      {
        accessorFn: (row) => row.patientInfo.fullName,
        id: "patient",
        header: t("bookings.columns.patient"),
        cell: ({ row }) => (
          <div className="min-w-0 space-y-1">
            <p className="font-medium">{row.original.patientInfo.fullName}</p>
            <p className="text-xs text-muted-foreground">
              <span className="ltr-nums">{row.original.patientInfo.phone}</span>
              {row.original.patientInfo.bookingForSomeoneElse &&
                ` · ${t("bookings.bookedByFamily")}`}
            </p>
            {row.original.longWaitReported && <LongWaitBadge />}
          </div>
        ),
      },
      {
        accessorKey: "serviceName",
        header: t("bookings.columns.service"),
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate">{bookingServiceName(row.original)}</p>
            <p className="text-xs text-muted-foreground">{row.original.reference}</p>
          </div>
        ),
      },
      {
        accessorFn: (row) => `${row.date} ${row.time}`,
        id: "when",
        header: isDoctor
          ? t("bookings.columns.whenSession")
          : t("bookings.columns.whenSlot"),
        cell: ({ row }) => {
          const booking = row.original;
          return (
            <div className="whitespace-nowrap">
              <p>{formatDateShort(booking.date)}</p>
              <p className="text-xs text-muted-foreground tabular-nums">
                {formatTime(booking.time)}
              </p>
              {booking.queueNumber !== undefined && (
                <p className="mt-1 text-xs tabular-nums">
                  <Badge variant="outline" className="font-normal">
                    {booking.estimatedTime
                      ? t("bookings.queueAt", {
                          number: booking.queueNumber,
                          time: formatTime(booking.estimatedTime),
                        })
                      : t("bookings.queue", { number: booking.queueNumber })}
                  </Badge>
                </p>
              )}
            </div>
          );
        },
      },
      {
        accessorFn: (row) => branchName(row.branchId),
        id: "branch",
        header: t("bookings.columns.branch"),
        cell: ({ row }) => (
          <span className="text-sm whitespace-nowrap">
            {branchName(row.original.branchId)}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: t("bookings.columns.status"),
        cell: ({ row }) => (
          <div className="space-y-1">
            <BookingStatusBadge status={row.original.status} />
            {row.original.overCapacity && <OverCapacityBadge />}
            {row.original.cancellationReason && (
              <p className="max-w-48 text-xs text-muted-foreground">
                {row.original.cancellationReason}
              </p>
            )}
          </div>
        ),
      },
      {
        accessorKey: "paymentStatus",
        header: t("bookings.columns.payment"),
        cell: ({ row }) => (
          <div className="space-y-1">
            <PaymentStatusBadge status={row.original.paymentStatus} />
            <p className="text-xs whitespace-nowrap text-muted-foreground">
              {L.paymentMethod(row.original.paymentMethod)}
            </p>
            {row.original.refundAmount !== undefined && (
              <p className="ltr-nums text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                {t("bookings.refundAmount", {
                  amount: formatEGP(row.original.refundAmount),
                })}
              </p>
            )}
          </div>
        ),
      },
      {
        accessorKey: "total",
        header: t("bookings.columns.total"),
        cell: ({ row }) => (
          <span className="ltr-nums font-semibold whitespace-nowrap tabular-nums">
            {formatEGP(row.original.total)}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => {
          const booking = row.original;
          const ended = sessionHasEnded(booking);

          // Only ever offer a transition the state machine actually permits.
          const canComplete = canTransition(booking.status, "completed");
          const canNoShow = canTransition(booking.status, "no_show");
          const canCancel = canTransition(booking.status, "cancelled_by_provider");
          const canRefund = canTransition(booking.status, "refunded");

          if (!canComplete && !canNoShow && !canCancel && !canRefund) {
            return (
              <span className="block text-end text-xs whitespace-nowrap text-muted-foreground">
                {isHold(booking.status)
                  ? t("bookings.awaitingPatientPayment")
                  : t("bookings.noActions")}
              </span>
            );
          }

          return (
            <div className="flex flex-wrap items-center justify-end gap-2">
              {canComplete && (
                <Button
                  size="sm"
                  disabled={isPending}
                  onClick={() =>
                    run(
                      () => complete.mutate(booking.id),
                      t("bookings.toastCompleted"),
                    )
                  }
                >
                  <CheckCheck className="size-3.5" />
                  {t("bookings.markCompleted")}
                </Button>
              )}

              {canNoShow && (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <span className="inline-flex" tabIndex={ended ? -1 : 0}>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isPending || !ended}
                          onClick={() =>
                            run(
                              () => noShow.mutate(booking.id),
                              t("bookings.toastMissed"),
                            )
                          }
                        >
                          <UserX className="size-3.5" />
                          {t("bookings.recordMissed")}
                        </Button>
                      </span>
                    }
                  />
                  <TooltipContent>
                    {ended
                      ? t("bookings.recordMissedHint")
                      : t("bookings.recordMissedDisabledHint")}
                  </TooltipContent>
                </Tooltip>
              )}

              {canCancel && (
                <ReasonDialog
                  trigger={
                    <Button variant="outline" size="sm" disabled={isPending}>
                      <X className="size-3.5" />
                      {t("bookings.cancel")}
                    </Button>
                  }
                  title={t("bookings.cancelTitle")}
                  description={t("bookings.cancelDescription", {
                    name: booking.patientInfo.fullName,
                    date: formatDateShort(booking.date),
                    time: formatTime(booking.time),
                  })}
                  consequences={
                    <Alert variant="destructive">
                      <Info className="size-4" />
                      <AlertTitle>
                        {t("bookings.cancelConsequencesTitle")}
                      </AlertTitle>
                      <AlertDescription>
                        {t("bookings.cancelConsequences")}
                      </AlertDescription>
                    </Alert>
                  }
                  confirmLabel={t("bookings.cancelConfirm")}
                  cancelLabel={t("bookings.cancelKeep")}
                  isPending={cancel.isPending}
                  onConfirm={(reason) =>
                    run(
                      () => cancel.mutate(booking.id, reason),
                      t("bookings.toastCancelled"),
                    )
                  }
                />
              )}

              {canRefund && (
                <Button
                  size="sm"
                  disabled={isPending}
                  onClick={() =>
                    run(
                      () => refund.mutate(booking.id),
                      t("bookings.toastRefunded"),
                    )
                  }
                >
                  <Wallet className="size-3.5" />
                  {t("bookings.completeRefund")}
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isPending, isDoctor, branchName, t],
  );

  return (
    <TooltipProvider delay={200}>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <Alert className="sm:max-w-2xl">
            <Hourglass className="size-4" />
            <AlertTitle>{t("bookings.missedAlertTitle")}</AlertTitle>
            <AlertDescription>
              {t.rich("bookings.missedAlertBody", {
                strong: (chunks) => <strong>{chunks}</strong>,
                em: (chunks) => <em>{chunks}</em>,
                b: (chunks) => <span className="font-medium">{chunks}</span>,
              })}
            </AlertDescription>
          </Alert>

          {provider && (
            <CancelSessionDialog
              provider={provider}
              bookings={all}
              today={todayISO()}
              onCancelled={bookings.refetch}
            />
          )}
        </div>

        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value as TabKey)}
          className="space-y-6"
        >
          <div className="overflow-x-auto">
            <TabsList>
              {TABS.map((entry) => (
                <TabsTrigger key={entry.key} value={entry.key}>
                  {t(`bookings.tabs.${entry.key}`)}
                  <span className="ms-1.5 text-xs text-muted-foreground tabular-nums">
                    {all.filter(entry.match).length}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {TABS.map((entry) => (
            <TabsContent key={entry.key} value={entry.key}>
              {bookings.isLoading && !bookings.data ? (
                <TableSkeleton rows={6} columns={7} />
              ) : bookings.error ? (
                <ErrorState
                  title={t("bookings.error")}
                  description={describeError(bookings.error)}
                  onRetry={bookings.refetch}
                />
              ) : rows.length === 0 ? (
                <EmptyState
                  icon={ClipboardList}
                  title={t(`bookings.empty.${entry.key}`)}
                  description={t("bookings.emptyDescription")}
                />
              ) : (
                <DataTable
                  columns={columns}
                  data={rows}
                  searchPlaceholder={t("bookings.searchPlaceholder")}
                  pageSize={10}
                  emptyTitle={t("bookings.noMatches")}
                />
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </TooltipProvider>
  );
}
