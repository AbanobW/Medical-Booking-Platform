"use client";

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
import { SUSPENSION_LABELS, type Provider, type SuspensionType } from "@/lib/types";
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
      title: "Soft suspension",
      impact:
        "Hidden from search and blocked from taking new bookings. Bookings that already exist are honored — patients who booked keep their appointment.",
    },
    {
      value: "hard",
      icon: Ban,
      title: "Hard suspension",
      impact:
        "Everything a soft suspension does, and every upcoming booking is cancelled, refunded in full, and the affected patients are notified so they can rebook elsewhere. Use for credential problems or fraud.",
    },
  ];

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>
            Suspend {provider?.name ?? "this provider"}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Choose the form of suspension. The two differ in exactly one way that
            matters: what happens to the patients who have already booked.
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
                    {SUSPENSION_LABELS[option.value]}
                  </p>
                </div>
              </div>
            ))}
          </RadioGroup>

          {type === "hard" && (
            <p className="flex items-start gap-2 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              This cancels and refunds every upcoming booking with this provider.
              It cannot be undone by reinstating them.
            </p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="suspension-reason" className="text-sm font-medium">
              Reason (required)
            </Label>
            <Textarea
              id="suspension-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              onBlur={() => setTouched(true)}
              rows={3}
              placeholder="e.g. Medical syndicate registration could not be verified."
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
                ? "Give a reason of at least 10 characters."
                : "Recorded against the suspension, and used in what the affected patients are told."}
            </p>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
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
            {type === "hard" ? "Suspend, cancel & refund" : "Suspend provider"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
