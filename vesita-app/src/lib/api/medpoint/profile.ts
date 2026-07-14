/**
 * The signed-in user's own account, against the real MedPoint API.
 *
 * Backs `/patient/profile`. Note the asymmetry in the backend's field names:
 * it reads date-of-birth as `birth` but the update endpoint does not accept it
 * at all — see `updateProfile`.
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
 * Verified against the live API: `name` and `phone` round-trip. `gender` and
 * `birth` are returned by `GET /v1/profile` but are *not* writable here, and
 * MedPoint has no `governorateId` or `bloodType` at all — so the mock-only parts
 * of the profile form stay on the mock. Do not add fields here speculatively;
 * the endpoint silently ignores what it does not know.
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
