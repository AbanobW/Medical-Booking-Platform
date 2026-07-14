/**
 * Where the app's data actually comes from.
 *
 * The MedPoint backend can serve authentication and the account profile, but it
 * cannot yet serve discovery, booking or favourites — its `Booking` payload has
 * no date, no service and no foreign keys, its list endpoints take no filters,
 * and there is no favourites resource at all (see `BACKEND-GAPS.md`). Flipping
 * the whole app over would therefore blank out most of it.
 *
 * So the two backends coexist: `apiMode()` sets the global mode, and
 * `capabilities.ts` decides per domain which backend answers. Anything MedPoint
 * cannot serve stays on the seeded mock in *both* modes — `live` widens what is
 * real, it never takes a screen away.
 */

export type ApiMode = "mock" | "live";

/** `NEXT_PUBLIC_*` is inlined at build time, so this must not be destructured. */
function readMode(): ApiMode {
  return process.env.NEXT_PUBLIC_API_MODE === "live" ? "live" : "mock";
}

export function apiMode(): ApiMode {
  return readMode();
}

/** True when any MedPoint capability may be used (see `capabilities.ts`). */
export function isLive(): boolean {
  return readMode() === "live";
}

/**
 * Where the browser sends an API call.
 *
 * Not the MedPoint host: MedPoint serves no CORS headers, so the browser refuses
 * to read any response from it. Calls go to our own origin instead, and
 * `next.config.ts` rewrites `/api/medpoint/*` upstream server-to-server. The
 * `/v1` prefix belongs to the path and is added by the request layer.
 *
 * Relative on purpose — it resolves against whatever origin the app is served
 * from, so there is nothing to reconfigure per environment.
 */
export const API_PROXY_PREFIX = "/api/medpoint";

export function apiBaseUrl(): string {
  return API_PROXY_PREFIX;
}

/** The upstream MedPoint host the proxy forwards to. For diagnostics only. */
export function apiUpstream(): string {
  return (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/+$/, "");
}
