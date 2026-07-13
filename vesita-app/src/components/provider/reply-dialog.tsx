"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { RatingStars } from "@/components/shared/rating";
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
import { replyToReview } from "@/lib/api/engagement";
import type { Review } from "@/lib/types";

export function ReplyDialog({
  review,
  open,
  onOpenChange,
  onSaved,
}: {
  review: Review | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [comment, setComment] = useState("");
  const reply = useMutation(replyToReview);

  useEffect(() => {
    if (open) setComment(review?.reply?.comment ?? "");
  }, [open, review]);

  async function onSubmit() {
    if (!review) return;

    if (comment.trim().length < 5) {
      toast.error("Write a slightly longer reply.");
      return;
    }

    try {
      await reply.mutate(review.id, comment.trim());
      onOpenChange(false);
      onSaved();
      toast.success("Reply published.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't publish your reply.",
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next: boolean) => onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {review?.reply ? "Edit your reply" : "Reply to review"}
          </DialogTitle>
          <DialogDescription>
            Your reply is public and shown under the review.
          </DialogDescription>
        </DialogHeader>

        {review && (
          <div className="space-y-4">
            <div className="rounded-xl border bg-muted/40 p-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{review.patientName}</span>
                <RatingStars value={review.rating} size="sm" precise={false} />
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {review.comment}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reply-comment">Your reply</Label>
              <Textarea
                id="reply-comment"
                rows={4}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Thank you for your feedback…"
                className="rounded-xl"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-10 rounded-xl px-4"
          >
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            disabled={reply.isPending}
            className="h-10 rounded-xl px-4"
          >
            {reply.isPending ? "Publishing…" : "Publish reply"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
