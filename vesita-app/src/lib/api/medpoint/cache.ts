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
 * Absolute ceiling on pages walked for one list. A backstop against an endpoint
 * that mis-reports `total_pages` or ignores `page` — either would otherwise loop
 * the caller until the dataset's reported page count, hammering the network.
 */
const MAX_PAGES = 40;

/** Walk every page of a MedPoint list endpoint into a single flat array. */
export async function fetchAllPages<T>(path: string, pageSize: number): Promise<T[]> {
  const items: T[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages && page <= MAX_PAGES) {
    const { items: batch, pagination } = await apiList<T>(path, {
      query: { page, limit: pageSize },
    });
    items.push(...batch);
    totalPages = pagination?.total_pages ?? 1;

    // Stop the moment we can prove there is nothing left, rather than trusting
    // `total_pages` alone:
    //  - an empty or short page is the last page;
    //  - once we hold every row the server claims, further pages are redundant
    //    (and would just refetch the same rows if `page` were being ignored).
    if (batch.length === 0 || batch.length < pageSize) break;
    if (pagination && items.length >= pagination.total) break;

    page += 1;
  }

  return items;
}
