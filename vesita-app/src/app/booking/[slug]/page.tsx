"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, SearchX } from "lucide-react";
import { useTranslations } from "next-intl";

import { BookingWizard } from "@/components/booking/booking-wizard";
import { providerHref } from "@/components/shared/provider-card";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAsync } from "@/hooks/use-async";
import { ApiError } from "@/lib/api/client";
import { getProviderBySlug } from "@/lib/api/providers";
import { useApiError } from "@/lib/i18n/use-api-error";

function WizardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-28 w-full rounded-2xl" />
      <div className="space-y-6 rounded-2xl border bg-card p-6">
        <Skeleton className="h-8 w-full rounded-xl" />
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-11 w-40 rounded-xl" />
      </div>
    </div>
  );
}

export default function BookingPage() {
  const params = useParams<{ slug: string }>();
  const slug = typeof params.slug === "string" ? params.slug : "";

  const t = useTranslations("booking");
  const describeError = useApiError();

  const { data: provider, error, isLoading, refetch } = useAsync(
    () => getProviderBySlug(slug),
    [slug],
  );

  const isNotFound = error instanceof ApiError && error.status === 404;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <Button
        variant="ghost"
        size="sm"
        className="mb-4 h-9 rounded-xl px-2"
        render={<Link href={provider ? providerHref(provider) : "/search"} />}
      >
        <ArrowLeft className="size-4 rtl:rotate-180" />
        {provider ? t("page.backToProfile") : t("page.backToSearch")}
      </Button>

      {isLoading ? (
        <WizardSkeleton />
      ) : isNotFound ? (
        <EmptyState
          icon={SearchX}
          title={t("page.notFoundTitle")}
          description={t("page.notFoundDescription")}
          action={
            <Button className="h-10 rounded-xl px-4" render={<Link href="/search" />}>
              {t("page.browseProviders")}
            </Button>
          }
        />
      ) : error ? (
        <ErrorState description={describeError(error)} onRetry={refetch} />
      ) : provider ? (
        <BookingWizard provider={provider} />
      ) : null}
    </div>
  );
}
