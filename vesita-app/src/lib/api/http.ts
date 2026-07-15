/**
 * The real transport: `fetch` against the MedPoint API.
 *
 * This is the live-mode counterpart to `client.ts`'s `request()`. It deliberately
 * throws the *same* `ApiError` the mock layer throws, carrying the same stable
 * `code`, so everything downstream — `useApiError()`, `errors.json`, every toast
 * and error state in the app — keeps working without knowing which backend
 * answered.
 *
 * MedPoint is Laravel. Two response envelopes matter:
 *
 *   success   { "data": {...}, "meta": { "pagination": {...} } }
 *   failure   { "message": "...", "errors": { "email": ["..."] } }
 *
 * Laravel does not send machine-readable error codes, so `toApiError` derives a
 * stable `code` from the HTTP status. Field-level 422s become a `ValidationError`
 * so a form can attach them to the offending input rather than dumping one long
 * toast at the user.
 */

import { ApiError } from "@/lib/api/client";
import { apiBaseUrl } from "@/lib/api/config";
import { clearTokens, getAccessToken, notifyUnauthorized } from "@/lib/api/tokens";

/** Laravel's 422 shape: one or more messages per field. */
export type FieldErrors = Record<string, string[]>;

/**
 * A 422 from Laravel's validator.
 *
 * Carries the per-field messages so a form can call `setError(field, …)` and
 * put the complaint next to the input it belongs to.
 */
export class ValidationError extends ApiError {
  constructor(
    message: string,
    readonly fields: FieldErrors,
  ) {
    super(message, 422, "api.validation");
    this.name = "ValidationError";
  }

  /** The first message for `field`, if the server complained about it. */
  fieldError(field: string): string | undefined {
    return this.fields[field]?.[0];
  }
}

/**
 * A stable `errors.json` key for a status, or `undefined` to keep the server's
 * own wording.
 *
 * `useApiError` prefers a translated `code` over `error.message`, so a code is
 * only worth assigning where a generic sentence beats what the server said.
 * That holds for the statuses below — "Unauthenticated." is not a sentence to
 * show a patient — but *not* for a business rejection like "The code is invalid
 * or has expired.", which is precise, user-facing, and better than anything
 * generic we could substitute. Those keep their message and take no code.
 */
function codeForStatus(status: number, hasMessage: boolean): string | undefined {
  if (status === 401) return "api.unauthenticated";
  if (status === 403) return "api.forbidden";
  if (status === 429) return "api.rateLimited";
  if (status >= 500) return "api.serverError";
  if (status === 0) return "api.networkError";
  if (status === 404 && !hasMessage) return "api.notFound";
  return hasMessage ? undefined : "api.requestFailed";
}

interface LaravelError {
  message?: string;
  errors?: FieldErrors;
}

function toApiError(status: number, body: unknown): ApiError {
  const payload = (body ?? {}) as LaravelError;
  const message = payload.message?.trim();

  if (status === 422 && payload.errors && Object.keys(payload.errors).length > 0) {
    const first = Object.values(payload.errors)[0]?.[0];
    return new ValidationError(first ?? message ?? "That didn't look right.", payload.errors);
  }

  // A 5xx body is a PHP stack trace. That is for the log, never for the user.
  const safeMessage =
    status >= 500 || !message
      ? "The service is temporarily unavailable. Please try again."
      : message;

  const hasMessage = status < 500 && Boolean(message);
  return new ApiError(safeMessage, status, codeForStatus(status, hasMessage));
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** Serialized as a JSON body. */
  body?: unknown;
  /** Appended as a query string; `undefined` values are dropped. */
  query?: Record<string, string | number | boolean | undefined>;
  /** Send without an `Authorization` header (login, register, password reset). */
  anonymous?: boolean;
  signal?: AbortSignal;
}

/**
 * `/api/medpoint/v1/auth/login?foo=bar`.
 *
 * The base is same-origin and relative (see `config.ts`), so this builds the
 * query string by hand rather than through `URL`, which demands an absolute base.
 */
function buildUrl(path: string, query: RequestOptions["query"]): string {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  const url = `${apiBaseUrl()}/v1${suffix}`;

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) params.set(key, String(value));
  }

  const search = params.toString();
  return search ? `${url}?${search}` : url;
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * MedPoint throttles authenticated calls (30/min per user). A burst — several
 * screens mounting at once, a dev double-render — can momentarily exceed that
 * and come back `429`, which is transient: the request was rejected before it
 * was ever processed, so replaying it is safe for *any* method. Rather than
 * blank a screen over a throttle that clears within the minute, retry a few
 * times with a short, capped backoff. A window that is genuinely exhausted
 * (backoff runs out) still surfaces the error so the user can retry by hand.
 */
const MAX_RETRIES = 3;
/** Never make a page load hang: cap any single wait, even if `Retry-After` is longer. */
const MAX_BACKOFF_MS = 2000;

function backoffMs(attempt: number, retryAfter: string | null): number {
  const seconds = retryAfter ? Number.parseInt(retryAfter, 10) : Number.NaN;
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1000, MAX_BACKOFF_MS);
  }
  // 500ms → 1s → 2s.
  return Math.min(500 * 2 ** attempt, MAX_BACKOFF_MS);
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

/** One round trip. Returns `{ parsed }` on success, or `{ retryAfter }` to signal a 429. */
async function attempt(
  path: string,
  options: RequestOptions,
): Promise<{ parsed: unknown } | { retryAfter: string | null }> {
  const { method = "GET", body, query, anonymous = false, signal } = options;

  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  if (!anonymous) {
    const token = getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    // A DNS failure, an offline device, or an abort — never an HTTP status.
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(
      "We couldn't reach the server. Check your connection and try again.",
      0,
      "api.networkError",
    );
  }

  // A 202/204 has no body; `text()` gives "" and there is nothing to parse.
  const raw = await response.text();
  const parsed = raw ? safeJson(raw) : null;

  if (!response.ok) {
    // The token is gone, expired or rejected. Drop it *and* tell the app, so the
    // UI stops rendering a signed-in shell over a session that no longer exists.
    if (response.status === 401) {
      clearTokens();
      notifyUnauthorized();
    }
    // A throttle: hand the caller the reset hint so it can decide to back off.
    if (response.status === 429) {
      return { retryAfter: response.headers.get("Retry-After") };
    }
    throw toApiError(response.status, parsed);
  }

  return { parsed };
}

/**
 * The transport. Returns the parsed body *with its envelope intact* — callers
 * decide whether they want `data` or the whole thing. Transparently retries a
 * throttled (`429`) request a few times before giving up.
 */
async function send(path: string, options: RequestOptions): Promise<unknown> {
  let lastRetryAfter: string | null = null;

  for (let tries = 0; tries <= MAX_RETRIES; tries++) {
    const result = await attempt(path, options);
    if ("parsed" in result) return result.parsed;

    lastRetryAfter = result.retryAfter;
    if (tries < MAX_RETRIES) {
      await sleep(backoffMs(tries, lastRetryAfter), options.signal);
    }
  }

  // Still throttled after every retry — surface it so the UI can offer "try again".
  throw new ApiError(
    "You're doing that a bit too fast. Please wait a moment and try again.",
    429,
    "api.rateLimited",
  );
}

/**
 * One call to MedPoint, unwrapped to its `data` payload.
 *
 * `T` is the *wire* shape (snake_case, money as strings). Mapping it onto the
 * app's domain model is the caller's job — see `medpoint/mappers.ts`.
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const parsed = await send(path, options);

  if (parsed && typeof parsed === "object" && "data" in parsed) {
    return (parsed as { data: T }).data;
  }
  return parsed as T;
}

/** Pagination as MedPoint reports it, alongside `data`. */
export interface WirePagination {
  total: number;
  count: number;
  per_page: number;
  current_page: number;
  total_pages: number;
}

/** A list call, keeping the `meta.pagination` that `apiRequest` would discard. */
export async function apiList<T>(
  path: string,
  options: RequestOptions = {},
): Promise<{ items: T[]; pagination?: WirePagination }> {
  const envelope = (await send(path, options)) as {
    data?: T[];
    meta?: { pagination?: WirePagination };
  } | null;

  return {
    items: envelope?.data ?? [],
    pagination: envelope?.meta?.pagination,
  };
}
