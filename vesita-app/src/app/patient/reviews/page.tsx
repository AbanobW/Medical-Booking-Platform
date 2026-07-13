"use client";

import Link from "next/link";
import { MessageSquareOff, Pencil, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { EditReviewDialog } from "@/components/patient/review-dialog";
import { useAuth } from "@/components/providers/auth-provider";
import { ReviewCard } from "@/components/shared/review-card";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/shared/states";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useAsync, useMutation } from "@/hooks/use-async";
import { deleteReview, getReviewsByPatient } from "@/lib/api/engagement";
import type { Review } from "@/lib/types";

export default function PatientReviewsPage() {
  const { user } = useAuth();
  const patientId = user?.id ?? "";

  const { data, error, isLoading, refetch, setData } = useAsync(
    () => getReviewsByPatient(patientId),
    [patientId],
  );

  const [editing, setEditing] = useState<Review | null>(null);
  const [deleting, setDeleting] = useState<Review | null>(null);
  const { mutate: remove, isPending: isDeleting } = useMutation(deleteReview);

  const reviews = data ?? [];

  function onUpdated(updated: Review) {
    setData((current) =>
      (current ?? []).map((r) => (r.id === updated.id ? updated : r)),
    );
    setEditing(null);
  }

  async function onConfirmDelete() {
    if (!deleting) return;

    try {
      await remove(deleting.id);
      setData((current) => (current ?? []).filter((r) => r.id !== deleting.id));
      toast.success("Review deleted.");
      setDeleting(null);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Couldn't delete this review. Please try again.",
      );
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">My reviews</h2>
        <p className="text-sm text-muted-foreground">
          {reviews.length > 0
            ? `You've written ${reviews.length} review${reviews.length === 1 ? "" : "s"}.`
            : "Feedback you leave after a visit shows up here."}
        </p>
      </div>

      {isLoading ? (
        <ListSkeleton count={4} />
      ) : error ? (
        <ErrorState
          title="Couldn't load your reviews"
          description={error.message}
          onRetry={refetch}
        />
      ) : reviews.length === 0 ? (
        <EmptyState
          icon={MessageSquareOff}
          title="No reviews yet"
          description="After a completed appointment you can rate your visit and help other patients."
          action={
            <Button
              render={<Link href="/patient/bookings" />}
              className="h-10 rounded-xl px-4"
            >
              <Star className="size-4" />
              Review a visit
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {reviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              actions={
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Edit review"
                    onClick={() => setEditing(review)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Delete review"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => setDeleting(review)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              }
            />
          ))}
        </div>
      )}

      {editing && (
        <EditReviewDialog
          review={editing}
          open
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
          onUpdated={onUpdated}
        />
      )}

      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10 text-destructive">
              <Trash2 />
            </AlertDialogMedia>
            <AlertDialogTitle>Delete this review?</AlertDialogTitle>
            <AlertDialogDescription>
              Your rating will be removed from the provider&apos;s profile. This can&apos;t
              be undone, but you can always write a new review for that visit.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Keep it</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isDeleting}
              onClick={onConfirmDelete}
            >
              {isDeleting ? "Deleting…" : "Delete review"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
