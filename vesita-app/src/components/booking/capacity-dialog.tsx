"use client";

import { AlertTriangle, CalendarClock, Loader2, Users } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useFormat } from "@/lib/i18n/use-format";
import { useLabels } from "@/lib/i18n/use-labels";
import type { CapacityType, TimeSlot } from "@/lib/types";

export interface CapacityConflict {
  kind: "comfort_busy" | "strict_full";
  message: string;
  detail: {
    capacityType: CapacityType;
    queueNumber?: number;
    estimatedTime?: string;
    nextSlot?: TimeSlot;
  };
}

/**
 * The last-place race, resolved for the patient (§6, Appendix A).
 *
 * The patient who loses the race never sees an error. Under a **comfort** limit
 * the session is merely busy — they are shown exactly where they would land and
 * consent to it themselves (`acceptOverCapacity`). Under a **strict** limit the
 * place genuinely does not exist and is never exceeded, so they are handed the
 * next one instead. Either way the dialog names the limit they are up against
 * and offers a real next step.
 */
export function CapacityDialog({
  conflict,
  isPending,
  onBookAnyway,
  onTakeNextSlot,
  onPickAnother,
  onOpenChange,
}: {
  conflict: CapacityConflict | null;
  isPending: boolean;
  onBookAnyway: () => void;
  onTakeNextSlot: (slot: TimeSlot) => void;
  onPickAnother: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("booking");
  const { formatDateShort, formatTime, formatNumber } = useFormat();
  const L = useLabels();

  const next = conflict?.detail.nextSlot;
  const isComfort = conflict?.kind === "comfort_busy";

  /** A queue number only exists for a doctor's session (§5). */
  const queueNumber = conflict?.detail.queueNumber;
  const isSession = queueNumber !== undefined;

  const nextLabel = next
    ? `${formatDateShort(next.date)}, ${formatTime(next.time)}`
    : undefined;

  const title = isComfort
    ? isSession
      ? t("capacity.busySessionTitle")
      : t("capacity.busySlotTitle")
    : isSession
      ? t("capacity.fullSessionTitle")
      : t("capacity.fullSlotTitle");

  const body = isComfort
    ? queueNumber === undefined
      ? t("capacity.busyGeneric")
      : conflict?.detail.estimatedTime
        ? t("capacity.busyQueueWithTime", {
            number: formatNumber(queueNumber),
            time: formatTime(conflict.detail.estimatedTime),
          })
        : t("capacity.busyQueue", { number: formatNumber(queueNumber) })
    : t("capacity.fullBody");

  const follow = nextLabel
    ? isComfort
      ? isSession
        ? t("capacity.busyNextSession", { when: nextLabel })
        : t("capacity.busyNextSlot", { when: nextLabel })
      : t("capacity.fullNext", { when: nextLabel })
    : undefined;

  return (
    <AlertDialog open={!!conflict} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            {isComfort ? (
              <Users className="text-warning" />
            ) : (
              <AlertTriangle className="text-destructive" />
            )}
          </AlertDialogMedia>

          <AlertDialogTitle>{title}</AlertDialogTitle>

          <AlertDialogDescription>
            {body}
            {follow && <> {follow}</>}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Name the limit the patient is actually up against (§6). */}
        {conflict && (
          <p className="rounded-xl bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            {L.capacity(conflict.detail.capacityType)}
            {isComfort && <> — {t("capacity.consent")}</>}
          </p>
        )}

        <AlertDialogFooter>
          {next ? (
            <AlertDialogCancel
              disabled={isPending}
              onClick={() => onTakeNextSlot(next)}
            >
              <CalendarClock className="size-4" />
              {isComfort
                ? t("capacity.take", { when: nextLabel! })
                : t("capacity.switch", { when: nextLabel! })}
            </AlertDialogCancel>
          ) : (
            <AlertDialogCancel disabled={isPending} onClick={onPickAnother}>
              {t("capacity.pickAnother")}
            </AlertDialogCancel>
          )}

          {isComfort ? (
            // Consent is explicit — a comfort limit is only exceeded here.
            <AlertDialogAction disabled={isPending} onClick={onBookAnyway}>
              {isPending && <Loader2 className="size-4 animate-spin" />}
              {t("capacity.bookAnyway")}
            </AlertDialogAction>
          ) : (
            <AlertDialogAction disabled={isPending} onClick={onPickAnother}>
              {t("capacity.chooseAnother")}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Defensive twin: the API refused the booking on eligibility grounds (§3). */
export function EligibilityBlockedDialog({
  violations,
  onOpenChange,
  onChoosePatient,
}: {
  violations: { code: string; message: string }[] | null;
  onOpenChange: (open: boolean) => void;
  onChoosePatient: () => void;
}) {
  const t = useTranslations("booking");
  const tCommon = useTranslations("common");

  /**
   * The API tags each violation with a stable code and an English message. The
   * code is what we translate; an unknown code falls back to the message rather
   * than to a blank line.
   */
  const describe = (violation: { code: string; message: string }) => {
    const key = `eligibilityBlocked.reason.${violation.code}`;
    return t.has(key) ? t(key) : violation.message;
  };

  return (
    <AlertDialog open={!!violations} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <AlertTriangle className="text-destructive" />
          </AlertDialogMedia>
          <AlertDialogTitle>{t("eligibilityBlocked.title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("eligibilityBlocked.description")}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <ul className="space-y-2 text-sm">
          {(violations ?? []).map((violation, i) => (
            <li key={`${violation.code}-${i}`} className="flex items-start gap-2">
              <span
                className="mt-1.5 size-1.5 shrink-0 rounded-full bg-destructive"
                aria-hidden
              />
              {describe(violation)}
            </li>
          ))}
        </ul>

        <AlertDialogFooter>
          <AlertDialogCancel>{tCommon("actions.close")}</AlertDialogCancel>
          <AlertDialogAction onClick={onChoosePatient}>
            {t("eligibilityBlocked.choosePatient")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
