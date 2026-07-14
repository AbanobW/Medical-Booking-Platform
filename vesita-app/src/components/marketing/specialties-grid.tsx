"use client";

import Link from "next/link";
import { ArrowRight, Stethoscope } from "lucide-react";
import { useTranslations } from "next-intl";

import { SectionHeading } from "@/components/marketing/section-heading";
import { DynamicIcon } from "@/components/shared/dynamic-icon";
import { Reveal, RevealItem } from "@/components/shared/motion";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAsync } from "@/hooks/use-async";
import { getPopularSpecialties } from "@/lib/api/providers";
import { useDomain } from "@/lib/i18n/use-format";

/** The specialty tiles under the hero — the second-most-used entry point. */
export function SpecialtiesGrid() {
  const t = useTranslations("home.specialties");
  const { getSpecialtyName } = useDomain();
  const { data, error, isLoading, refetch } = useAsync(
    () => getPopularSpecialties(12),
    [],
  );

  return (
    <section className="py-14 sm:py-16">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow={t("eyebrow")}
          title={t("title")}
          description={t("description")}
          action={
            <Button
              render={<Link href="/search?type=doctor" />}
              variant="outline"
              className="h-10 rounded-xl px-4"
            >
              {t("allDoctors")}
              <ArrowRight className="size-4 rtl:rotate-180" />
            </Button>
          }
        />

        {isLoading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {Array.from({ length: 12 }, (_, i) => (
              <Skeleton key={i} className="h-32 rounded-2xl" />
            ))}
          </div>
        ) : error ? (
          <ErrorState title={t("errorTitle")} onRetry={refetch} className="py-12" />
        ) : !data || data.length === 0 ? (
          <EmptyState
            icon={Stethoscope}
            title={t("emptyTitle")}
            description={t("emptyDescription")}
          />
        ) : (
          <Reveal className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {data.map((specialty) => (
              <RevealItem key={specialty.id}>
                <Link
                  href={`/search?type=doctor&specialtyId=${specialty.id}`}
                  className="group flex h-full flex-col items-center justify-center gap-3 rounded-2xl border bg-card p-5 text-center shadow-soft transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-lift focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <span className="flex size-12 items-center justify-center rounded-2xl bg-accent text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <DynamicIcon name={specialty.icon} className="size-6" />
                  </span>
                  <span className="text-sm font-semibold leading-tight">
                    {getSpecialtyName(specialty.id)}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {t("doctorCount", { count: specialty.doctorCount })}
                  </span>
                </Link>
              </RevealItem>
            ))}
          </Reveal>
        )}
      </div>
    </section>
  );
}
