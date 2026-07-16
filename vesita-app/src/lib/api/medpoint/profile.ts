/**
 * The signed-in user's own account, against the real MedPoint API.
 *
 * Backs `/patient/profile`. The account is written through *two* endpoints, not
 * one: `PUT /v1/profile` takes name and phone, `PATCH /v1/users/:id` takes
 * gender and date-of-birth. Neither is a superset of the other, so a save that
 * touches both goes out as two calls — see `session.updateProfile`, which is
 * the only caller that should be sequencing them.
 *
 * Mind the field names: date-of-birth is `birth` on the wire in both
 * directions.
 */

import { apiRequest } from "@/lib/api/http";
import { toE164Phone, toUser } from "@/lib/api/medpoint/mappers";
import type { WireUser } from "@/lib/api/medpoint/types";
import type { User } from "@/lib/types";

export async function getProfile(): Promise<User> {
  const wire = await apiRequest<WireUser>("/profile");
  return toUser(wire);
}

/**
 * Fields `PUT /v1/profile` actually accepts.
 *
 * `name` and `phone` round-trip. `gender` and `birth` are returned by
 * `GET /v1/profile` but are not writable here — they go through `updateUser`.
 * Do not add fields speculatively; the endpoint silently ignores what it does
 * not know, which looks exactly like a successful save.
 */
export interface ProfilePatch {
  name?: string;
  phone?: string;
}

export async function updateProfile(patch: ProfilePatch): Promise<User> {
  const wire = await apiRequest<WireUser>("/profile", {
    method: "PUT",
    body: {
      name: patch.name,
      // The API stores E.164; the app speaks the local Egyptian form.
      phone: toE164Phone(patch.phone),
    },
  });
  return toUser(wire);
}

/**
 * Fields `PATCH /v1/users/:id` accepts, minus the password trio.
 *
 * This is the only way to write `gender` and date-of-birth: `PUT /v1/profile`
 * drops both. The endpoint also takes `name`, which overlaps with
 * `updateProfile` — we leave `name` to `PUT /v1/profile` so each field has one
 * writer and a partial failure cannot leave the two disagreeing.
 *
 * The same endpoint takes `current_password`/`new_password`, but a password
 * change belongs to `changePassword` below (`PATCH /v1/users/:id/password`),
 * which reports a wrong password as a 422 this call has no form to attach to.
 */
export interface UserPatch {
  gender?: string;
  /** ISO `YYYY-MM-DD`. Sent as `birth` — the wire name in both directions. */
  dateOfBirth?: string;
}

export async function updateUser(userId: string, patch: UserPatch): Promise<User> {
  const wire = await apiRequest<WireUser>(`/users/${userId}`, {
    method: "PATCH",
    body: {
      gender: patch.gender,
      birth: patch.dateOfBirth,
    },
  });
  return toUser(wire);
}

/**
 * Change the password.
 *
 * `PATCH /v1/users/:id/password`. A wrong current password comes back as a 422
 * on `current_password`, which the form attaches to that input.
 */
export async function changePassword(
  userId: string,
  input: {
    currentPassword: string;
    newPassword: string;
    newPasswordConfirmation: string;
  },
): Promise<void> {
  await apiRequest<void>(`/users/${userId}/password`, {
    method: "PATCH",
    body: {
      current_password: input.currentPassword,
      new_password: input.newPassword,
      new_password_confirmation: input.newPasswordConfirmation,
    },
  });
}

export async function uploadAvatar(avatar: string): Promise<User> {
  const wire = await apiRequest<WireUser>("/profile/avatar", {
    method: "POST",
    body: { avatar },
  });
  return toUser(wire);
}

export async function deleteAvatar(): Promise<User> {
  const wire = await apiRequest<WireUser>("/profile/avatar", { method: "DELETE" });
  return toUser(wire);
}
