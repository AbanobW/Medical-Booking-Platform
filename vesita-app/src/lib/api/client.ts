import { DB, type Database } from "@/lib/data/seed";

/**
 * The mock backend's storage + transport primitives.
 *
 * Every service in `src/lib/api` goes through `request()`, which simulates
 * network latency and occasional failures. Swapping this file for real `fetch`
 * calls is the only change needed to move onto a live API.
 */

// v4 — bilingual free text *and* Arabic person names. Bios, service descriptions
// and preparation instructions became `{ en, ar }` objects, and providers gained
// a real Arabic `nameAr` ("د. هاني درويش" rather than "د. Hany Darwish").
//
// A stale payload cannot be migrated forward — it holds bare English strings and
// transliterated names — and it wins over the seed, so the Arabic UI would render
// English data with no way for the user to clear it. As with the earlier bumps,
// the key change deliberately drops the old payload and reseeds.
const STORAGE_KEY = "vesita:db:v4";
const LATENCY_MIN = 180;
const LATENCY_MAX = 620;

/** Set > 0 to exercise error states (0.03 = 3% of calls fail). */
const FAILURE_RATE = 0;

/**
 * A failure from the mock backend.
 *
 * `message` is the canonical English wording and stays the fallback. `code` is
 * the stable, language-independent identifier the UI translates against
 * (`messages/<locale>/errors.json`) — see `translateApiError`. Codes are what
 * make an error renderable in Arabic; a bare message can only ever be English.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status = 500,
    readonly code?: string,
    /** Values interpolated into the translated message, e.g. `{ minutes: 10 }`. */
    readonly params?: Record<string, string | number>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Mutable slices of the database, persisted to localStorage so bookings,
 * reviews and admin edits survive a page refresh.
 */
type MutableState = Pick<
  Database,
  | "providers"
  | "users"
  | "patientProfiles"
  | "bookings"
  | "reviews"
  | "favorites"
  | "notifications"
  | "holidays"
  | "coupons"
  | "campaigns"
  | "commission"
>;

function initialState(): MutableState {
  // Structured-clone so mutations never leak back into the generated seed.
  return structuredClone({
    providers: DB.providers,
    users: DB.users,
    patientProfiles: DB.patientProfiles,
    bookings: DB.bookings,
    reviews: DB.reviews,
    favorites: DB.favorites,
    notifications: DB.notifications,
    holidays: DB.holidays,
    coupons: DB.coupons,
    campaigns: DB.campaigns,
    commission: DB.commission,
  });
}

let state: MutableState | null = null;

const isBrowser = typeof window !== "undefined";

/**
 * The live database.
 *
 * On the server this is a fresh copy of the seed on every request (stateless,
 * like a real backend would look from the client's perspective). In the browser
 * it is hydrated from localStorage so user changes persist.
 */
export function db(): MutableState {
  if (state) return state;

  if (isBrowser) {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        state = JSON.parse(stored) as MutableState;
        return state;
      }
    } catch {
      // Corrupt or unavailable storage — fall through to a fresh seed.
    }
  }

  state = initialState();
  return state;
}

/** Call after any mutation so the change survives a refresh. */
export function persist(): void {
  if (!isBrowser || !state) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Quota exceeded or storage disabled — the in-memory copy still works.
  }
}

/** Wipes local changes and restores the pristine generated dataset. */
export function resetDatabase(): void {
  state = initialState();
  if (isBrowser) {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Simulates a network round-trip. `resolver` runs after the latency, so
 * loading states in the UI are exercised exactly as they would be for real.
 */
export async function request<T>(resolver: () => T): Promise<T> {
  const latency = LATENCY_MIN + Math.random() * (LATENCY_MAX - LATENCY_MIN);
  await delay(latency);

  if (FAILURE_RATE > 0 && Math.random() < FAILURE_RATE) {
    throw new ApiError(
      "The service is temporarily unavailable. Please try again.",
      503,
      "service.unavailable",
    );
  }

  const result = resolver();
  persist();
  return structuredClone(result);
}

/** Monotonic-ish ID generator for records created at runtime. */
export function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function makeReference(): string {
  return `VS-${Math.floor(100000 + Math.random() * 900000)}`;
}

/** Generic in-memory pagination. */
export function paginate<T>(items: T[], page = 1, pageSize = 12) {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;

  return {
    items: items.slice(start, start + pageSize),
    total,
    page: safePage,
    pageSize,
    totalPages,
  };
}
