/**
 * Authentication against the real MedPoint API.
 *
 * Mirrors the surface of the mock `src/lib/api/auth.ts` so `auth-provider` can
 * pick a backend at runtime without either side knowing about the other.
 *
 * Two endpoints in the collection are broken on the server today and are handled
 * here rather than papered over — see `register()` and `refreshSession()`, and
 * `BACKEND-GAPS.md` for the full write-up.
 */

import { ApiError } from "@/lib/api/client";
import { apiRequest } from "@/lib/api/http";
import { toE164Phone, toUser } from "@/lib/api/medpoint/mappers";
import type { WireAuthSession, WireUser } from "@/lib/api/medpoint/types";
import { clearTokens, getRefreshToken, storeTokens } from "@/lib/api/tokens";
import type { User } from "@/lib/types";

/** Persist the tokens from a login/register response and return the user. */
function adoptSession(session: WireAuthSession): User {
  storeTokens({
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
  });
  return toUser(session.user);
}

export async function login(email: string, password: string): Promise<User> {
  const session = await apiRequest<WireAuthSession>("/auth/login", {
    method: "POST",
    anonymous: true,
    body: { email, password },
  });

  return adoptSession(session);
}

export interface RegisterInput {
  fullName: string;
  email: string;
  password: string;
  phone: string;
}

/**
 * Create an account.
 *
 * `POST /v1/auth/register` currently 500s on the server — Passport has no
 * personal-access client configured, so it creates the user row and then dies
 * issuing the token. The account *does* exist afterwards, so rather than show a
 * "registration failed" error for an account that was in fact created (and which
 * the user then cannot re-register, because the email is now taken), we fall back
 * to logging in with the credentials we just submitted.
 *
 * Delete this fallback the moment the backend is fixed; `signupFailed` below is
 * what the user should see if registration genuinely fails.
 */
export async function register(input: RegisterInput): Promise<User> {
  const body = {
    full_name: input.fullName,
    email: input.email,
    password: input.password,
    phone: toE164Phone(input.phone),
  };

  try {
    const session = await apiRequest<WireAuthSession>("/auth/register", {
      method: "POST",
      anonymous: true,
      body,
    });
    return adoptSession(session);
  } catch (error) {
    // A 422 is a real, actionable rejection (email taken, weak password) and
    // must reach the form. Only the server's own 5xx gets the fallback.
    if (error instanceof ApiError && error.status >= 500) {
      return login(input.email, input.password);
    }
    throw error;
  }
}

/** The signed-in user, re-fetched from the server. */
export async function getCurrentUser(): Promise<User> {
  const wire = await apiRequest<WireUser>("/profile");
  return toUser(wire);
}

export async function logout(): Promise<void> {
  try {
    await apiRequest<void>("/logout", { method: "POST" });
  } catch {
    // A failed revoke must never trap the user in a signed-in state — the token
    // is being dropped locally either way.
  } finally {
    clearTokens();
  }
}

/**
 * Exchange the refresh token for a new access token.
 *
 * `POST /v1/auth/refresh-token` 500s on the server today (it type-hints the
 * framework's base Request instead of its own), so this cannot work yet. It is
 * written out because the moment the endpoint is fixed this is the only place
 * that needs to be believed — and because silently pretending refresh works
 * would hand users a dead session after 24h with no explanation.
 */
export async function refreshSession(): Promise<User> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    throw new ApiError("Your session has expired. Please sign in again.", 401, "api.unauthenticated");
  }

  const session = await apiRequest<WireAuthSession>("/auth/refresh-token", {
    method: "POST",
    anonymous: true,
    body: { refresh_token: refreshToken },
  });

  return adoptSession(session);
}

// --- Password reset -------------------------------------------------------
// A three-step flow: request a code, verify it, then set the new password.

/** Step 1 — email a one-time code. Always resolves, even for an unknown email. */
export async function requestPasswordReset(email: string): Promise<void> {
  await apiRequest<{ message: string }>("/auth/forgot-password", {
    method: "POST",
    anonymous: true,
    body: { email },
  });
}

/** Step 2 — check the code before asking the user to pick a new password. */
export async function verifyOtp(email: string, otp: string): Promise<void> {
  await apiRequest<{ message: string }>("/auth/verify-otp", {
    method: "POST",
    anonymous: true,
    body: { email, otp },
  });
}

/** Step 3 — set the new password using the verified code. */
export async function resetPassword(input: {
  email: string;
  otp: string;
  password: string;
  passwordConfirmation: string;
}): Promise<void> {
  await apiRequest<{ message: string }>("/auth/reset-password", {
    method: "POST",
    anonymous: true,
    body: {
      email: input.email,
      otp: input.otp,
      password: input.password,
      password_confirmation: input.passwordConfirmation,
    },
  });
}

// --- Email verification ---------------------------------------------------

/** Re-send the verification link to the signed-in user's address. */
export async function resendEmailVerification(): Promise<void> {
  await apiRequest<void>("/email/verification-notification", { method: "POST" });
}
