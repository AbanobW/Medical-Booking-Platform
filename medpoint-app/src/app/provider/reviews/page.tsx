"use client";

import { MessageSquareReply, Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { ReplyDialog } from "@/components/provider/reply-dialog";
import { useCurrentProvider } from "@/components/provider/use-current-provider";
import { RatingCard } from "@/components/shared/rating";
import { ReviewCard } from "@/components/shared/review-card";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/shared/states";
import { AppSelect } from "@/components/ui/app-select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAsync } from "@/hooks/use-async";
import { getReviewsByProvider } from "@/lib/api/engagement";
import { useApiError } from "@/lib/i18n/use-api-error";
import { useFormat } from "@/lib/i18n/use-format";
import type { Review } from "@/lib/types";

export default function ProviderReviewsPage() {
  const t = useTranslations("provider");
  const describeError = useApiError();
  const { formatNumber } = useFormat();

  const { providerId, provider } = useCurrentProvider();

  const reviews = useAsync(
    () => getReviewsByProvider(providerId),
    [providerId],
  );

  const [stars, setStars] = useState("");
  const [editing, setEditing] = useState<Review | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const starOptions = [5, 4, 3, 2, 1].map((n) => ({
    value: String(n),
    label: t("reviews.stars", { count: n }),
  }));

  const all = reviews.data ?? [];
  const filtered = stars
    ? all.filter((r) => Math.round(r.rating) === Number(stars))
    : all;

  const average = all.length
    ? +(all.reduce((sum, r) => sum + r.rating, 0) / all.length).toFixed(1)
    : (provider?.rating ?? 0);

  return (
    <div className="space-y-6">
      {reviews.isLoading && !reviews.data ? (
        <Skeleton className="h-52 w-full rounded-2xl" />
      ) : reviews.error ? (
        <ErrorState
          title={t("reviews.error")}
          description={describeError(reviews.error)}
          onRetry={reviews.refetch}
        />
      ) : (
        <>
          <RatingCard
            rating={average}
            reviewCount={all.length}
            reviews={all}
          />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {t("reviews.showing", {
                shown: formatNumber(filtered.length),
                total: all.length,
              })}
            </p>

            <div className="w-full sm:w-56">
              <AppSelect
                value={stars}
                onValueChange={setStars}
                options={starOptions}
                emptyOption={t("reviews.allRatings")}
                aria-label={t("reviews.filterAria")}
                className="h-10"
              />
            </div>
          </div>

          {all.length === 0 ? (
            <EmptyState
              icon={Star}
              title={t("reviews.emptyTitle")}
              description={t("reviews.emptyDescription")}
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Star}
              title={t("reviews.noneAtRatingTitle")}
              description={t("reviews.noneAtRatingDescription")}
              action={
                <Button
                  variant="outline"
                  className="h-10 rounded-xl px-4"
                  onClick={() => setStars("")}
                >
                  {t("reviews.clearFilter")}
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {filtered.map((review) => (
                <ReviewCard
                  key={review.id}
                  review={review}
                  actions={
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditing(review);
                        setDialogOpen(true);
                      }}
                    >
                      <MessageSquareReply className="size-3.5" />
                      {review.reply ? t("reviews.editReply") : t("reviews.reply")}
                    </Button>
                  }
                />
              ))}
            </div>
          )}
        </>
      )}

      {reviews.isLoading && !reviews.data && <ListSkeleton count={4} />}

      <ReplyDialog
        review={editing}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={reviews.refetch}
      />
    </div>
  );
}
