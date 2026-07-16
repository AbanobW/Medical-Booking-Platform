/**
 * The signed-in account.
 *
 * `auth-provider` talks only to this module. It used to choose between a seeded
 * mock and MedPoint; there is no mock now, so this is the seam that keeps
 * screens off the wire layer and sequences the two endpoints the account is
 * split across.
 *
 * The demo affordances that lived here — the one-click role switcher
 * (`loginAs`), the fake Google sign-in, the `123456` signup OTP — are gone with
 * the dataset that backed them. None had a server counterpart.
 */

import * as liveAuth from "@/lib/api/medpoint/auth";
import * as liveProfile from "@/lib/api/medpoint/profile";
import { hasSession } from "@/lib/api/tokens";
import type { RegisterInput } from "@/lib/api/auth";
import type { User } from "@/lib/types";

export type { RegisterInput } from "@/lib/api/auth";

/**
 * Restore the signed-in user on boot.
 *
 * We hold only a token, so the user has to be fetched — which means this can
 * fail (expired token → 401 → `apiRequest` clears it and we land on `null`).
 */
export async function restoreSession(): Promise<User | null> {
  if (!hasSession()) return null;

  try {
    return await liveAuth.getCurrentUser();
  } catch {
    // A dead or revoked token: `apiRequest` has already dropped it. Boot signed
    // out rather than trapping the app behind an error it cannot clear.
    return null;
  }
}

export async function login(email: string, password: string): Promise<User> {
  return liveAuth.login(email, password);
}

export async function register(input: RegisterInput): Promise<User> {
  return liveAuth.register({
    fullName: input.name,
    email: input.email,
    password: input.password,
    phone: input.phone,
  });
}

export async function logout(): Promise<void> {
  return liveAuth.logout();
}

/**
 * Update the account.
 *
 * Two endpoints split the account between them: `PUT /v1/profile` owns name and
 * phone, `PATCH /v1/users/:id` owns gender and date-of-birth. Each call is made
 * only when the patch actually touches its fields, so editing a name is still
 * one request.
 *
 * The order matters on failure. Name and phone go first because they are what
 * the header, the greeting and every booking read off the session — if the
 * second call fails, the user is looking at the identity they just saved, and
 * the form surfaces the error against a field they can retry.
 */
export async function updateProfile(id: string, patch: Partial<User>): Promise<User> {
  const touchesAccount = patch.name !== undefined || patch.phone !== undefined;
  const touchesPerson = patch.gender !== undefined || patch.dateOfBirth !== undefined;

  let user: User | undefined;

  if (touchesAccount) {
    user = await liveProfile.updateProfile({ name: patch.name, phone: patch.phone });
  }
  if (touchesPerson) {
    user = await liveProfile.updateUser(id, {
      gender: patch.gender,
      dateOfBirth: patch.dateOfBirth,
    });
  }

  // A patch of nothing writable (or of nothing at all): report the account as it
  // stands rather than inventing a response neither endpoint returned.
  return user ?? (await liveAuth.getCurrentUser());
}

export async function uploadAvatar(avatar: string): Promise<User> {
  return liveProfile.uploadAvatar(avatar);
}

export async function deleteAvatar(): Promise<User> {
  return liveProfile.deleteAvatar();
}

/** Fields `PUT /v1/profile` and `PATCH /v1/users/:id` can persist between them. */
export function editableProfileFields(): ReadonlyArray<keyof User> {
  return ["name", "phone", "gender", "dateOfBirth"];
}
