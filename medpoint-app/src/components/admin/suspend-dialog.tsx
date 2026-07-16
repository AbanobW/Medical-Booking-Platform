"use client";

import { useTranslations } from "next-intl";
import { AlertTriangle, Ban, Loader2, PauseCircle } from "lucide-react";
import { useEffect, useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { useDomain } from "@/lib/i18n/use-format";
import { useLabels } from "@/lib/i18n/use-labels";
import type { Provider, SuspensionType } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Suspension is a decision with two very different consequences (§13).
 *
 * Soft: the provider disappears from search and takes no new bookings, but the
 * patients who already booked keep their appointments. Hard: reserved for a
 * credential problem or fraud — every upcoming booking is cancelled, refunded in
 * full, and the patients are notified so they can rebook elsewhere.
 *
 * The dialog spells that out, and refuses to proceed without a reason, because
 * the reason is what the affected patients are eventually told.
 */
export function SuspendDialog({
  provider,
  open,
  onOpenChange,
  isPending,
  onConfirm,
}: {
  provider: Provider | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isPending: boolean;
  onConfirm: (type: SuspensionType, reason: string) => void;
}) {
  const t = useTranslations("admin");
  const tCommon = useTranslations("common");
  const L = useLabels();
  const { named } = useDomain();

  const [type, setType] = useState<SuspensionType>("soft");
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);

  // Every provider gets a clean form — a reason must never leak between rows.
  useEffect(() => {
    if (open) {
      setType("soft");
      setReason("");
      setTouched(false);
    }
  }, [open, provider?.id]);

  const trimmed = reason.trim();
  const isValid = trimmed.length >= 10;

  const OPTIONS: {
    value: SuspensionType;
    icon: typeof Ban;
    title: string;
    impact: string;
  }[] = [
    {
      value: "soft",
      icon: PauseCircle,
      title: t("suspend.soft.title"),
      impact: t("suspend.soft.impact"),
    },
    {
      value: "hard",
      icon: Ban,
      title: t("suspend.hard.title"),
      impact: t("suspend.hard.impact"),
    },
  ];

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("suspend.title", {
              name: provider ? named(provider) : t("suspend.fallbackName"),
            })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t("suspend.description")}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-5">
          <RadioGroup
            value={type}
            onValueChange={(value: string | null) =>
              setType((value as SuspensionType | null) ?? "soft")
            }
            className="space-y-3"
          >
            {OPTIONS.map((option) => (
              <div
                key={option.value}
                className={cn(
                  "flex gap-3 rounded-xl border p-3 transition-colors",
                  type === option.value && "border-primary bg-accent/40",
                  option.value === "hard" &&
                    type === "hard" &&
                    "border-destructive bg-destructive/5",
                )}
              >
                <RadioGroupItem
                  value={option.value}
                  id={`suspension-${option.value}`}
                  className="mt-1"
                />
                <div className="space-y-1">
                  <Label
                    htmlFor={`suspension-${option.value}`}
                    className="flex cursor-pointer items-center gap-1.5 font-medium"
                  >
                    <option.icon
                      className={cn(
                        "size-4",
                        option.value === "hard"
                          ? "text-destructive"
                          : "text-warning",
                      )}
                      aria-hidden
                    />
                    {option.title}
                  </Label>
                  <p className="text-sm text-muted-foreground">{option.impact}</p>
                  <p className="text-xs text-muted-foreground">
                    {L.suspension(option.value)}
                  </p>
                </div>
              </div>
            ))}
          </RadioGroup>

          {type === "hard" && (
            <p className="flex items-start gap-2 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              {t("suspend.hardWarning")}
            </p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="suspension-reason" className="text-sm font-medium">
              {t("suspend.reasonLabel")}
            </Label>
            <Textarea
              id="suspension-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              onBlur={() => setTouched(true)}
              rows={3}
              placeholder={t("suspend.reasonPlaceholder")}
              className="rounded-xl"
              aria-invalid={touched && !isValid}
            />
            <p
              className={cn(
                "text-xs",
                touched && !isValid
                  ? "text-destructive"
                  : "text-muted-foreground",
              )}
            >
              {touched && !isValid
                ? t("suspend.reasonError")
                : t("suspend.reasonHint")}
            </p>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>
            {tCommon("actions.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isPending || !isValid}
            onClick={(event) => {
              if (!isValid) {
                event.preventDefault();
                setTouched(true);
                return;
              }
              onConfirm(type, trimmed);
            }}
          >
            {isPending && <Loader2 className="size-4 animate-spin" />}
            {type === "hard" ? t("suspend.confirmHard") : t("suspend.confirmSoft")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
