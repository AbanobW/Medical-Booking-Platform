"use client";

import { useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * A destructive confirm that also captures *why*.
 *
 * Every provider-side cancellation is told to the patient in the notification
 * we send them (§8), so the reason is required rather than optional.
 */
export function ReasonDialog({
  trigger,
  title,
  description,
  consequences,
  label = "Reason",
  placeholder = "Tell the patient what happened.",
  confirmLabel = "Confirm",
  cancelLabel = "Go back",
  isPending = false,
  onConfirm,
}: {
  trigger: React.ReactElement;
  title: string;
  description: string;
  /** Rendered above the reason field — what will actually happen, spelled out. */
  consequences?: React.ReactNode;
  label?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isPending?: boolean;
  onConfirm: (reason: string) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  const tooShort = reason.trim().length < 5;

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next: boolean) => {
        setOpen(next);
        if (!next) setReason("");
      }}
    >
      <AlertDialogTrigger render={trigger} />

      <AlertDialogContent className="max-h-[90vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        {consequences}

        <div className="space-y-1.5">
          <Label htmlFor="cancel-reason">{label}</Label>
          <Textarea
            id="cancel-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={placeholder}
            className="rounded-xl"
          />
          <p className="text-xs text-muted-foreground">
            {tooShort
              ? "Write at least a few words — the patient is shown this."
              : "The patient will see this in their cancellation notice."}
          </p>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isPending || tooShort}
            onClick={async () => {
              if (tooShort) return;
              await onConfirm(reason.trim());
              setReason("");
              setOpen(false);
            }}
          >
            {isPending ? "Working…" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
