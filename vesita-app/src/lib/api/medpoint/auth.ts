/**
 * Authentication against the real MedPoint API.
 *
 * Mirrors the surface of the mock `src/lib/api/auth.ts` so `auth-provider` can
 * pick a backend at runtime without either side knowing about the other.
 *
 * Every login path now returns a real access + refresh token pair, and the
 * refresh tokens rotate (single-use), so `adoptSession` stores the fresh pair
 * from every response — including the one that comes back from a refresh.
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
 * `POST /v1/auth/register` returns a real access + refresh token pair, creates
 * the account's default (SELF) patient profile, and assigns the `patient` role.
 * A 422 is a genuine, actionable rejection (email taken, weak password) and is
 * left to propagate so the form can attach it to the offending field.
 */
export async function register(input: RegisterInput): Promise<User> {
  const session = await apiRequest<WireAuthSession>("/auth/register", {
    method: "POST",
    anonymous: true,
    body: {
      full_name: input.fullName,
      email: input.email,
      password: input.password,
      phone: toE164Phone(input.phone),
    },
  });

  return adoptSession(session);
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
 * Exchange the refresh token for a fresh token pair.
 *
 * Refresh tokens are single-use and rotate: the response carries a *new* refresh
 * token that `adoptSession` writes over the old one. Replaying a spent token is
 * rejected with a 400, which lands the caller back at sign-in.
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
