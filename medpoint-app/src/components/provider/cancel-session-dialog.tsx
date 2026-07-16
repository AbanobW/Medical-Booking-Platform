"use client";

import { AlertTriangle, CalendarX2, Users } from "lucide-react";
import { useTranslations } from "next-intl";
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
import { useApiError } from "@/lib/i18n/use-api-error";
import { useFormat } from "@/lib/i18n/use-format";
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
function sessionsFrom(
  provider: Provider,
  bookings: Booking[],
  today: string,
  fallbackBranchName: string,
): Session[] {
  const branchName = (id?: string) =>
    provider.branches.find((b) => b.id === id)?.name ?? fallbackBranchName;

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
  const t = useTranslations("provider");
  const describeError = useApiError();
  const { formatDateShort, formatTime } = useFormat();

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState("");

  const cancel = useMutation(cancelSession);

  // Doctors run sessions; labs and radiology centres run slots (§5). The two
  // read differently in Arabic, so the copy is picked per mode rather than
  // interpolating a noun into a sentence.
  const mode = schedulingModeFor(provider.type) === "session" ? "session" : "slot";
  const mainBranch = t("cancelSession.mainBranch");

  const sessions = useMemo(
    () => sessionsFrom(provider, bookings, today, mainBranch),
    [provider, bookings, today, mainBranch],
  );

  const options = sessions.map((s) => ({
    value: s.key,
    label: t("cancelSession.option", {
      date: formatDateShort(s.date),
      time: formatTime(s.time),
      branch: s.branchName,
      count: s.bookings.length,
    }),
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
        t(`cancelSession.${mode}.success`, { count: result.cancelled }),
      );
      setSelected("");
      setOpen(false);
      onCancelled();
    } catch (error) {
      toast.error(describeError(error));
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
        {t(`cancelSession.${mode}.trigger`)}
      </Button>

      <Dialog open={open} onOpenChange={(next: boolean) => setOpen(next)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t(`cancelSession.${mode}.dialogTitle`)}</DialogTitle>
            <DialogDescription>
              {t(`cancelSession.${mode}.dialogDescription`)}
            </DialogDescription>
          </DialogHeader>

          {sessions.length === 0 ? (
            <Alert>
              <CalendarX2 className="size-4" />
              <AlertTitle>{t("cancelSession.nothingTitle")}</AlertTitle>
              <AlertDescription>
                {t(`cancelSession.${mode}.nothingDescription`)}
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="session-pick">
                  {t(`cancelSession.${mode}.which`)}
                </Label>
                <AppSelect
                  id="session-pick"
                  value={selected}
                  onValueChange={setSelected}
                  options={options}
                  placeholder={t(`cancelSession.${mode}.pickPlaceholder`)}
                  className="h-10"
                />
              </div>

              {session && (
                <>
                  <div className="rounded-2xl border bg-card p-4">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      <Users className="size-4 text-muted-foreground" />
                      {t("cancelSession.affected", {
                        count: session.bookings.length,
                      })}
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
                              ? t("cancelSession.queue", {
                                  number: booking.queueNumber,
                                })
                              : formatTime(booking.time)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <Alert variant="destructive">
                    <AlertTriangle className="size-4" />
                    <AlertTitle>
                      {t("cancelSession.consequencesTitle")}
                    </AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc space-y-1 ps-4">
                        <li>
                          {t("cancelSession.allCancelled", {
                            count: session.bookings.length,
                          })}
                        </li>
                        <li>
                          {t.rich(`cancelSession.${mode}.notMoved`, {
                            strong: (chunks) => <strong>{chunks}</strong>,
                          })}
                        </li>
                        <li>
                          {t.rich("cancelSession.standing", {
                            strong: (chunks) => <strong>{chunks}</strong>,
                          })}
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
              {t(`cancelSession.${mode}.keep`)}
            </Button>

            <ReasonDialog
              trigger={
                <Button
                  variant="destructive"
                  disabled={!session || cancel.isPending}
                  className="h-10 rounded-xl px-4"
                >
                  <CalendarX2 className="size-4" />
                  {t(`cancelSession.${mode}.confirmTrigger`)}
                </Button>
              }
              title={t(`cancelSession.${mode}.confirmTitle`, {
                count: session?.bookings.length ?? 0,
              })}
              description={
                session
                  ? t("cancelSession.confirmDescription", {
                      date: formatDateShort(session.date),
                      time: formatTime(session.time),
                      branch: session.branchName,
                    })
                  : ""
              }
              label={t("cancelSession.reasonLabel")}
              placeholder={t("cancelSession.reasonPlaceholder")}
              confirmLabel={t(`cancelSession.${mode}.confirmLabel`)}
              isPending={cancel.isPending}
              onConfirm={onConfirm}
            />
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
