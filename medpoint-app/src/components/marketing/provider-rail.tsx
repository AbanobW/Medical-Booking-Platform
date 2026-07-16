"use client";

import Link from "next/link";
import { ArrowRight, Users } from "lucide-react";
import { useTranslations } from "next-intl";

import { SectionHeading } from "@/components/marketing/section-heading";
import { ProviderCard } from "@/components/shared/provider-card";
import { EmptyState, ErrorState, ProviderListSkeleton } from "@/components/shared/states";
import { Reveal, RevealItem } from "@/components/shared/motion";
import { Button } from "@/components/ui/button";
import { useAsync } from "@/hooks/use-async";
import { getFeaturedProviders } from "@/lib/api/providers";
import type { ProviderRole } from "@/lib/types";

/**
 * A featured-provider section: a snapping horizontal rail on mobile, a grid on
 * desktop. Carries its own loading / error / empty states.
 */
export function ProviderRail({
  type,
  eyebrow,
  title,
  description,
  limit = 6,
}: {
  type: ProviderRole;
  eyebrow?: string;
  title: string;
  description?: string;
  limit?: number;
}) {
  const t = useTranslations("home.rails");
  const { data, error, isLoading, refetch } = useAsync(
    () => getFeaturedProviders(type, limit),
    [type, limit],
  );

  const viewAll = `/search?type=${type}`;

  return (
    <section className="py-14 sm:py-16">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow={eyebrow}
          title={title}
          description={description}
          action={
            <Button
              render={<Link href={viewAll} />}
              variant="outline"
              className="h-10 rounded-xl px-4"
            >
              {t("viewAll")}
              <ArrowRight className="size-4 rtl:rotate-180" />
            </Button>
          }
        />

        {isLoading ? (
          <ProviderListSkeleton count={3} />
        ) : error ? (
          <ErrorState
            title={t("errorTitle")}
            description={t("errorDescription")}
            onRetry={refetch}
          />
        ) : !data || data.length === 0 ? (
          <EmptyState
            icon={Users}
            title={t("emptyTitle")}
            description={t("emptyDescription")}
            action={
              <Button render={<Link href={viewAll} />} className="h-10 rounded-xl px-4">
                {t("browseAll")}
              </Button>
            }
          />
        ) : (
          <Reveal className="-mx-4 flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-4 no-scrollbar md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 md:pb-0 xl:grid-cols-3">
            {data.map((provider) => (
              <RevealItem
                key={provider.id}
                className="w-[82vw] max-w-sm shrink-0 snap-start sm:w-[60vw] md:w-auto md:max-w-none"
              >
                <ProviderCard provider={provider} />
              </RevealItem>
            ))}
          </Reveal>
        )}
      </div>
    </section>
  );
}
