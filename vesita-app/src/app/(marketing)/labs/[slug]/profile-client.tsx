"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  BadgeCheck,
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
import { MapPlaceholder } from "@/components/shared/map-placeholder";
import { ErrorState, ProfileSkeleton } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAsync } from "@/hooks/use-async";
import { getProviderBySlug } from "@/lib/api/providers";
import { DASH, orDash } from "@/lib/i18n/format";
import { useDomain, useFormat } from "@/lib/i18n/use-format";
import { useLabels } from "@/lib/i18n/use-labels";
import { BUSINESS } from "@/lib/site";
import type { Lab } from "@/lib/types";

export default function LabProfilePage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? "";

  const t = useTranslations("profile");
  const tCommon = useTranslations("common");
  const { formatEGP } = useFormat();
  const { named, localized, getAreaName, getGovernorateName } = useDomain();
  const L = useLabels();

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

  /** Street address, area and governorate — as much of each as the API answered. */
  const place = [
    lab.address,
    [
      lab.areaId ? getAreaName(lab.areaId) : null,
      lab.governorateId ? getGovernorateName(lab.governorateId) : null,
    ]
      .filter((part): part is string => Boolean(part))
      .join(", "),
  ]
    .filter((part): part is string => Boolean(part))
    .join(" — ");

  const overview = (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t("about.title", { name: named(lab) })}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm leading-relaxed text-foreground/90">
            {localized(lab.bio)}
          </p>

          <Separator />

          <dl className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-start gap-3">
              <FlaskConical className="mt-0.5 size-4 shrink-0 text-primary" />
              <div>
                <dt className="text-xs text-muted-foreground">
                  {t("about.catalogue")}
                </dt>
                <dd className="text-sm font-medium">
                  {t("about.catalogueTests", {
                    tests: activeTests.length,
                    packages: activePackages.length,
                  })}
                </dd>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <HomeIcon className="mt-0.5 size-4 shrink-0 text-primary" />
              <div>
                <dt className="text-xs text-muted-foreground">
                  {t("about.homeCollection")}
                </dt>
                <dd className="text-sm font-medium">
                  {lab.homeSampleCollection
                    ? t("about.homeCollectionYes")
                    : t("about.homeCollectionNo")}
                </dd>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
              <div>
                <dt className="text-xs text-muted-foreground">
                  {t("about.mainBranch")}
                </dt>
                <dd className="text-sm font-medium">{orDash(place)}</dd>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Phone className="mt-0.5 size-4 shrink-0 text-primary" />
              <div>
                <dt className="text-xs text-muted-foreground">{t("about.phone")}</dt>
                <dd className="text-sm font-medium tabular-nums ltr-nums">
                  {lab.phone ? (
                    <a href={`tel:${lab.phone}`} className="hover:text-primary">
                      {lab.phone}
                    </a>
                  ) : (
                    DASH
                  )}
                </dd>
              </div>
            </div>
          </dl>

          {lab.accreditation.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="mb-2 text-xs text-muted-foreground">
                  {t("about.accreditations")}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {lab.accreditation.map((item) => (
                    <Badge
                      key={item}
                      variant="secondary"
                      className="gap-1 bg-success/10 font-normal text-success"
                    >
                      <BadgeCheck className="size-3" />
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
                  label: named(lab),
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
  );

  return (
    <div className="pb-20">
      <ProfileHero
        provider={lab}
        subtitle={t("hero.subtitleLab")}
        priceLabel={t("hero.priceTestsFrom")}
        chips={[
          ...lab.accreditation.slice(0, 3).map(L.accreditation),
          ...(lab.homeSampleCollection ? [t("hero.chipHomeCollection")] : []),
        ]}
      />

      <div className="mx-auto mt-10 w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
          <div className="min-w-0">
            <Tabs defaultValue="overview">
              <TabsList className="h-auto w-full overflow-x-auto rounded-xl p-1 no-scrollbar">
                <TabsTrigger value="overview" className="h-9 px-4">
                  {t("tabs.overview")}
                </TabsTrigger>
                <TabsTrigger value="tests" className="h-9 px-4">
                  {t("tabs.tests", { count: activeTests.length })}
                </TabsTrigger>
                <TabsTrigger value="packages" className="h-9 px-4">
                  {t("tabs.packages", { count: activePackages.length })}
                </TabsTrigger>
                <TabsTrigger value="branches" className="h-9 px-4">
                  {t("tabs.branches", { count: lab.branches.length })}
                </TabsTrigger>
                <TabsTrigger value="reviews" className="h-9 px-4">
                  {lab.reviewCount === null
                    ? t("tabs.reviewsNoCount")
                    : t("tabs.reviews", { count: lab.reviewCount })}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-6">
                {overview}
              </TabsContent>

              <TabsContent value="tests" className="mt-6">
                <ServiceCatalog
                  items={lab.tests}
                  branches={lab.branches}
                  slug={lab.slug}
                  noun="test"
                />
              </TabsContent>

              <TabsContent value="packages" className="mt-6">
                <PackagesGrid
                  packages={lab.packages}
                  catalog={lab.tests}
                  slug={lab.slug}
                />
              </TabsContent>

              <TabsContent value="branches" className="mt-6">
                <BranchesSection
                  branches={lab.branches}
                  emptyDescription={t("branches.emptyLab")}
                />
              </TabsContent>

              <TabsContent value="reviews" className="mt-6">
                <ReviewsSection provider={lab} />
              </TabsContent>
            </Tabs>
          </div>

          <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
            {/*
              The sticky desktop half of the booking pair — see ProfileHero. Hidden
              below `lg`, where the hero carries the CTA instead: down there this
              sidebar stacks underneath all the tab content, so it would sit far
              below the fold and simply repeat what the hero already said.
            */}
            <Card className="hidden border-primary/20 lg:block">
              <CardContent className="space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t("sidebar.testsFrom")}
                  </p>
                  <p className="text-2xl font-bold text-primary tabular-nums">
                    {formatEGP(lab.price)}
                  </p>
                </div>

                {lab.homeSampleCollection && (
                  <p className="flex items-start gap-2 rounded-xl bg-accent p-3 text-xs text-accent-foreground">
                    <HomeIcon className="mt-0.5 size-3.5 shrink-0 text-primary" />
                    {t("sidebar.homeCollectionNote")}
                  </p>
                )}

                <Button
                  render={<Link href={`/booking/${lab.slug}`} />}
                  className="h-11 w-full rounded-xl"
                >
                  <CalendarCheck className="size-4" />
                  {tCommon("actions.bookNow")}
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  {t("sidebar.freeCancellation", {
                    hours: BUSINESS.freeCancellationHours,
                  })}
                </p>
              </CardContent>
            </Card>

            <div className="hidden lg:block">
              <AvailabilityPanel provider={lab} />
            </div>

            <InsuranceCard planIds={lab.acceptedInsurancePlanIds} />

            <NearbySection providerId={lab.id} title={t("nearby.titleLabs")} />
          </aside>
        </div>
      </div>
    </div>
  );
}
