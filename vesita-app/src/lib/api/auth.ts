import { ApiError, db, makeId, request } from "@/lib/api/client";
import type { Role, User } from "@/lib/types";

/**
 * Mock authentication.
 *
 * There are no passwords — any credentials are accepted. What matters is that
 * the session lands on a real `User` from the dataset, so every dashboard has
 * genuine data behind it. `/login` also offers one-click demo accounts.
 */

const SESSION_KEY = "vesita:session:v1";
export const OTP_CODE = "123456";

const isBrowser = typeof window !== "undefined";

/** The seeded account used for each role's one-click demo login. */
export function demoUserFor(role: Role): User {
  const state = db();

  if (role === "admin") {
    return state.users.find((u) => u.role === "admin")!;
  }

  if (role === "patient") {
    // A patient with a rich booking history, so the dashboard isn't empty.
    const byActivity = state.users
      .filter((u) => u.role === "patient" && u.status === "active")
      .map((u) => ({
        user: u,
        count: state.bookings.filter((b) => b.patientId === u.id).length,
      }))
      .sort((a, b) => b.count - a.count);

    return byActivity[0].user;
  }

  // A provider whose listing is approved and actually has bookings against it.
  const candidates = state.users
    .filter((u) => u.role === role && u.status === "active" && u.providerId)
    .map((u) => ({
      user: u,
      count: state.bookings.filter((b) => b.providerId === u.providerId).length,
    }))
    .sort((a, b) => b.count - a.count);

  if (candidates.length === 0) {
    throw new ApiError(
      `No demo account available for role "${role}".`,
      404,
      "auth.noDemoAccount",
      { role },
    );
  }
  return candidates[0].user;
}

export function getStoredSession(): User | null {
  if (!isBrowser) return null;

  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;

    const stored = JSON.parse(raw) as User;
    // Re-resolve against the live DB so status/profile edits are reflected.
    return db().users.find((u) => u.id === stored.id) ?? null;
  } catch {
    return null;
  }
}

function storeSession(user: User | null): void {
  if (!isBrowser) return;

  try {
    if (user) window.localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    else window.localStorage.removeItem(SESSION_KEY);
  } catch {
    /* storage unavailable — session simply won't persist */
  }
}

// ---------------------------------------------------------------------------
// Flows
// ---------------------------------------------------------------------------

/**
 * `password` is accepted so the call site matches a real auth API, but it is
 * deliberately never checked — this is a mock. Any password signs you in.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function login(email: string, password: string): Promise<User> {
  return request(() => {
    const user = db().users.find(
      (u) => u.email.toLowerCase() === email.trim().toLowerCase(),
    );

    if (!user) {
      throw new ApiError(
        "No account found with that email address.",
        404,
        "auth.accountNotFound",
      );
    }
    if (user.status === "suspended") {
      throw new ApiError(
        "This account has been suspended. Contact support.",
        403,
        "auth.accountSuspended",
      );
    }

    storeSession(user);
    return user;
  });
}

/** One-click demo login — the role switcher on `/login`. */
export function loginAs(role: Role): Promise<User> {
  return request(() => {
    const user = demoUserFor(role);
    storeSession(user);
    return user;
  });
}

export function loginWithGoogle(): Promise<User> {
  return request(() => {
    const user = demoUserFor("patient");
    storeSession(user);
    return user;
  });
}

/**
 * What `POST /v1/auth/register` accepts, in the app's own naming.
 *
 * `role` is mock-only — the live API decides it server-side and the signup form
 * always passes "patient".
 */
export interface RegisterInput {
  name: string;
  email: string;
  phone: string;
  password: string;
  role?: Role;
}

export function register(input: RegisterInput): Promise<User> {
  return request(() => {
    const state = db();

    const taken = state.users.some(
      (u) => u.email.toLowerCase() === input.email.trim().toLowerCase(),
    );
    if (taken) {
      throw new ApiError(
        "An account with that email already exists.",
        409,
        "auth.emailTaken",
      );
    }

    const id = makeId("usr");
    const user: User = {
      id,
      name: input.name,
      email: input.email.trim().toLowerCase(),
      phone: input.phone,
      role: input.role ?? "patient",
      avatar: `/api/avatar?seed=${id}&name=${encodeURIComponent(input.name)}`,
      status: "active",
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    };

    state.users.push(user);

    state.notifications.unshift({
      id: makeId("ntf"),
      userId: id,
      kind: "system",
      channel: "browser",
      title: {
        en: `Welcome to Vesita, ${input.name.split(" ")[0]}!`,
        ar: `أهلًا بك في Vesita يا ${input.name.split(" ")[0]}!`,
      },
      body: {
        en: "Your account is ready. Search for a doctor, lab or scan to make your first booking.",
        ar: "حسابك جاهز. ابحث عن طبيب أو معمل أو مركز أشعة لتقوم بأول حجز لك.",
      },
      isRead: false,
      createdAt: new Date().toISOString(),
      actionUrl: "/search",
    });

    storeSession(user);
    return user;
  });
}

/** Mock OTP — the code is always `123456`, and it's shown in the UI. */
export function verifyOtp(code: string): Promise<{ verified: true }> {
  return request(() => {
    if (code.trim() !== OTP_CODE) {
      throw new ApiError(
        "That code is incorrect. Please try again.",
        401,
        "auth.otpIncorrect",
      );
    }
    return { verified: true as const };
  });
}

export function resendOtp(): Promise<{ sent: true }> {
  return request(() => ({ sent: true as const }));
}

export function logout(): Promise<void> {
  return request(() => {
    storeSession(null);
  });
}

export function updateProfile(
  id: string,
  patch: Partial<Pick<User, "name" | "phone" | "gender" | "dateOfBirth">>,
): Promise<User> {
  return request(() => {
    const user = db().users.find((u) => u.id === id);
    if (!user) throw new ApiError("User not found", 404, "user.notFound");

    Object.assign(user, patch);
    storeSession(user);
    return user;
  });
}

/** Where each role lands after signing in. */
export const HOME_FOR_ROLE: Record<Role, string> = {
  patient: "/patient",
  doctor: "/provider",
  lab: "/provider",
  radiology: "/provider",
  admin: "/admin",
};
