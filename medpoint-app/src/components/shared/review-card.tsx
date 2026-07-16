"use client";

import { CheckCircle2, ThumbsUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { RatingStars } from "@/components/shared/rating";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useFormat } from "@/lib/i18n/use-format";
import { cn } from "@/lib/utils";
import type { Review } from "@/lib/types";

export function ReviewCard({
  review,
  actions,
  className,
}: {
  review: Review;
  /** Owner-only controls (edit / delete), rendered top-right. */
  actions?: React.ReactNode;
  className?: string;
}) {
  const t = useTranslations("common");
  const { timeAgo, initialsOf, formatNumber } = useFormat();
  const [helpful, setHelpful] = useState(review.helpfulCount);
  const [voted, setVoted] = useState(false);

  return (
    <Card className={cn("border-border/60", className)}>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start gap-3">
          <Avatar className="size-10 shrink-0">
            <AvatarImage src={review.patientAvatar} alt={review.patientName} />
            <AvatarFallback>{initialsOf(review.patientName)}</AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{review.patientName}</span>
              {review.isVerified && (
                <Badge
                  variant="secondary"
                  className="gap-1 bg-success/10 font-normal text-success"
                >
                  <CheckCircle2 className="size-3" />
                  {t("review.verifiedVisit")}
                </Badge>
              )}
            </div>
            <div className="mt-1 flex items-center gap-2">
              <RatingStars value={review.rating} size="sm" precise={false} />
              <span className="text-xs text-muted-foreground">
                {timeAgo(review.createdAt)}
              </span>
            </div>
          </div>

          {actions && <div className="shrink-0">{actions}</div>}
        </div>

        <p className="text-sm leading-relaxed text-foreground/90">
          {review.comment}
        </p>

        {review.reply && (
          <div className="rounded-xl border-s-2 border-primary bg-accent/50 p-4">
            <p className="text-xs font-semibold text-primary">
              {t("review.providerResponse")}
            </p>
            <p className="mt-1 text-sm text-foreground/80">
              {review.reply.comment}
            </p>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {timeAgo(review.reply.createdAt)}
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            // Local-only vote — a real API would persist this.
            setHelpful((n) => (voted ? n - 1 : n + 1));
            setVoted((v) => !v);
          }}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            voted ? "text-primary" : "text-muted-foreground",
          )}
        >
          <ThumbsUp className={cn("size-3.5", voted && "fill-primary/20")} />
          {t("review.helpful", { count: formatNumber(helpful) })}
        </button>
      </CardContent>
    </Card>
  );
}
