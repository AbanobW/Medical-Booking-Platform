"use client";

import { useTranslations } from "next-intl";
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
  label,
  placeholder,
  confirmLabel,
  cancelLabel,
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
  const t = useTranslations("provider");
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  const tooShort = reason.trim().length < 5;

  const labelText = label ?? t("reasonDialog.label");
  const placeholderText = placeholder ?? t("reasonDialog.placeholder");
  const confirmText = confirmLabel ?? t("reasonDialog.confirm");
  const cancelText = cancelLabel ?? t("reasonDialog.goBack");

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
          <Label htmlFor="cancel-reason">{labelText}</Label>
          <Textarea
            id="cancel-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={placeholderText}
            className="rounded-xl"
          />
          <p className="text-xs text-muted-foreground">
            {tooShort
              ? t("reasonDialog.tooShort")
              : t("reasonDialog.willSee")}
          </p>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>{cancelText}</AlertDialogCancel>
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
            {isPending ? t("reasonDialog.working") : confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
