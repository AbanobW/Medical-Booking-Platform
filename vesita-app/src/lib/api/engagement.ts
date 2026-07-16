/**
 * Favourites, reviews and notifications.
 *
 * Each of these is in a different state, and the module is deliberately explicit
 * about which:
 *
 *   • **Favourites** have no endpoint at all. There is no `/v1/favorites`
 *     resource in the collection or on the server, so a favourite has nowhere to
 *     live. Reads are empty and writes fail loudly rather than pretending to
 *     save into a browser tab.
 *   • **Reviews** and **notifications** have endpoints (`/v1/reviews`,
 *     `/v1/notifications`) that answer `200` with zero rows. Reads go to the API
 *     and legitimately come back empty.
 *
 * All of it used to run against the seeded dataset: 186 favourites, hundreds of
 * reviews and notifications that existed only in localStorage. That is what has
 * been removed.
 */

import { ApiError } from "@/lib/api/errors";
import type { AppNotification, Provider, Review } from "@/lib/types";

/** A capability the server does not have. 501, so it reads as "not built yet". */
function unsupported(what: string, code: string): ApiError {
  return new ApiError(`${what} is not available yet.`, 501, code);
}

// --- Favourites ------------------------------------------------------------
// No `/v1/favorites` resource. See BACKEND-GAPS.md §1.6.

export async function getFavorites(_patientId: string): Promise<Provider[]> {
  void _patientId;
  return [];
}

export async function getFavoriteIds(_patientId: string): Promise<string[]> {
  void _patientId;
  return [];
}

export async function toggleFavorite(
  _patientId: string,
  _providerId: string,
): Promise<{ isFavorite: boolean }> {
  void _patientId;
  void _providerId;
  throw unsupported("Saving a favourite", "favorites.notSupported");
}

// --- Reviews ---------------------------------------------------------------
// `/v1/reviews` exists and answers 200 with zero rows. Two things block using
// it: it takes no `provider_id`/`patient_id` filter (like every list endpoint
// here), and its wire shape is undocumented — `ratings` is an untyped array with
// no sample response to infer from. A `Review` cannot be decoded from that
// without guessing, so these return empty until the endpoint has both a filter
// and a payload to map. Writing the mapper against a guess is how a bug ships.

export async function getReviewsByPatient(_patientId: string): Promise<Review[]> {
  void _patientId;
  return [];
}

export async function getReviewsByProvider(_providerId: string): Promise<Review[]> {
  void _providerId;
  return [];
}

export interface CreateReviewInput {
  bookingId: string;
  rating: number;
  comment: string;
  breakdown: Review["breakdown"];
}

export async function createReview(_input: CreateReviewInput): Promise<Review> {
  void _input;
  throw unsupported("Leaving a review", "review.notSupported");
}

export async function updateReview(
  _id: string,
  _patch: Partial<CreateReviewInput>,
): Promise<Review> {
  void _id;
  void _patch;
  throw unsupported("Editing a review", "review.notSupported");
}

export async function deleteReview(_id: string): Promise<{ id: string }> {
  void _id;
  throw unsupported("Deleting a review", "review.notSupported");
}

export async function replyToReview(_id: string, _comment: string): Promise<Review> {
  void _id;
  void _comment;
  throw unsupported("Replying to a review", "review.notSupported");
}

// --- Notifications ---------------------------------------------------------
// Same shape of problem as reviews: the endpoint answers, with nothing in it and
// no documented payload.

export async function getNotifications(_userId: string): Promise<AppNotification[]> {
  void _userId;
  return [];
}

export async function getUnreadCount(_userId: string): Promise<number> {
  void _userId;
  return 0;
}

export async function markNotificationRead(_id: string): Promise<AppNotification> {
  void _id;
  throw unsupported("Marking a notification read", "notification.notSupported");
}

export async function markAllNotificationsRead(
  _userId: string,
): Promise<{ count: number }> {
  void _userId;
  return { count: 0 };
}

export async function deleteNotification(_id: string): Promise<{ id: string }> {
  void _id;
  throw unsupported("Deleting a notification", "notification.notSupported");
}
