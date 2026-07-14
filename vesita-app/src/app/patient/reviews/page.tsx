"use client";

import Link from "next/link";
import { MessageSquareOff, Pencil, Star, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
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
import { useApiError } from "@/lib/i18n/use-api-error";
import type { Review } from "@/lib/types";

export default function PatientReviewsPage() {
  const t = useTranslations("patient");
  const describeError = useApiError();

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
      toast.success(t("reviews.deleted"));
      setDeleting(null);
    } catch (err) {
      toast.error(describeError(err));
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          {t("reviews.title")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {reviews.length > 0
            ? t("reviews.count", { count: reviews.length })
            : t("reviews.subtitle")}
        </p>
      </div>

      {isLoading ? (
        <ListSkeleton count={4} />
      ) : error ? (
        <ErrorState
          title={t("reviews.error")}
          description={describeError(error)}
          onRetry={refetch}
        />
      ) : reviews.length === 0 ? (
        <EmptyState
          icon={MessageSquareOff}
          title={t("reviews.emptyTitle")}
          description={t("reviews.emptyDescription")}
          action={
            <Button
              render={<Link href="/patient/bookings" />}
              className="h-10 rounded-xl px-4"
            >
              <Star className="size-4" />
              {t("reviews.reviewVisit")}
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
                    aria-label={t("reviews.edit")}
                    onClick={() => setEditing(review)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("reviews.delete")}
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
            <AlertDialogTitle>{t("reviews.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("reviews.deleteDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              {t("reviews.keep")}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isDeleting}
              onClick={onConfirmDelete}
            >
              {isDeleting ? t("reviews.deleting") : t("reviews.confirmDelete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
