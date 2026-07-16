"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  CalendarCheck,
  FlaskConical,
  HomeIcon,
  MapPin,
  Phone,
} from "lucide-react";

import { AvailabilityPanel } from "@/components/marketing/availability-panel";
import { BranchesSection } from "@/components/marketing/branches-section";
import { InsuranceCard } from "@/components/marketing/insurance-card";
import { NearbySection } from "@/components/marketing/nearby-section";
import { PackagesGrid } from "@/components/marketing/packages-grid";
import { ProfileHero } from "@/components/marketing/profile-hero";
import { ProviderNotFound } from "@/components/marketing/provider-not-found";
import { ReviewsSection } from "@/components/marketing/reviews-section";
import { ServiceCatalog } from "@/components/marketing/service-catalog";
import { providerSubtitle } from "@/components/shared/provider-card";
import { MapPlaceholder } from "@/components/shared/map-placeholder";
import { ErrorState, ProfileSkeleton } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAsync } from "@/hooks/use-async";
import { getProviderBySlug } from "@/lib/api/providers";
import { useDomain, useFormat } from "@/lib/i18n/use-format";
import type { Lab } from "@/lib/types";

export default function LabProfilePage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? "";

  const t = useTranslations("profile");
  const tCommon = useTranslations("common");
  const { formatEGP } = useFormat();
  const { localized } = useDomain();

  const { data, error, isLoading, refetch } = useAsync(
    () => getProviderBySlug(slug),
    [slug],
  );

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <ProfileSkeleton />
      </div>
    );
  }

  if (error) {
    if (/not found/i.test(error.message)) {
      return (
        <ProviderNotFound
          title={t("notFound.labTitle")}
          backHref="/search?type=lab"
          backLabel={t("notFound.browseLabs")}
        />
      );
    }
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-24 sm:px-6 lg:px-8">
        <ErrorState title={t("error.loadTitle")} onRetry={refetch} />
      </div>
    );
  }

  if (!data || data.type !== "lab") {
    return (
      <ProviderNotFound
        title={t("notFound.labTitle")}
        description={t("notFound.labDescription")}
        backHref="/search?type=lab"
        backLabel={t("notFound.browseLabs")}
      />
    );
  }

  const lab: Lab = data;
  const activeTests = lab.tests.filter((test) => test.isActive);
  const activePackages = lab.packages.filter((p) => p.isActive);
  const address = lab.address?.trim() || null;
  const bio =
    lab.bio && (lab.bio.en.trim() || lab.bio.ar.trim()) ? lab.bio : null;

  const hasOverview =
    bio ||
    activeTests.length > 0 ||
    activePackages.length > 0 ||
    lab.homeSampleCollection ||
    address ||
    lab.phone ||
    lab.accreditation.length > 0;

  const defaultTab = hasOverview
    ? "overview"
    : activeTests.length > 0
      ? "tests"
      : activePackages.length > 0
        ? "packages"
        : lab.branches.length > 0
          ? "branches"
          : "reviews";

  const overview = hasOverview ? (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t("about.title", { name: lab.name })}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {bio && (
            <p className="text-sm leading-relaxed text-foreground/90">
              {localized(bio)}
            </p>
          )}

          {(activeTests.length > 0 ||
            activePackages.length > 0 ||
            lab.homeSampleCollection ||
            address ||
            lab.phone) && (
            <>
              {bio && <Separator />}
              <dl className="grid gap-4 sm:grid-cols-2">
                {(activeTests.length > 0 || activePackages.length > 0) && (
                  <div className="flex items-start gap-3">
                    <FlaskConical className="mt-0.5 size-4 shrink-0 text-primary" />
                    <div>
                      <dt className="text-xs text-muted-foreground">
                        {t("about.catalogue")}
                      </dt>
                      <dd className="text-sm font-medium tabular-nums ltr-nums">
                        {activeTests.length} · {activePackages.length}
                      </dd>
                    </div>
                  </div>
                )}

                {lab.homeSampleCollection && (
                  <div className="flex items-start gap-3">
                    <HomeIcon className="mt-0.5 size-4 shrink-0 text-primary" />
                    <div>
                      <dt className="text-xs text-muted-foreground">
                        home_collection
                      </dt>
                    </div>
                  </div>
                )}

                {address && (
                  <div className="flex items-start gap-3">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
                    <div>
                      <dt className="text-xs text-muted-foreground">
                        {t("about.mainBranch")}
                      </dt>
                      <dd className="text-sm font-medium">{address}</dd>
                    </div>
                  </div>
                )}

                {lab.phone && (
                  <div className="flex items-start gap-3">
                    <Phone className="mt-0.5 size-4 shrink-0 text-primary" />
                    <div>
                      <dt className="text-xs text-muted-foreground">
                        {t("about.phone")}
                      </dt>
                      <dd className="text-sm font-medium tabular-nums ltr-nums">
                        <a href={`tel:${lab.phone}`} className="hover:text-primary">
                          {lab.phone}
                        </a>
                      </dd>
                    </div>
                  </div>
                )}
              </dl>
            </>
          )}

          {lab.accreditation.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="mb-2 text-xs text-muted-foreground">
                  {t("about.accreditations")}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {lab.accreditation.map((item) => (
                    <Badge key={item} variant="outline" className="font-normal">
                      {item}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {lab.location && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("about.mainLocation")}</CardTitle>
          </CardHeader>
          <CardContent>
            <MapPlaceholder
              center={lab.location}
              address={lab.address ?? undefined}
              markers={[
                {
                  id: lab.id,
                  label: lab.name,
                  location: lab.location,
                  isPrimary: true,
                },
                ...lab.branches.flatMap((branch) =>
                  branch.location
                    ? [
                        {
                          id: branch.id,
                          label: branch.name,
                          location: branch.location,
                        },
                      ]
                    : [],
                ),
              ]}
            />
          </CardContent>
        </Card>
      )}

      <div className="lg:hidden">
        <AvailabilityPanel provider={lab} />
      </div>
    </div>
  ) : null;

  return (
    <div className="pb-20">
      <ProfileHero
        provider={lab}
        subtitle={providerSubtitle(lab) || null}
        chips={lab.accreditation}
      />

      <div className="mx-auto mt-10 w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
          <div className="min-w-0">
            <Tabs defaultValue={defaultTab}>
              <TabsList className="h-auto w-full overflow-x-auto rounded-xl p-1 no-scrollbar">
                {hasOverview && (
                  <TabsTrigger value="overview" className="h-9 px-4">
                    {t("tabs.overview")}
                  </TabsTrigger>
                )}
                {activeTests.length > 0 && (
                  <TabsTrigger value="tests" className="h-9 px-4">
                    {t("tabs.tests", { count: activeTests.length })}
                  </TabsTrigger>
                )}
                {activePackages.length > 0 && (
                  <TabsTrigger value="packages" className="h-9 px-4">
                    {t("tabs.packages", { count: activePackages.length })}
                  </TabsTrigger>
                )}
                {lab.branches.length > 0 && (
                  <TabsTrigger value="branches" className="h-9 px-4">
                    {t("tabs.branches", { count: lab.branches.length })}
                  </TabsTrigger>
                )}
                {lab.reviewCount !== null && (
                  <TabsTrigger value="reviews" className="h-9 px-4">
                    {t("tabs.reviews", { count: lab.reviewCount })}
                  </TabsTrigger>
                )}
              </TabsList>

              {hasOverview && (
                <TabsContent value="overview" className="mt-6">
                  {overview}
                </TabsContent>
              )}

              {activeTests.length > 0 && (
                <TabsContent value="tests" className="mt-6">
                  <ServiceCatalog
                    items={lab.tests}
                    branches={lab.branches}
                    slug={lab.slug}
                    noun="test"
                  />
                </TabsContent>
              )}

              {activePackages.length > 0 && (
                <TabsContent value="packages" className="mt-6">
                  <PackagesGrid
                    packages={lab.packages}
                    catalog={lab.tests}
                    slug={lab.slug}
                  />
                </TabsContent>
              )}

              {lab.branches.length > 0 && (
                <TabsContent value="branches" className="mt-6">
                  <BranchesSection
                    branches={lab.branches}
                    emptyDescription={t("branches.emptyLab")}
                  />
                </TabsContent>
              )}

              {lab.reviewCount !== null && (
                <TabsContent value="reviews" className="mt-6">
                  <ReviewsSection provider={lab} />
                </TabsContent>
              )}
            </Tabs>
          </div>

          <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
            {lab.price !== null && (
              <Card className="hidden border-primary/20 lg:block">
                <CardContent className="space-y-4">
                  <p className="text-2xl font-bold text-primary tabular-nums">
                    {formatEGP(lab.price)}
                  </p>
                  <Button
                    render={<Link href={`/booking/${lab.slug}`} />}
                    className="h-11 w-full rounded-xl"
                  >
                    <CalendarCheck className="size-4" />
                    {tCommon("actions.bookNow")}
                  </Button>
                </CardContent>
              </Card>
            )}

            <div className="hidden lg:block">
              <AvailabilityPanel provider={lab} />
            </div>

            {lab.acceptedInsurancePlanIds.length > 0 && (
              <InsuranceCard planIds={lab.acceptedInsurancePlanIds} />
            )}

            <NearbySection providerId={lab.id} title={t("nearby.titleLabs")} />
          </aside>
        </div>
      </div>
    </div>
  );
}
