"use client";

import { useTranslations } from "next-intl";
import { useCallback } from "react";

import { ApiError } from "@/lib/api/client";

/**
 * Turns a thrown error into a message the user can actually read.
 *
 * The API layer tags each failure with a stable `code`; this resolves that code
 * against `messages/<locale>/errors.json`. An untagged error — or one whose
 * code has no translation yet — falls back to its English `message`, so a
 * missing key degrades to the old behaviour rather than to a blank toast.
 *
 *     const describeError = useApiError();
 *     catch (error) { toast.error(describeError(error)); }
 */
export function useApiError() {
  const t = useTranslations("errors");
  const tCommon = useTranslations("common");

  return useCallback(
    (error: unknown): string => {
      if (error instanceof ApiError && error.code) {
        // `has` keeps a not-yet-translated code from throwing at render time.
        if (t.has(error.code)) {
          return t(error.code, error.params ?? {});
        }
      }

      if (error instanceof Error && error.message) {
        return error.message;
      }

      return tCommon("states.error");
    },
    [t, tCommon],
  );
}

/**
 * The same thing, for an outcome that is *returned* rather than thrown.
 *
 * `validateCoupon` reports a refusal as a value, not an exception, so it never
 * reaches `useApiError`. It carries the same `errors.coupon.*` code, so it
 * resolves the same way — with the English sentence as the fallback.
 */
export function useCouponMessage() {
  const t = useTranslations("errors");

  return useCallback(
    (result: {
      message: string;
      code?: string;
      params?: Record<string, string | number>;
    }): string => {
      if (result.code && t.has(result.code)) {
        return t(result.code, result.params ?? {});
      }
      return result.message;
    },
    [t],
  );
}
