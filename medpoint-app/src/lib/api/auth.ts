/**
 * Auth constants shared across screens.
 *
 * The mock that used to live here is gone: the seeded demo accounts
 * (`demoUserFor`, `loginAs`), the fake Google sign-in, the localStorage session
 * and the `123456` OTP were all fabrications with no counterpart on the server.
 * Sign-in, sign-up and session restore now go to `medpoint/auth` through
 * `session.ts`.
 *
 * What is left is routing, not data.
 */

import type { Role } from "@/lib/types";

/** Where each role lands after signing in. */
export const HOME_FOR_ROLE: Record<Role, string> = {
  patient: "/patient",
  doctor: "/provider",
  lab: "/provider",
  radiology: "/provider",
  admin: "/admin",
};

/**
 * What `POST /v1/auth/register` accepts, in the app's own naming.
 *
 * `role` is not sent — the server decides it — but the signup form is written
 * against this shape and always registers a patient.
 */
export interface RegisterInput {
  name: string;
  email: string;
  phone: string;
  password: string;
  role?: Role;
}
