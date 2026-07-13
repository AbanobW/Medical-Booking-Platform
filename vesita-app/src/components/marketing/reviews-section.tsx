"use client";

import { MessageSquare } from "lucide-react";
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
  const [shown, setShown] = useState(PAGE);

  const { data, error, isLoading, refetch } = useAsync(
    () => getProviderReviews(provider.id),
    [provider.id],
  );

  if (isLoading) return <ListSkeleton count={4} />;

  if (error) {
    return (
      <ErrorState
        title="Couldn't load reviews"
        description="We hit a problem fetching the reviews for this profile."
        onRetry={refetch}
      />
    );
  }

  const reviews = data ?? [];

  if (reviews.length === 0) {
    return (
      <EmptyState
        icon={MessageSquare}
        title="No reviews yet"
        description="Be the first to share your experience after your visit."
      />
    );
  }

  return (
    <div className="space-y-6">
      <RatingCard
        rating={provider.rating}
        reviewCount={provider.reviewCount}
        reviews={reviews}
      />

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
            Show more reviews ({reviews.length - shown} left)
          </Button>
        </div>
      )}
    </div>
  );
}
