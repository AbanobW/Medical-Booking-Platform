"use client";

import { Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Progress } from "@/components/ui/progress";
import { useFormat } from "@/lib/i18n/use-format";
import { cn } from "@/lib/utils";
import type { Review } from "@/lib/types";

const SIZES = {
  sm: "size-3.5",
  md: "size-4",
  lg: "size-5",
} as const;

interface RatingStarsProps {
  value: number;
  /** Renders partial stars (e.g. 4.6 → 60% of the fifth star filled). */
  precise?: boolean;
  size?: keyof typeof SIZES;
  className?: string;
}

export function RatingStars({
  value,
  precise = true,
  size = "md",
  className,
}: RatingStarsProps) {
  const t = useTranslations("common");

  return (
    <div
      className={cn("flex items-center gap-0.5", className)}
      role="img"
      aria-label={t("rating.stars", { value: value.toFixed(1) })}
    >
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = precise
          ? Math.max(0, Math.min(1, value - i))
          : value > i
            ? 1
            : 0;

        return (
          <span key={i} className="relative inline-flex">
            <Star className={cn(SIZES[size], "text-muted-foreground/30")} />
            {fill > 0 && (
              <span
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${fill * 100}%` }}
              >
                <Star
                  className={cn(SIZES[size], "fill-warning text-warning")}
                />
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}

/** The rating shown on cards: stars + score + review count. */
export function RatingBadge({
  rating,
  reviewCount,
  size = "sm",
  className,
}: {
  rating: number;
  reviewCount: number;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const { formatNumber } = useFormat();

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <RatingStars value={rating} size={size} />
      <span className="text-sm font-semibold tabular-nums">
        {rating.toFixed(1)}
      </span>
      <span className="text-xs text-muted-foreground ltr-nums">
        ({formatNumber(reviewCount)})
      </span>
    </div>
  );
}

/** Interactive star input, for the review form. */
export function RatingInput({
  value,
  onChange,
  size = "lg",
  disabled,
}: {
  value: number;
  onChange: (value: number) => void;
  size?: keyof typeof SIZES;
  disabled?: boolean;
}) {
  const t = useTranslations("common");
  const [hovered, setHovered] = useState(0);
  const active = hovered || value;

  return (
    <div className="flex items-center gap-1" onMouseLeave={() => setHovered(0)}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={disabled}
          onClick={() => onChange(star)}
          onMouseEnter={() => setHovered(star)}
          aria-label={t("rating.rate", { star })}
          className="rounded transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Star
            className={cn(
              SIZES[size],
              "transition-colors",
              star <= active
                ? "fill-warning text-warning"
                : "text-muted-foreground/30",
            )}
          />
        </button>
      ))}
    </div>
  );
}

/**
 * The rating summary card on a provider profile: headline score, distribution
 * bars, and the four sub-score averages.
 */
export function RatingCard({
  rating,
  reviewCount,
  reviews,
  className,
}: {
  rating: number;
  reviewCount: number;
  reviews: Review[];
  className?: string;
}) {
  const t = useTranslations("common");
  const { formatNumber } = useFormat();

  // Distribution across 5→1 stars, from the reviews we actually have.
  const distribution = [5, 4, 3, 2, 1].map((star) => {
    const count = reviews.filter((r) => Math.round(r.rating) === star).length;
    return {
      star,
      count,
      percent: reviews.length ? (count / reviews.length) * 100 : 0,
    };
  });

  const average = (key: keyof Review["breakdown"]) =>
    reviews.length
      ? reviews.reduce((sum, r) => sum + r.breakdown[key], 0) / reviews.length
      : 0;

  const breakdown = [
    { key: "waitingTime", label: t("rating.waitingTime"), value: average("waitingTime") },
    { key: "staff", label: t("rating.staff"), value: average("staff") },
    { key: "cleanliness", label: t("rating.cleanliness"), value: average("cleanliness") },
    {
      key: "communication",
      label: t("rating.communication"),
      value: average("communication"),
    },
  ];

  return (
    <div
      className={cn(
        "grid gap-8 rounded-2xl border bg-card p-6 shadow-soft sm:grid-cols-[auto_1fr_1fr]",
        className,
      )}
    >
      <div className="flex flex-col items-center justify-center gap-1 text-center sm:pe-8 sm:border-e">
        <span className="text-5xl font-bold tabular-nums">
          {rating.toFixed(1)}
        </span>
        <RatingStars value={rating} size="md" />
        <span className="text-sm text-muted-foreground">
          {t("rating.reviewCount", { count: reviewCount })}
        </span>
      </div>

      <div className="space-y-2">
        {distribution.map(({ star, count, percent }) => (
          <div key={star} className="flex items-center gap-3">
            <span className="w-3 shrink-0 text-xs tabular-nums text-muted-foreground">
              {star}
            </span>
            <Star className="size-3 shrink-0 fill-warning text-warning" />
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-warning transition-[width] duration-500"
                style={{ width: `${percent}%` }}
              />
            </div>
            <span className="w-8 shrink-0 text-end text-xs tabular-nums text-muted-foreground">
              {formatNumber(count)}
            </span>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {breakdown.map(({ key, label, value }) => (
          <div key={key} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{label}</span>
              <span className="font-medium tabular-nums">
                {value.toFixed(1)}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-500"
                style={{ width: `${(value / 5) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Re-exported so `Progress` stays available to consumers that import from here.
export { Progress };
