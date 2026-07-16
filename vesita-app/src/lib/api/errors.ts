/**
 * The error every API call throws.
 *
 * This used to live in `api/client.ts` alongside the mock database. The mock is
 * gone; the error type is not — it is the contract `useApiError()`,
 * `errors.json` and every toast are written against, so it keeps its shape and
 * its stable `code`.
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
