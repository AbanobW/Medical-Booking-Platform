"use client";

import { MapPinned } from "lucide-react";
import { useTranslations } from "next-intl";

import { ProviderCardCompact } from "@/components/shared/provider-card";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/shared/states";
import { useAsync } from "@/hooks/use-async";
import { getNearbyProviders } from "@/lib/api/providers";

/** "Nearby" rail on a provider profile — same type, closest first. */
export function NearbySection({
  providerId,
  title,
}: {
  providerId: string;
  title?: string;
}) {
  const t = useTranslations("profile");

  const { data, error, isLoading, refetch } = useAsync(
    () => getNearbyProviders(providerId, 4),
    [providerId],
  );

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">
        {title ?? t("nearby.titleProviders")}
      </h2>

      {isLoading ? (
        <ListSkeleton count={3} />
      ) : error ? (
        <ErrorState
          title={t("nearby.errorTitle")}
          onRetry={refetch}
          className="py-10"
        />
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={MapPinned}
          title={t("nearby.emptyTitle")}
          description={t("nearby.emptyDescription")}
          className="py-10"
        />
      ) : (
        <div className="space-y-3">
          {data.map((provider) => (
            <ProviderCardCompact key={provider.id} provider={provider} />
          ))}
        </div>
      )}
    </section>
  );
}
