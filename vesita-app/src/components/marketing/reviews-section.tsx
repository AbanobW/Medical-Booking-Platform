"use client";

import { MessageSquare } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { RatingCard } from "@/components/shared/rating";
import { ReviewCard } from "@/components/shared/review-card";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { useAsync } from "@/hooks/use-async";
import { getProviderReviews } from "@/lib/api/providers";
import type { Provider } from "@/lib/types";

const PAGE = 5;

/** Rating summary + the review list, with its own loading / error / empty states. */
export function ReviewsSection({ provider }: { provider: Provider }) {
  const t = useTranslations("profile");
  const [shown, setShown] = useState(PAGE);

  const { data, error, isLoading, refetch } = useAsync(
    () => getProviderReviews(provider.id),
    [provider.id],
  );

  if (isLoading) return <ListSkeleton count={4} />;

  if (error) {
    return (
      <ErrorState
        title={t("reviews.errorTitle")}
        description={t("reviews.errorDescription")}
        onRetry={refetch}
      />
    );
  }

  const reviews = data ?? [];

  if (reviews.length === 0) {
    return (
      <EmptyState
        icon={MessageSquare}
        title={t("reviews.emptyTitle")}
        description={t("reviews.emptyDescription")}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* The summary is the provider's own averages, not ours to recompute from
          the page of reviews we happen to be holding. */}
      {provider.rating !== null && provider.reviewCount !== null && (
        <RatingCard
          rating={provider.rating}
          reviewCount={provider.reviewCount}
          reviews={reviews}
        />
      )}

      <div className="space-y-4">
        {reviews.slice(0, shown).map((review) => (
          <ReviewCard key={review.id} review={review} />
        ))}
      </div>

      {shown < reviews.length && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => setShown((n) => n + PAGE)}
            className="h-10 rounded-xl px-6"
          >
            {t("reviews.showMore", { count: reviews.length - shown })}
          </Button>
        </div>
      )}
    </div>
  );
}
