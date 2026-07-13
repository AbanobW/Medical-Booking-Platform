"use client";

import { AlertTriangle, CalendarClock, Loader2, Users } from "lucide-react";

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
import { formatDateShort, formatTime } from "@/lib/format";
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
 * The patient who loses the race never sees an error. Under a comfort limit the
 * session is merely busy — they are shown exactly where they would land and
 * decide for themselves. Under a strict limit the place genuinely does not
 * exist, and they are handed the next one instead.
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
  const next = conflict?.detail.nextSlot;

  const nextLabel = next
    ? `${formatDateShort(next.date)}, ${formatTime(next.time)}`
    : undefined;

  return (
    <AlertDialog open={!!conflict} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            {conflict?.kind === "comfort_busy" ? (
              <Users className="text-warning" />
            ) : (
              <AlertTriangle className="text-destructive" />
            )}
          </AlertDialogMedia>

          <AlertDialogTitle>
            {conflict?.kind === "comfort_busy"
              ? "This session is busy"
              : "This session is full"}
          </AlertDialogTitle>

          <AlertDialogDescription>
            {conflict?.kind === "comfort_busy" ? (
              <>
                {conflict.detail.queueNumber !== undefined ? (
                  <>
                    You&apos;d be #{conflict.detail.queueNumber}
                    {conflict.detail.estimatedTime
                      ? `, seen around ~${formatTime(conflict.detail.estimatedTime)}`
                      : ""}
                    . You can still book — it just means a longer wait.
                  </>
                ) : (
                  conflict.message
                )}
                {nextLabel && (
                  <>
                    {" "}
                    The next session is {nextLabel} if you&apos;d rather not wait.
                  </>
                )}
              </>
            ) : (
              <>
                {conflict?.message ??
                  "This place has just been taken and cannot be exceeded."}
                {nextLabel && <> Next available: {nextLabel}.</>}
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          {next ? (
            <AlertDialogCancel
              disabled={isPending}
              onClick={() => onTakeNextSlot(next)}
            >
              <CalendarClock className="size-4" />
              {conflict?.kind === "comfort_busy"
                ? `Take ${nextLabel}`
                : `Switch to ${nextLabel}`}
            </AlertDialogCancel>
          ) : (
            <AlertDialogCancel disabled={isPending} onClick={onPickAnother}>
              Pick another time
            </AlertDialogCancel>
          )}

          {conflict?.kind === "comfort_busy" ? (
            <AlertDialogAction disabled={isPending} onClick={onBookAnyway}>
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Book anyway
            </AlertDialogAction>
          ) : (
            <AlertDialogAction disabled={isPending} onClick={onPickAnother}>
              Choose another time
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
  return (
    <AlertDialog open={!!violations} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <AlertTriangle className="text-destructive" />
          </AlertDialogMedia>
          <AlertDialogTitle>This booking can&apos;t go ahead</AlertDialogTitle>
          <AlertDialogDescription>
            The selected patient does not meet this service&apos;s requirements.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <ul className="space-y-2 text-sm">
          {(violations ?? []).map((violation, i) => (
            <li key={`${violation.code}-${i}`} className="flex items-start gap-2">
              <span
                className="mt-1.5 size-1.5 shrink-0 rounded-full bg-destructive"
                aria-hidden
              />
              {violation.message}
            </li>
          ))}
        </ul>

        <AlertDialogFooter>
          <AlertDialogCancel>Close</AlertDialogCancel>
          <AlertDialogAction onClick={onChoosePatient}>
            Choose a different patient
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
