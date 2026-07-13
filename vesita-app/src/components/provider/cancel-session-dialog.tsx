"use client";

import { AlertTriangle, CalendarX2, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { ReasonDialog } from "@/components/provider/reason-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AppSelect } from "@/components/ui/app-select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useMutation } from "@/hooks/use-async";
import { cancelSession } from "@/lib/api/bookings";
import { formatDateShort, formatTime } from "@/lib/format";
import { isHold, schedulingModeFor, type Booking, type Provider } from "@/lib/types";

interface Session {
  key: string;
  branchId: string;
  branchName: string;
  date: string;
  time: string;
  bookings: Booking[];
}

/** Live bookings, grouped into the sessions/slots they sit in. */
function sessionsFrom(provider: Provider, bookings: Booking[], today: string): Session[] {
  const branchName = (id?: string) =>
    provider.branches.find((b) => b.id === id)?.name ?? "Main branch";

  const map = new Map<string, Session>();

  for (const booking of bookings) {
    if (booking.status !== "confirmed" && !isHold(booking.status)) continue;
    if (booking.date < today) continue;

    const branchId = booking.branchId ?? provider.branches[0]?.id ?? "";
    const key = `${branchId}|${booking.date}|${booking.time}`;

    const existing = map.get(key);
    if (existing) {
      existing.bookings.push(booking);
      continue;
    }

    map.set(key, {
      key,
      branchId,
      branchName: branchName(booking.branchId),
      date: booking.date,
      time: booking.time,
      bookings: [booking],
    });
  }

  return [...map.values()].sort((a, b) =>
    `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`),
  );
}

/**
 * Cancelling a whole session (§8) — the doctor who falls ill.
 *
 * Every affected booking is cancelled on the provider's behalf and refunded in
 * full. Patients are notified and rebook themselves: they are deliberately not
 * moved to another session, which would overload it and confuse people about
 * their new time. The dialog states all of that before anything happens.
 */
export function CancelSessionDialog({
  provider,
  bookings,
  today,
  onCancelled,
}: {
  provider: Provider;
  /** The provider's bookings — the affected patients are counted from these. */
  bookings: Booking[];
  /** Today, from the fixed dataset anchor. */
  today: string;
  onCancelled: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState("");

  const cancel = useMutation(cancelSession);

  const sessions = useMemo(
    () => sessionsFrom(provider, bookings, today),
    [provider, bookings, today],
  );

  const noun = schedulingModeFor(provider.type) === "session" ? "session" : "slot";

  const options = sessions.map((s) => ({
    value: s.key,
    label: `${formatDateShort(s.date)} · ${formatTime(s.time)} · ${s.branchName} — ${s.bookings.length} patient${s.bookings.length === 1 ? "" : "s"}`,
  }));

  const session = sessions.find((s) => s.key === selected);

  async function onConfirm(reason: string) {
    if (!session) return;

    try {
      const result = await cancel.mutate(
        provider.id,
        session.branchId,
        session.date,
        session.time,
        reason,
      );
      toast.success(
        `${noun === "session" ? "Session" : "Slot"} cancelled — ${result.cancelled} patient${result.cancelled === 1 ? "" : "s"} notified and refunded in full.`,
      );
      setSelected("");
      setOpen(false);
      onCancelled();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : `Couldn't cancel this ${noun}.`,
      );
    }
  }

  return (
    <>
      <Button
        variant="outline"
        className="h-10 rounded-xl px-4"
        onClick={() => setOpen(true)}
      >
        <CalendarX2 className="size-4" />
        Cancel a {noun}
      </Button>

      <Dialog open={open} onOpenChange={(next: boolean) => setOpen(next)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Cancel a whole {noun}</DialogTitle>
            <DialogDescription>
              Use this when you cannot run a {noun} at all — illness, an
              emergency, a closure. Every patient in it is cancelled and refunded.
            </DialogDescription>
          </DialogHeader>

          {sessions.length === 0 ? (
            <Alert>
              <CalendarX2 className="size-4" />
              <AlertTitle>Nothing to cancel</AlertTitle>
              <AlertDescription>
                You have no upcoming {noun}s with patients booked into them.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="session-pick">Which {noun}?</Label>
                <AppSelect
                  id="session-pick"
                  value={selected}
                  onValueChange={setSelected}
                  options={options}
                  placeholder={`Pick the ${noun} you cannot run`}
                  className="h-10"
                />
              </div>

              {session && (
                <>
                  <div className="rounded-2xl border bg-card p-4">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      <Users className="size-4 text-muted-foreground" />
                      {session.bookings.length} patient
                      {session.bookings.length === 1 ? "" : "s"} affected
                    </p>
                    <ul className="mt-3 space-y-1.5">
                      {session.bookings.map((booking) => (
                        <li
                          key={booking.id}
                          className="flex items-center justify-between gap-3 text-sm"
                        >
                          <span className="truncate">
                            {booking.patientInfo.fullName}
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                            {booking.queueNumber
                              ? `Queue #${booking.queueNumber}`
                              : formatTime(booking.time)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <Alert variant="destructive">
                    <AlertTriangle className="size-4" />
                    <AlertTitle>What happens when you confirm</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc space-y-1 pl-4">
                        <li>
                          All {session.bookings.length} booking
                          {session.bookings.length === 1 ? " is" : "s are"}{" "}
                          cancelled on your behalf, and any booking fee paid is
                          refunded in full — automatically.
                        </li>
                        <li>
                          Every patient is notified straight away and rebooks
                          themselves. They are <strong>not</strong> moved to
                          another {noun}: that would overload it and leave people
                          unsure of their time.
                        </li>
                        <li>
                          Provider-initiated cancellations are tracked and{" "}
                          <strong>affect your standing on the platform</strong>.
                        </li>
                      </ul>
                    </AlertDescription>
                  </Alert>
                </>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              className="h-10 rounded-xl px-4"
            >
              Keep the {noun}
            </Button>

            <ReasonDialog
              trigger={
                <Button
                  variant="destructive"
                  disabled={!session || cancel.isPending}
                  className="h-10 rounded-xl px-4"
                >
                  <CalendarX2 className="size-4" />
                  Cancel this {noun}
                </Button>
              }
              title={`Cancel this ${noun} for ${session?.bookings.length ?? 0} patient${session?.bookings.length === 1 ? "" : "s"}?`}
              description={
                session
                  ? `${formatDateShort(session.date)} at ${formatTime(session.time)}, ${session.branchName}. Everyone booked in is cancelled and refunded in full, and this counts against your standing.`
                  : ""
              }
              label="Why can't you run it?"
              placeholder="I'm unwell and the clinic is closed this evening."
              confirmLabel={`Cancel ${noun} and refund everyone`}
              cancelLabel="Go back"
              isPending={cancel.isPending}
              onConfirm={onConfirm}
            />
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
