"use client";

import { MapPinned } from "lucide-react";

import { ProviderCardCompact } from "@/components/shared/provider-card";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/shared/states";
import { useAsync } from "@/hooks/use-async";
import { getNearbyProviders } from "@/lib/api/providers";

/** "Nearby" rail on a provider profile — same type, closest first. */
export function NearbySection({
  providerId,
  title = "Nearby providers",
}: {
  providerId: string;
  title?: string;
}) {
  const { data, error, isLoading, refetch } = useAsync(
    () => getNearbyProviders(providerId, 4),
    [providerId],
  );

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">{title}</h2>

      {isLoading ? (
        <ListSkeleton count={3} />
      ) : error ? (
        <ErrorState
          title="Couldn't load nearby providers"
          onRetry={refetch}
          className="py-10"
        />
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={MapPinned}
          title="Nothing nearby"
          description="We couldn't find another provider close to this location."
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
