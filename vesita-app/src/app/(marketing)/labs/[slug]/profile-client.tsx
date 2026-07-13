"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
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
import { getAreaName, getGovernorateName } from "@/lib/data/egypt";
import { formatEGP } from "@/lib/site";
import type { Lab } from "@/lib/types";

export default function LabProfilePage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? "";

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
          title="We couldn't find that lab"
          backHref="/search?type=lab"
          backLabel="Browse labs"
        />
      );
    }
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-24 sm:px-6 lg:px-8">
        <ErrorState title="Couldn't load this profile" onRetry={refetch} />
      </div>
    );
  }

  if (!data || data.type !== "lab") {
    return (
      <ProviderNotFound
        title="We couldn't find that lab"
        description="This link points to a profile that isn't a medical lab. It may have moved."
        backHref="/search?type=lab"
        backLabel="Browse labs"
      />
    );
  }

  const lab: Lab = data;
  const activeTests = lab.tests.filter((t) => t.isActive);
  const activePackages = lab.packages.filter((p) => p.isActive);

  const overview = (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">About {lab.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm leading-relaxed text-foreground/90">{lab.bio}</p>

          <Separator />

          <dl className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-start gap-3">
              <FlaskConical className="mt-0.5 size-4 shrink-0 text-primary" />
              <div>
                <dt className="text-xs text-muted-foreground">Catalogue</dt>
                <dd className="text-sm font-medium">
                  {activeTests.length} tests · {activePackages.length} packages
                </dd>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <HomeIcon className="mt-0.5 size-4 shrink-0 text-primary" />
              <div>
                <dt className="text-xs text-muted-foreground">
                  Home sample collection
                </dt>
                <dd className="text-sm font-medium">
                  {lab.homeSampleCollection
                    ? "Available — a phlebotomist comes to you"
                    : "Not offered — visit a branch"}
                </dd>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
              <div>
                <dt className="text-xs text-muted-foreground">Main branch</dt>
                <dd className="text-sm font-medium">
                  {lab.address} — {getAreaName(lab.areaId)},{" "}
                  {getGovernorateName(lab.governorateId)}
                </dd>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Phone className="mt-0.5 size-4 shrink-0 text-primary" />
              <div>
                <dt className="text-xs text-muted-foreground">Phone</dt>
                <dd className="text-sm font-medium tabular-nums">
                  <a href={`tel:${lab.phone}`} className="hover:text-primary">
                    {lab.phone}
                  </a>
                </dd>
              </div>
            </div>
          </dl>

          {lab.accreditation.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="mb-2 text-xs text-muted-foreground">Accreditations</p>
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Main location</CardTitle>
        </CardHeader>
        <CardContent>
          <MapPlaceholder
            center={lab.location}
            address={lab.address}
            markers={[
              {
                id: lab.id,
                label: lab.name,
                location: lab.location,
                isPrimary: true,
              },
              ...lab.branches.map((branch) => ({
                id: branch.id,
                label: branch.name,
                location: branch.location,
              })),
            ]}
          />
        </CardContent>
      </Card>

      <div className="lg:hidden">
        <AvailabilityPanel provider={lab} />
      </div>
    </div>
  );

  return (
    <div className="pb-20">
      <ProfileHero
        provider={lab}
        subtitle="Medical Laboratory"
        priceLabel="Tests from"
        chips={[
          ...lab.accreditation.slice(0, 3),
          ...(lab.homeSampleCollection ? ["Home sample collection"] : []),
        ]}
      />

      <div className="mx-auto mt-10 w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
          <div className="min-w-0">
            <Tabs defaultValue="overview">
              <TabsList className="h-auto w-full overflow-x-auto rounded-xl p-1 no-scrollbar">
                <TabsTrigger value="overview" className="h-9 px-4">
                  Overview
                </TabsTrigger>
                <TabsTrigger value="tests" className="h-9 px-4">
                  Tests ({activeTests.length})
                </TabsTrigger>
                <TabsTrigger value="packages" className="h-9 px-4">
                  Packages ({activePackages.length})
                </TabsTrigger>
                <TabsTrigger value="branches" className="h-9 px-4">
                  Branches ({lab.branches.length})
                </TabsTrigger>
                <TabsTrigger value="reviews" className="h-9 px-4">
                  Reviews ({lab.reviewCount.toLocaleString()})
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
                  emptyDescription="This lab operates from its main location only."
                />
              </TabsContent>

              <TabsContent value="reviews" className="mt-6">
                <ReviewsSection provider={lab} />
              </TabsContent>
            </Tabs>
          </div>

          <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
            <Card className="border-primary/20">
              <CardContent className="space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground">Tests starting from</p>
                  <p className="text-2xl font-bold text-primary tabular-nums">
                    {formatEGP(lab.price)}
                  </p>
                </div>

                {lab.homeSampleCollection && (
                  <p className="flex items-start gap-2 rounded-xl bg-accent p-3 text-xs text-accent-foreground">
                    <HomeIcon className="mt-0.5 size-3.5 shrink-0 text-primary" />
                    Home sample collection available — pick the home visit option while
                    booking.
                  </p>
                )}

                <Button
                  render={<Link href={`/booking/${lab.slug}`} />}
                  className="h-11 w-full rounded-xl"
                >
                  <CalendarCheck className="size-4" />
                  Book Now
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  Free cancellation up to 4 hours before your appointment.
                </p>
              </CardContent>
            </Card>

            <div className="hidden lg:block">
              <AvailabilityPanel provider={lab} />
            </div>

            <InsuranceCard planIds={lab.acceptedInsurancePlanIds} />

            <NearbySection providerId={lab.id} title="Nearby labs" />
          </aside>
        </div>
      </div>
    </div>
  );
}
