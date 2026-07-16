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

/**
 * A confirm-before-you-destroy dialog.
 *
 * Base UI's `AlertDialogAction` is a plain button (only `Cancel` is a close),
 * so the open state is owned here and closed once the action resolves.
 */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  cancelLabel,
  isPending = false,
  onConfirm,
}: {
  trigger: React.ReactElement;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isPending?: boolean;
  onConfirm: () => void | Promise<void>;
}) {
  const t = useTranslations("provider");
  const tCommon = useTranslations("common");
  const [open, setOpen] = useState(false);

  const confirmText = confirmLabel ?? tCommon("actions.confirm");
  const cancelText = cancelLabel ?? t("confirmDialog.keep");

  return (
    <AlertDialog open={open} onOpenChange={(next: boolean) => setOpen(next)}>
      <AlertDialogTrigger render={trigger} />

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>{cancelText}</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isPending}
            onClick={async () => {
              await onConfirm();
              setOpen(false);
            }}
          >
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
