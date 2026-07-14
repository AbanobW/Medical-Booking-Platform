"use client";

import Link from "next/link";
import { HeartOff } from "lucide-react";
import { useTranslations } from "next-intl";

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
import { useApiError } from "@/lib/i18n/use-api-error";

export default function PatientFavoritesPage() {
  const t = useTranslations("patient");
  const describeError = useApiError();

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
        <h2 className="text-2xl font-bold tracking-tight">
          {t("favorites.title")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {favorites.length > 0
            ? t("favorites.count", { count: favorites.length })
            : t("favorites.subtitle")}
        </p>
      </div>

      {isLoading ? (
        <ProviderListSkeleton count={6} />
      ) : error ? (
        <ErrorState
          title={t("favorites.error")}
          description={describeError(error)}
          onRetry={refetch}
        />
      ) : favorites.length === 0 ? (
        <EmptyState
          icon={HeartOff}
          title={t("favorites.emptyTitle")}
          description={t("favorites.emptyDescription")}
          action={
            <Button
              render={<Link href="/search" />}
              className="h-10 rounded-xl px-4"
            >
              {t("favorites.browse")}
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
