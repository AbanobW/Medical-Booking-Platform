"use client";

import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The default rail. The wizard passes its own list, because the preparation
 * step only exists for services that carry preparation or eligibility rules.
 */
export const BOOKING_STEPS = [
  "Patient",
  "Service",
  "Date",
  "Time",
  "Payment",
] as const;

/** Horizontal progress rail on desktop, a compact bar on mobile. */
export function StepIndicator({
  steps = BOOKING_STEPS,
  current,
  onStepClick,
  className,
}: {
  /** The labels of the steps actually in play. */
  steps?: readonly string[];
  /** Zero-based index of the active step. */
  current: number;
  /** Only completed steps are clickable — forward jumps skip validation. */
  onStepClick?: (index: number) => void;
  className?: string;
}) {
  const total = steps.length;
  const percent = Math.round(((current + 1) / total) * 100);

  return (
    <div className={cn("w-full", className)}>
      {/* Mobile: label + progress bar. */}
      <div className="sm:hidden">
        <div className="mb-2 flex items-baseline justify-between">
          <p className="text-sm font-semibold">{steps[current]}</p>
          <p className="text-xs text-muted-foreground tabular-nums">
            Step {current + 1} of {total}
          </p>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {/* Desktop: numbered rail. */}
      <ol className="hidden items-center sm:flex">
        {steps.map((label, index) => {
          const isComplete = index < current;
          const isCurrent = index === current;
          const isClickable = isComplete && !!onStepClick;

          return (
            <li key={label} className="flex flex-1 items-center last:flex-none">
              <button
                type="button"
                disabled={!isClickable}
                onClick={() => onStepClick?.(index)}
                aria-current={isCurrent ? "step" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl px-1 py-1 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  isClickable && "cursor-pointer hover:opacity-80",
                )}
              >
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-all",
                    isComplete
                      ? "border-primary bg-primary text-primary-foreground"
                      : isCurrent
                        ? "border-primary bg-primary/10 text-primary shadow-glow"
                        : "border-border bg-background text-muted-foreground",
                  )}
                >
                  {isComplete ? <Check className="size-4" /> : index + 1}
                </span>
                <span
                  className={cn(
                    "hidden whitespace-nowrap text-sm font-medium md:inline",
                    isCurrent
                      ? "text-foreground"
                      : isComplete
                        ? "text-foreground/70"
                        : "text-muted-foreground",
                  )}
                >
                  {label}
                </span>
              </button>

              {index < total - 1 && (
                <span
                  className={cn(
                    "mx-2 h-px flex-1 transition-colors",
                    index < current ? "bg-primary" : "bg-border",
                  )}
                  aria-hidden
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
