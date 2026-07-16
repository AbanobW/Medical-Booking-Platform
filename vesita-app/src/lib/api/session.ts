/**
 * The one place that decides *which* backend answers an auth question.
 *
 * `auth-provider` talks only to this module, so no screen and no hook has to
 * know whether the session came from the seeded mock or from MedPoint. The
 * signatures are the mock's, because the whole app is already written against
 * them; live mode slots in underneath.
 *
 * What is real in live mode: sign-in, sign-up, sign-out, session restore,
 * account profile (name/phone/gender/date-of-birth/avatar), patient profiles
 * (full CRUD under `/me/profiles`), provider discovery (degraded), availability
 * (degraded), and booking write (partial).
 *
 * What stays on the mock in *both* modes, because MedPoint cannot serve it:
 *   • favorites — no `/v1/favorites` resource
 *   • booking read/cancel/reschedule — wire Booking lacks relations and datetime
 *   • the demo role switcher (`loginAs`) — a demo affordance with no backend
 *   • Google sign-in — needs a real Google `id_token` we have no client for
 */

import * as mockAuth from "@/lib/api/auth";
import { isLive } from "@/lib/api/config";
import * as liveAuth from "@/lib/api/medpoint/auth";
import * as liveProfile from "@/lib/api/medpoint/profile";
import { hasSession } from "@/lib/api/tokens";
import type { Role, User } from "@/lib/types";

export type { RegisterInput } from "@/lib/api/auth";

/**
 * Restore the signed-in user on boot.
 *
 * Mock mode reads a `User` straight out of localStorage. Live mode holds only a
 * token, so the user has to be fetched — which means this is async and can fail
 * (expired token → 401 → `apiRequest` clears it and we land on `null`).
 */
export async function restoreSession(): Promise<User | null> {
  if (!isLive()) return mockAuth.getStoredSession();
  if (!hasSession()) return null;

  try {
    return await liveAuth.getCurrentUser();
  } catch {
    // A dead or revoked token: `apiRequest` has already dropped it. Boot signed-out
    // rather than trapping the app behind an error it cannot clear.
    return null;
  }
}

export async function login(email: string, password: string): Promise<User> {
  return isLive() ? liveAuth.login(email, password) : mockAuth.login(email, password);
}

export async function register(input: mockAuth.RegisterInput): Promise<User> {
  if (!isLive()) return mockAuth.register(input);

  return liveAuth.register({
    fullName: input.name,
    email: input.email,
    password: input.password,
    phone: input.phone,
  });
}

export async function logout(): Promise<void> {
  return isLive() ? liveAuth.logout() : mockAuth.logout();
}

/**
 * Update the account.
 *
 * Live mode writes through two endpoints that split the account between them:
 * `PUT /v1/profile` owns name and phone, `PATCH /v1/users/:id` owns gender and
 * date-of-birth. Each call is made only when the patch actually touches its
 * fields, so editing a name is still one request.
 *
 * The order matters on failure. Name and phone go first because they are what
 * the header, the greeting and every booking read off the session — if the
 * second call fails, the user is looking at the identity they just saved, and
 * the form surfaces the error against a field they can retry.
 */
export async function updateProfile(id: string, patch: Partial<User>): Promise<User> {
  if (!isLive()) return mockAuth.updateProfile(id, patch);

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

/** Whether the signed-in user can upload or remove their avatar (live only). */
export function supportsAvatarUpload(): boolean {
  return isLive();
}

export async function uploadAvatar(avatar: string): Promise<User> {
  if (!isLive()) {
    throw new Error("Avatar upload is only available in live API mode.");
  }
  return liveProfile.uploadAvatar(avatar);
}

export async function deleteAvatar(): Promise<User> {
  if (!isLive()) {
    throw new Error("Avatar upload is only available in live API mode.");
  }
  return liveProfile.deleteAvatar();
}

/**
 * Fields the account can persist.
 *
 * The same set in both modes now that gender and date-of-birth have a live
 * writer (`PATCH /v1/users/:id`) — the mock is seeded to match the API rather
 * than to exceed it.
 */
export function editableProfileFields(): ReadonlyArray<keyof User> {
  return ["name", "phone", "gender", "dateOfBirth"];
}

/** Whether the signed-in user can change their password (live only). */
export function supportsPasswordChange(): boolean {
  return isLive();
}

/** Whether the self-service password-reset flow is available (live only). */
export function supportsPasswordReset(): boolean {
  return isLive();
}

/**
 * Whether signing up ends on the OTP screen.
 *
 * The mock issues a code (`123456`) and `/verify` is where a new account is
 * activated. MedPoint does not: `POST /auth/register` returns a live token pair
 * and the account is usable immediately — its OTP endpoints exist only to reset
 * a password. Sending a live signup to `/verify` would strand them on a screen
 * asking for a code that was never sent and that nothing checks.
 */
export function requiresOtpAfterSignup(): boolean {
  return !isLive();
}

// --- Demo-only affordances -------------------------------------------------
// These have no MedPoint equivalent and always run against the seeded dataset.

export async function loginAs(role: Role): Promise<User> {
  return mockAuth.loginAs(role);
}

export async function loginWithGoogle(): Promise<User> {
  return mockAuth.loginWithGoogle();
}

/** True when the demo role switcher / Google button should be offered at all. */
export function supportsDemoLogin(): boolean {
  return !isLive();
}
