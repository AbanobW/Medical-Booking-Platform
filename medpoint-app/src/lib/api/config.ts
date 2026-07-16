/**
 * Where the app's data comes from: MedPoint, and nothing else.
 *
 * There is no mock and no seeded dataset. Every value on screen was served by
 * the API or is absent — an absent value renders as an em dash, it is never
 * invented, defaulted or back-filled. A screen with no endpoint behind it shows
 * an empty state saying so.
 *
 * The consequence is deliberate: where the API is thin, the UI is thin, and the
 * gap is visible rather than papered over. `BACKEND-GAPS.md` tracks what is
 * missing and what it blocks.
 */

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
