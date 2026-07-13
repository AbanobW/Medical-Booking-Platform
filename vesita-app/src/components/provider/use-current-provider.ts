"use client";

import { useAuth } from "@/components/providers/auth-provider";
import { useAsync } from "@/hooks/use-async";
import { getProviderById } from "@/lib/api/providers";
import type { Provider } from "@/lib/types";

/**
 * Loads the signed-in provider's own listing.
 *
 * Every page under /provider is guarded by `DashboardShell`, so `user` is always
 * present by the time this runs — but the hook still degrades gracefully if the
 * account has no `providerId` attached.
 */
export function useCurrentProvider() {
  const { user } = useAuth();
  const providerId = user?.providerId ?? "";

  const { data, error, isLoading, refetch, setData } = useAsync<
    Provider | undefined
  >(
    () => (providerId ? getProviderById(providerId) : Promise.resolve(undefined)),
    [providerId],
  );

  return { providerId, provider: data, error, isLoading, refetch, setData };
}
