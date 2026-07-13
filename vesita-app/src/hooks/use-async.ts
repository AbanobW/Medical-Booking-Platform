"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface AsyncState<T> {
  data: T | undefined;
  error: Error | undefined;
  isLoading: boolean;
  /** Re-runs the request without clearing the current data. */
  refetch: () => void;
  /** Optimistically overwrite the local copy. */
  setData: (updater: T | ((current: T | undefined) => T)) => void;
}

/**
 * Runs an async service call and tracks loading/error/data.
 *
 * `deps` behaves like a `useEffect` dependency array — the request re-runs
 * whenever it changes. Results from stale requests are discarded, so rapid
 * filter changes can't render an out-of-order response.
 */
export function useAsync<T>(
  fn: () => Promise<T>,
  deps: React.DependencyList = [],
): AsyncState<T> {
  const [data, setDataState] = useState<T>();
  const [error, setError] = useState<Error>();
  const [isLoading, setIsLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  // Keep the latest `fn` without making it a dependency of the effect.
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const requestId = useRef(0);

  useEffect(() => {
    const id = ++requestId.current;
    let cancelled = false;

    setIsLoading(true);
    setError(undefined);

    fnRef
      .current()
      .then((result) => {
        // Ignore responses that a newer request has already superseded.
        if (cancelled || id !== requestId.current) return;
        setDataState(result);
      })
      .catch((err: unknown) => {
        if (cancelled || id !== requestId.current) return;
        setError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        if (cancelled || id !== requestId.current) return;
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const refetch = useCallback(() => setNonce((n) => n + 1), []);

  const setData = useCallback((updater: T | ((current: T | undefined) => T)) => {
    setDataState((current) =>
      typeof updater === "function"
        ? (updater as (c: T | undefined) => T)(current)
        : updater,
    );
  }, []);

  return { data, error, isLoading, refetch, setData };
}

/**
 * Wraps a mutating service call: tracks in-flight state and surfaces errors,
 * so buttons can disable themselves and forms can show a message.
 */
export function useMutation<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error>();

  const mutate = useCallback(
    async (...args: TArgs): Promise<TResult> => {
      setIsPending(true);
      setError(undefined);
      try {
        return await fn(...args);
      } catch (err: unknown) {
        const normalized = err instanceof Error ? err : new Error(String(err));
        setError(normalized);
        throw normalized;
      } finally {
        setIsPending(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return { mutate, isPending, error };
}

/** Debounces a rapidly-changing value (search inputs, filter sliders). */
export function useDebounced<T>(value: T, delayMs = 350): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
