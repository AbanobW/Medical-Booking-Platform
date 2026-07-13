"use client";

import Link from "next/link";
import { HeartOff } from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import { ProviderCard } from "@/components/shared/provider-card";
import {
  EmptyState,
  ErrorState,
  ProviderListSkeleton,
} from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { useAsync } from "@/hooks/use-async";
import { getFavorites } from "@/lib/api/engagement";

export default function PatientFavoritesPage() {
  const { user } = useAuth();
  const patientId = user?.id ?? "";

  const { data, error, isLoading, refetch, setData } = useAsync(
    () => getFavorites(patientId),
    [patientId],
  );

  const favorites = data ?? [];

  /**
   * `ProviderCard` already persists the toggle — we only drop the card from the
   * list so it disappears immediately instead of waiting for a refetch.
   */
  function onFavoriteChange(providerId: string, isFavorite: boolean) {
    if (isFavorite) return;
    setData((current) => (current ?? []).filter((p) => p.id !== providerId));
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Favorites</h2>
        <p className="text-sm text-muted-foreground">
          {favorites.length > 0
            ? `${favorites.length} saved provider${favorites.length === 1 ? "" : "s"}.`
            : "Providers you save appear here for quick rebooking."}
        </p>
      </div>

      {isLoading ? (
        <ProviderListSkeleton count={6} />
      ) : error ? (
        <ErrorState
          title="Couldn't load your favorites"
          description={error.message}
          onRetry={refetch}
        />
      ) : favorites.length === 0 ? (
        <EmptyState
          icon={HeartOff}
          title="No favorites yet"
          description="Tap the heart on any provider to save them here."
          action={
            <Button
              render={<Link href="/search" />}
              className="h-10 rounded-xl px-4"
            >
              Browse providers
            </Button>
          }
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {favorites.map((provider) => (
            <ProviderCard
              key={provider.id}
              provider={provider}
              isFavorite
              onFavoriteChange={onFavoriteChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}
