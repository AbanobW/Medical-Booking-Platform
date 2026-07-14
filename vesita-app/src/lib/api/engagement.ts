import { isLiveCapability } from "@/lib/api/capabilities";
import { ApiError, db, makeId, request } from "@/lib/api/client";
import type {
  AppNotification,
  Favorite,
  Provider,
  Review,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Favorites
// ---------------------------------------------------------------------------

export function getFavorites(patientId: string): Promise<Provider[]> {
  // MedPoint has no `/v1/favorites` — capability stays off until it exists.
  if (isLiveCapability("favorites")) {
    throw new ApiError("Favorites are not available on the live API yet.", 501);
  }

  return request(() => {
    const ids = new Set(
      db()
        .favorites.filter((f) => f.patientId === patientId)
        .map((f) => f.providerId),
    );
    return db().providers.filter((p) => ids.has(p.id));
  });
}

export function getFavoriteIds(patientId: string): Promise<string[]> {
  return request(() =>
    db()
      .favorites.filter((f) => f.patientId === patientId)
      .map((f) => f.providerId),
  );
}

/** Adds or removes a favorite; resolves to the new state. */
export function toggleFavorite(
  patientId: string,
  providerId: string,
): Promise<{ isFavorite: boolean }> {
  if (isLiveCapability("favorites")) {
    throw new ApiError("Favorites are not available on the live API yet.", 501);
  }

  return request(() => {
    const state = db();
    const index = state.favorites.findIndex(
      (f) => f.patientId === patientId && f.providerId === providerId,
    );

    if (index >= 0) {
      state.favorites.splice(index, 1);
      return { isFavorite: false };
    }

    const favorite: Favorite = {
      id: makeId("fav"),
      patientId,
      providerId,
      createdAt: new Date().toISOString(),
    };
    state.favorites.push(favorite);
    return { isFavorite: true };
  });
}

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

export function getReviewsByPatient(patientId: string): Promise<Review[]> {
  return request(() =>
    db()
      .reviews.filter((r) => r.patientId === patientId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  );
}

export function getReviewsByProvider(providerId: string): Promise<Review[]> {
  return request(() =>
    db()
      .reviews.filter((r) => r.providerId === providerId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  );
}

export interface CreateReviewInput {
  bookingId: string;
  rating: number;
  comment: string;
  breakdown: Review["breakdown"];
}

export function createReview(input: CreateReviewInput): Promise<Review> {
  return request(() => {
    const state = db();
    const booking = state.bookings.find((b) => b.id === input.bookingId);
    if (!booking) throw new ApiError("Booking not found", 404, "booking.notFound");
    if (booking.status !== "completed") {
      throw new ApiError(
        "You can only review a completed appointment.",
        409,
        "review.notCompleted",
      );
    }
    if (booking.hasReview) {
      throw new ApiError(
        "You have already reviewed this appointment.",
        409,
        "review.alreadyExists",
      );
    }

    const patient = state.users.find((u) => u.id === booking.patientId);

    const review: Review = {
      id: makeId("rev"),
      bookingId: booking.id,
      providerId: booking.providerId,
      patientId: booking.patientId,
      patientName: patient?.name ?? booking.patientInfo.fullName,
      patientAvatar: patient?.avatar ?? "",
      rating: input.rating,
      breakdown: input.breakdown,
      comment: input.comment,
      createdAt: new Date().toISOString(),
      isVerified: true,
      helpfulCount: 0,
    };

    state.reviews.unshift(review);
    booking.hasReview = true;

    // Fold the new score into the provider's running average.
    const provider = state.providers.find((p) => p.id === booking.providerId);
    if (provider) {
      const total = provider.rating * provider.reviewCount + input.rating;
      provider.reviewCount += 1;
      provider.rating = +(total / provider.reviewCount).toFixed(1);
    }

    return review;
  });
}

export function updateReview(
  id: string,
  patch: Pick<CreateReviewInput, "rating" | "comment">,
): Promise<Review> {
  return request(() => {
    const state = db();
    const review = state.reviews.find((r) => r.id === id);
    if (!review) throw new ApiError("Review not found", 404, "review.notFound");

    const provider = state.providers.find((p) => p.id === review.providerId);
    if (provider && patch.rating !== review.rating) {
      // Swap the old score out of the average and the new one in.
      const total =
        provider.rating * provider.reviewCount - review.rating + patch.rating;
      provider.rating = +(total / provider.reviewCount).toFixed(1);
    }

    review.rating = patch.rating;
    review.comment = patch.comment;
    return review;
  });
}

export function deleteReview(id: string): Promise<{ id: string }> {
  return request(() => {
    const state = db();
    const index = state.reviews.findIndex((r) => r.id === id);
    if (index < 0) throw new ApiError("Review not found", 404, "review.notFound");

    const [review] = state.reviews.splice(index, 1);

    const booking = state.bookings.find((b) => b.id === review.bookingId);
    if (booking) booking.hasReview = false;

    const provider = state.providers.find((p) => p.id === review.providerId);
    if (provider && provider.reviewCount > 1) {
      const total = provider.rating * provider.reviewCount - review.rating;
      provider.reviewCount -= 1;
      provider.rating = +(total / provider.reviewCount).toFixed(1);
    }

    return { id };
  });
}

/** Provider replies to a patient review. */
export function replyToReview(id: string, comment: string): Promise<Review> {
  return request(() => {
    const review = db().reviews.find((r) => r.id === id);
    if (!review) throw new ApiError("Review not found", 404, "review.notFound");

    review.reply = { comment, createdAt: new Date().toISOString() };
    return review;
  });
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export function getNotifications(userId: string): Promise<AppNotification[]> {
  return request(() =>
    db()
      .notifications.filter((n) => n.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  );
}

export function getUnreadCount(userId: string): Promise<number> {
  return request(
    () => db().notifications.filter((n) => n.userId === userId && !n.isRead).length,
  );
}

export function markNotificationRead(id: string): Promise<AppNotification> {
  return request(() => {
    const notification = db().notifications.find((n) => n.id === id);
    if (!notification) throw new ApiError("Notification not found", 404, "notification.notFound");

    notification.isRead = true;
    return notification;
  });
}

export function markAllNotificationsRead(userId: string): Promise<{ count: number }> {
  return request(() => {
    let count = 0;
    for (const n of db().notifications) {
      if (n.userId === userId && !n.isRead) {
        n.isRead = true;
        count++;
      }
    }
    return { count };
  });
}

export function deleteNotification(id: string): Promise<{ id: string }> {
  return request(() => {
    const state = db();
    const index = state.notifications.findIndex((n) => n.id === id);
    if (index < 0) throw new ApiError("Notification not found", 404, "notification.notFound");

    state.notifications.splice(index, 1);
    return { id };
  });
}
