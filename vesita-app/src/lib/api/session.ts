/**
 * The one place that decides *which* backend answers an auth question.
 *
 * `auth-provider` talks only to this module, so no screen and no hook has to
 * know whether the session came from the seeded mock or from MedPoint. The
 * signatures are the mock's, because the whole app is already written against
 * them; live mode slots in underneath.
 *
 * What is real in live mode: sign-in, sign-up, sign-out, session restore,
 * account profile (name/phone/avatar), patient profiles (full CRUD under
 * `/me/profiles`), provider discovery (degraded), availability (degraded), and
 * booking write (partial).
 *
 * What stays on the mock in *both* modes, because MedPoint cannot serve it:
 *   • favorites — no `/v1/favorites` resource
 *   • booking read/cancel/reschedule — wire Booking lacks relations and datetime
 *   • the demo role switcher (`loginAs`) — a demo affordance with no backend
 *   • Google sign-in — needs a real Google `id_token` we have no client for
 *   • governorate / blood type / date-of-birth on the account — no such columns
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
 * Live mode persists only what MedPoint can actually store — `name` and `phone`.
 * The remaining fields have no column on the server, so they are *not* silently
 * merged into the returned user: that would look like a save and then vanish on
 * the next reload. The profile form tells the user as much when live.
 */
export async function updateProfile(id: string, patch: Partial<User>): Promise<User> {
  if (!isLive()) return mockAuth.updateProfile(id, patch);

  return liveProfile.updateProfile({
    name: patch.name,
    phone: patch.phone,
  });
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

/** Fields the active backend can actually persist on the account. */
export function editableProfileFields(): ReadonlyArray<keyof User> {
  return isLive()
    ? ["name", "phone"]
    : ["name", "phone", "governorateId", "gender", "dateOfBirth", "bloodType"];
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
 * Whether the signup form collects gender and governorate.
 *
 * MedPoint register accepts only `full_name`, `email`, `password` and `phone`.
 * Those extra fields exist for the mock dataset only.
 */
export function signupCollectsProfileFields(): boolean {
  return !isLive();
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
