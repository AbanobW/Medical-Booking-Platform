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
import { formatDateShort, formatTime } from "@/lib/format";
import { formatEGP } from "@/lib/site";
import {
  canTransition,
  isHold,
  schedulingModeFor,
  PAYMENT_METHOD_LABELS,
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

const TABS: { key: TabKey; label: string; match: (b: Booking) => boolean }[] = [
  { key: "confirmed", label: "Confirmed", match: (b) => b.status === "confirmed" },
  { key: "holds", label: "Holds", match: (b) => isHold(b.status) },
  { key: "completed", label: "Completed", match: (b) => b.status === "completed" },
  { key: "no_show", label: "Missed visits", match: (b) => b.status === "no_show" },
  {
    key: "cancelled",
    label: "Cancelled",
    match: (b) =>
      b.status === "cancelled_by_patient" || b.status === "cancelled_by_provider",
  },
  {
    key: "refunds",
    label: "Refunds",
    match: (b) => b.status === "refund_pending" || b.status === "refunded",
  },
  { key: "all", label: "All", match: () => true },
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
    () => all.filter(TABS.find((t) => t.key === tab)!.match),
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
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't update this booking.",
      );
    }
  }

  const columns = useMemo<ColumnDef<Booking, unknown>[]>(
    () => [
      {
        accessorFn: (row) => row.patientInfo.fullName,
        id: "patient",
        header: "Patient",
        cell: ({ row }) => (
          <div className="min-w-0 space-y-1">
            <p className="font-medium">{row.original.patientInfo.fullName}</p>
            <p className="text-xs text-muted-foreground">
              {row.original.patientInfo.phone}
              {row.original.patientInfo.bookingForSomeoneElse && " · booked by family"}
            </p>
            {row.original.longWaitReported && <LongWaitBadge />}
          </div>
        ),
      },
      {
        accessorKey: "serviceName",
        header: "Service",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate">{row.original.serviceName}</p>
            <p className="text-xs text-muted-foreground">{row.original.reference}</p>
          </div>
        ),
      },
      {
        accessorFn: (row) => `${row.date} ${row.time}`,
        id: "when",
        header: isDoctor ? "Session & queue" : "Date & time",
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
                    Queue #{booking.queueNumber}
                    {booking.estimatedTime && ` · ~${formatTime(booking.estimatedTime)}`}
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
        header: "Branch",
        cell: ({ row }) => (
          <span className="text-sm whitespace-nowrap">
            {branchName(row.original.branchId)}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
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
        header: "Payment",
        cell: ({ row }) => (
          <div className="space-y-1">
            <PaymentStatusBadge status={row.original.paymentStatus} />
            <p className="text-xs whitespace-nowrap text-muted-foreground">
              {PAYMENT_METHOD_LABELS[row.original.paymentMethod]}
            </p>
            {row.original.refundAmount !== undefined && (
              <p className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                Refund {formatEGP(row.original.refundAmount)}
              </p>
            )}
          </div>
        ),
      },
      {
        accessorKey: "total",
        header: "Total",
        cell: ({ row }) => (
          <span className="font-semibold whitespace-nowrap tabular-nums">
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
              <span className="block text-right text-xs whitespace-nowrap text-muted-foreground">
                {isHold(booking.status)
                  ? "Awaiting the patient's payment"
                  : "No actions"}
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
                    run(() => complete.mutate(booking.id), "Visit marked completed.")
                  }
                >
                  <CheckCheck className="size-3.5" />
                  Mark completed
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
                              "Recorded as a missed visit.",
                            )
                          }
                        >
                          <UserX className="size-3.5" />
                          Record missed visit
                        </Button>
                      </span>
                    }
                  />
                  <TooltipContent>
                    {ended
                      ? "The patient did not arrive at all. Someone who arrived and left after a long wait is not a missed visit."
                      : "A missed visit can only be recorded once the session has ended — until then the patient may still be waiting."}
                  </TooltipContent>
                </Tooltip>
              )}

              {canCancel && (
                <ReasonDialog
                  trigger={
                    <Button variant="outline" size="sm" disabled={isPending}>
                      <X className="size-3.5" />
                      Cancel
                    </Button>
                  }
                  title="Cancel this booking?"
                  description={`${booking.patientInfo.fullName}'s appointment on ${formatDateShort(booking.date)} at ${formatTime(booking.time)} will be cancelled on your behalf.`}
                  consequences={
                    <Alert variant="destructive">
                      <Info className="size-4" />
                      <AlertTitle>What happens</AlertTitle>
                      <AlertDescription>
                        Any booking fee paid is refunded in full, automatically —
                        the patient is never out of pocket for a cancellation you
                        caused. Provider-initiated cancellations are tracked and
                        affect your standing on the platform.
                      </AlertDescription>
                    </Alert>
                  }
                  confirmLabel="Cancel booking"
                  cancelLabel="Keep booking"
                  isPending={cancel.isPending}
                  onConfirm={(reason) =>
                    run(
                      () => cancel.mutate(booking.id, reason),
                      "Booking cancelled — the patient has been notified and refunded.",
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
                      "Refund completed and returned to the patient.",
                    )
                  }
                >
                  <Wallet className="size-3.5" />
                  Complete refund
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isPending, isDoctor, branchName],
  );

  return (
    <TooltipProvider delay={200}>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <Alert className="sm:max-w-2xl">
            <Hourglass className="size-4" />
            <AlertTitle>What counts as a missed visit</AlertTitle>
            <AlertDescription>
              A missed visit means <strong>the patient never arrived</strong>. A
              patient who came, waited a long time and left is <em>not</em> a
              missed visit — that shows up here as{" "}
              <span className="font-medium">&ldquo;Left after a long wait&rdquo;</span>{" "}
              and counts against your waiting time, not against them.
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
              {TABS.map((t) => (
                <TabsTrigger key={t.key} value={t.key}>
                  {t.label}
                  <span className="ml-1.5 text-xs text-muted-foreground tabular-nums">
                    {all.filter(t.match).length}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {TABS.map((t) => (
            <TabsContent key={t.key} value={t.key}>
              {bookings.isLoading && !bookings.data ? (
                <TableSkeleton rows={6} columns={7} />
              ) : bookings.error ? (
                <ErrorState
                  title="Couldn't load your bookings"
                  description={bookings.error.message}
                  onRetry={bookings.refetch}
                />
              ) : rows.length === 0 ? (
                <EmptyState
                  icon={ClipboardList}
                  title={`No ${t.label.toLowerCase()} bookings`}
                  description="Bookings appear here as patients make them."
                />
              ) : (
                <DataTable
                  columns={columns}
                  data={rows}
                  searchPlaceholder="Search patient, service or reference…"
                  pageSize={10}
                  emptyTitle="No matching bookings"
                />
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </TooltipProvider>
  );
}
