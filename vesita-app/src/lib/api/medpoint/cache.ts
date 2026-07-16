/**
 * Cached, request-coalesced loaders for MedPoint reference data.
 *
 * MedPoint's list endpoints (`/providers`, `/branches`, `/services`, `/slots`,
 * `/doctor-sessions`) are whole-dataset fetches the UI needs constantly: every
 * provider card wants availability, every search wants the catalog. Fetching
 * them per-consumer floods the network and trips the API's 30/min throttle.
 *
 * `createCachedLoader` fixes both halves of the problem:
 *
 *   - **Result cache** — a resolved value is reused for `ttlMs`, so a second
 *     screen within the window pays nothing.
 *   - **In-flight coalescing** — while a fetch is in flight, concurrent callers
 *     share the *same* promise instead of each starting their own. This is what
 *     stops N provider cards mounting together from firing N identical fetches.
 */

import { apiList } from "@/lib/api/http";

export interface CachedLoader<T> {
  /** Resolve the value, hitting the network at most once per TTL window. */
  load(): Promise<T>;
  /** Drop the cache and any in-flight promise (tests, sign-out, writes). */
  clear(): void;
}

export function createCachedLoader<T>(
  loader: () => Promise<T>,
  ttlMs = 60_000,
): CachedLoader<T> {
  let value: T | null = null;
  let loadedAt = 0;
  let inflight: Promise<T> | null = null;

  function load(): Promise<T> {
    if (value !== null && Date.now() - loadedAt < ttlMs) {
      return Promise.resolve(value);
    }
    // A fetch is already running — every caller in this window shares it.
    if (inflight) return inflight;

    inflight = loader()
      .then((result) => {
        value = result;
        loadedAt = Date.now();
        return result;
      })
      .finally(() => {
        inflight = null;
      });

    return inflight;
  }

  function clear(): void {
    value = null;
    loadedAt = 0;
    inflight = null;
  }

  return { load, clear };
}

/**
 * Absolute ceiling on pages walked for one list.
 *
 * A backstop against an endpoint that mis-reports `total_pages` or ignores
 * `page` — either would otherwise loop until the reported page count, hammering
 * the network.
 *
 * It bites for real: the server pins every page at 10 rows whatever we ask for,
 * so `/slots` is 105 pages for 1044 rows and this cap stops us at 400. Walking
 * all of it would be 105 serial requests and would trip the API's 30/min
 * throttle. Truncation is logged rather than silent — a short list that looks
 * complete is worse than a short list that says so. The fix is server-side:
 * honour `per_page`, or take a filter so we stop fetching whole tables.
 */
const MAX_PAGES = 40;

/**
 * Walk every page of a MedPoint list endpoint into a single flat array.
 *
 * The page size is the *server's*, not ours. MedPoint ignores both `limit` and
 * `per_page` and always returns 10 rows — asking for 100 gets 10, with
 * `"per_page": 10` in the meta. This used to send `limit` and then stop as soon
 * as a page came back shorter than what it asked for, so a 10-row page against a
 * requested 100 looked like the last one: `/services` returned 10 of 49 and
 * `/slots` 10 of 1044, silently, and everything downstream quietly saw a
 * fraction of the data.
 *
 * So: trust the reported `total`/`total_pages`, not the batch size, and stop
 * only on an empty page or once we hold every row the server claims.
 */
export async function fetchAllPages<T>(path: string): Promise<T[]> {
  const items: T[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages && page <= MAX_PAGES) {
    const { items: batch, pagination } = await apiList<T>(path, { query: { page } });
    items.push(...batch);
    totalPages = pagination?.total_pages ?? 1;

    // An empty page is the end. So is holding everything the server claims —
    // which also stops us looping forever if `page` were being ignored.
    if (batch.length === 0) break;
    if (pagination && items.length >= pagination.total) break;

    page += 1;

    if (page > MAX_PAGES && pagination && items.length < pagination.total) {
      console.warn(
        `[medpoint] ${path}: stopped at ${items.length}/${pagination.total} rows ` +
          `(${MAX_PAGES}-page cap). The API pins pages at ${batch.length} rows and ` +
          `ignores per_page, so the rest is unreachable without a filter.`,
      );
    }
  }

  return items;
}
