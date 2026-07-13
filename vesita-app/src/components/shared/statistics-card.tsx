"use client";

import { TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { formatDelta } from "@/lib/format";
import { cn } from "@/lib/utils";

const TONES = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/15 text-warning",
  info: "bg-info/10 text-info",
  destructive: "bg-destructive/10 text-destructive",
} as const;

export type StatTone = keyof typeof TONES;

interface StatisticsCardProps {
  label: string;
  value: string | number;
  /** Percentage change vs the previous period. */
  change?: number;
  /** Set when a *rise* is bad (e.g. cancellations), so colours invert. */
  invertChange?: boolean;
  icon: LucideIcon;
  tone?: StatTone;
  hint?: string;
  className?: string;
}

export function StatisticsCard({
  label,
  value,
  change,
  invertChange = false,
  icon: Icon,
  tone = "primary",
  hint,
  className,
}: StatisticsCardProps) {
  const isUp = (change ?? 0) >= 0;
  // A rise in cancellations is bad; a rise in revenue is good.
  const isGood = invertChange ? !isUp : isUp;
  const TrendIcon = isUp ? TrendingUp : TrendingDown;

  return (
    <Card className={cn("overflow-hidden transition-shadow hover:shadow-card", className)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-muted-foreground">
              {label}
            </p>
            <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight lg:text-3xl">
              {value}
            </p>
          </div>

          <div
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-xl",
              TONES[tone],
            )}
          >
            <Icon className="size-5" />
          </div>
        </div>

        {(change !== undefined || hint) && (
          <div className="mt-3 flex items-center gap-2 text-xs">
            {change !== undefined && (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-medium tabular-nums",
                  isGood
                    ? "bg-success/10 text-success"
                    : "bg-destructive/10 text-destructive",
                )}
              >
                <TrendIcon className="size-3" />
                {formatDelta(change)}
              </span>
            )}
            <span className="truncate text-muted-foreground">
              {hint ?? "vs last month"}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
