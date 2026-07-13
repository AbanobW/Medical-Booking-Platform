"use client";

import { useState } from "react";
import { toast } from "sonner";

import { RatingInput } from "@/components/shared/rating";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMutation } from "@/hooks/use-async";
import { createReview, updateReview } from "@/lib/api/engagement";
import type { Booking, Review } from "@/lib/types";

type Breakdown = Review["breakdown"];

const BREAKDOWN_FIELDS: { key: keyof Breakdown; label: string }[] = [
  { key: "waitingTime", label: "Waiting time" },
  { key: "staff", label: "Staff" },
  { key: "cleanliness", label: "Cleanliness" },
  { key: "communication", label: "Communication" },
];

const EMPTY_BREAKDOWN: Breakdown = {
  waitingTime: 0,
  staff: 0,
  cleanliness: 0,
  communication: 0,
};

/** Write a review for a completed booking that doesn't have one yet. */
export function CreateReviewDialog({
  booking,
  open,
  onOpenChange,
  onCreated,
}: {
  booking: Booking;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [breakdown, setBreakdown] = useState<Breakdown>(EMPTY_BREAKDOWN);
  const [comment, setComment] = useState("");
  const { mutate, isPending } = useMutation(createReview);

  const isComplete =
    rating > 0 &&
    comment.trim().length >= 10 &&
    BREAKDOWN_FIELDS.every((field) => breakdown[field.key] > 0);

  async function onSubmit() {
    if (!isComplete) return;

    try {
      await mutate({
        bookingId: booking.id,
        rating,
        comment: comment.trim(),
        breakdown,
      });
      toast.success("Thanks for your review!", {
        description: `Your feedback on ${booking.providerName} is now live.`,
      });
      onOpenChange(false);
      setRating(0);
      setBreakdown(EMPTY_BREAKDOWN);
      setComment("");
      onCreated();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Couldn't submit your review. Please try again.",
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Rate your visit</DialogTitle>
          <DialogDescription>
            {booking.providerName} · {booking.serviceName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label>Overall rating</Label>
            <RatingInput
              value={rating}
              onChange={setRating}
              disabled={isPending}
            />
          </div>

          <div className="space-y-3 rounded-xl border p-4">
            <p className="text-sm font-medium">Rate the details</p>
            {BREAKDOWN_FIELDS.map((field) => (
              <div
                key={field.key}
                className="flex items-center justify-between gap-4"
              >
                <span className="text-sm text-muted-foreground">
                  {field.label}
                </span>
                <RatingInput
                  size="md"
                  value={breakdown[field.key]}
                  disabled={isPending}
                  onChange={(value) =>
                    setBreakdown((current) => ({
                      ...current,
                      [field.key]: value,
                    }))
                  }
                />
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor={`review-comment-${booking.id}`}>Your review</Label>
            <Textarea
              id={`review-comment-${booking.id}`}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="What went well? What could be better? (at least 10 characters)"
              rows={4}
              disabled={isPending}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
            className="h-10 rounded-xl px-4"
          >
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            disabled={!isComplete || isPending}
            className="h-10 rounded-xl px-4"
          >
            {isPending ? "Submitting…" : "Submit review"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Edit an existing review — the API only accepts a new rating and comment. */
export function EditReviewDialog({
  review,
  open,
  onOpenChange,
  onUpdated,
}: {
  review: Review;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: (review: Review) => void;
}) {
  const [rating, setRating] = useState(review.rating);
  const [comment, setComment] = useState(review.comment);
  const { mutate, isPending } = useMutation(updateReview);

  const isValid = rating > 0 && comment.trim().length >= 10;

  async function onSubmit() {
    if (!isValid) return;

    try {
      const updated = await mutate(review.id, {
        rating,
        comment: comment.trim(),
      });
      toast.success("Review updated.");
      onOpenChange(false);
      onUpdated(updated);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Couldn't update your review. Please try again.",
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit your review</DialogTitle>
          <DialogDescription>
            Update your rating or rewrite what you said.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label>Overall rating</Label>
            <RatingInput
              value={rating}
              onChange={setRating}
              disabled={isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`edit-review-${review.id}`}>Your review</Label>
            <Textarea
              id={`edit-review-${review.id}`}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              rows={4}
              disabled={isPending}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
            className="h-10 rounded-xl px-4"
          >
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            disabled={!isValid || isPending}
            className="h-10 rounded-xl px-4"
          >
            {isPending ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
