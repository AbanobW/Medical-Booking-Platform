/**
 * Persistence for the MedPoint OAuth tokens.
 *
 * MedPoint runs Laravel Passport and issues an RS256 access token (24h) plus a
 * refresh token. We keep both in `localStorage` because the app is a fully
 * client-rendered SPA — there is no server session to hang a cookie off, and
 * every authenticated call is made from the browser.
 *
 * Storing a bearer token in `localStorage` means any XSS can read it. That is a
 * real, accepted trade-off here and the reason `BACKEND-GAPS.md` asks for
 * httpOnly refresh cookies. Do not widen it: never log a token, never put one
 * in a URL, and never persist one anywhere else.
 */

const ACCESS_KEY = "vesita:medpoint:access:v1";
const REFRESH_KEY = "vesita:medpoint:refresh:v1";

const isBrowser = typeof window !== "undefined";

export interface TokenPair {
  accessToken: string;
  refreshToken: string | null;
}

export function getAccessToken(): string | null {
  if (!isBrowser) return null;
  try {
    return window.localStorage.getItem(ACCESS_KEY);
  } catch {
    return null;
  }
}

export function getRefreshToken(): string | null {
  if (!isBrowser) return null;
  try {
    return window.localStorage.getItem(REFRESH_KEY);
  } catch {
    return null;
  }
}

export function storeTokens(tokens: TokenPair): void {
  if (!isBrowser) return;
  try {
    window.localStorage.setItem(ACCESS_KEY, tokens.accessToken);
    if (tokens.refreshToken) {
      window.localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
    }
  } catch {
    /* Quota or disabled storage — the session simply won't survive a reload. */
  }
}

export function clearTokens(): void {
  if (!isBrowser) return;
  try {
    window.localStorage.removeItem(ACCESS_KEY);
    window.localStorage.removeItem(REFRESH_KEY);
  } catch {
    /* Nothing to do — a failed clear must not break sign-out. */
  }
}

export function hasSession(): boolean {
  return getAccessToken() !== null;
}

// --- Session death -------------------------------------------------------

type Listener = () => void;
const listeners = new Set<Listener>();

/**
 * Run `listener` when the server rejects our token.
 *
 * Dropping the token on a 401 is not enough on its own: React still holds the
 * signed-in user, so the app keeps rendering a dashboard whose every request now
 * fails. `AuthProvider` subscribes here to clear that state and send the user to
 * sign in — otherwise an expired session looks like a broken app.
 *
 * Returns an unsubscribe function.
 */
export function onUnauthorized(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Called by the transport on a 401 — not on a deliberate sign-out. */
export function notifyUnauthorized(): void {
  for (const listener of listeners) listener();
}
