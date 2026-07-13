"use client";

import { MessageSquareReply, Star } from "lucide-react";
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
import type { Review } from "@/lib/types";

const STAR_OPTIONS = [5, 4, 3, 2, 1].map((n) => ({
  value: String(n),
  label: `${n} star${n === 1 ? "" : "s"}`,
}));

export default function ProviderReviewsPage() {
  const { providerId, provider } = useCurrentProvider();

  const reviews = useAsync(
    () => getReviewsByProvider(providerId),
    [providerId],
  );

  const [stars, setStars] = useState("");
  const [editing, setEditing] = useState<Review | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

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
          title="Couldn't load your reviews"
          description={reviews.error.message}
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
              Showing {filtered.length} of {all.length} review
              {all.length === 1 ? "" : "s"}
            </p>

            <div className="w-full sm:w-56">
              <AppSelect
                value={stars}
                onValueChange={setStars}
                options={STAR_OPTIONS}
                emptyOption="All ratings"
                aria-label="Filter reviews by rating"
                className="h-10"
              />
            </div>
          </div>

          {all.length === 0 ? (
            <EmptyState
              icon={Star}
              title="No reviews yet"
              description="Reviews appear here once patients rate their completed visits."
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Star}
              title="No reviews at this rating"
              description="Try a different star filter."
              action={
                <Button
                  variant="outline"
                  className="h-10 rounded-xl px-4"
                  onClick={() => setStars("")}
                >
                  Clear filter
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
                      {review.reply ? "Edit reply" : "Reply"}
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
