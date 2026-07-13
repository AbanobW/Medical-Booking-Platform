"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  BadgeCheck,
  CalendarCheck,
  Clock,
  MapPin,
  Phone,
  ScanLine,
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
import { formatDuration } from "@/lib/format";
import { formatEGP } from "@/lib/site";
import type { RadiologyCenter } from "@/lib/types";

export default function RadiologyProfilePage() {
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
          title="We couldn't find that radiology center"
          backHref="/search?type=radiology"
          backLabel="Browse radiology centers"
        />
      );
    }
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-24 sm:px-6 lg:px-8">
        <ErrorState title="Couldn't load this profile" onRetry={refetch} />
      </div>
    );
  }

  if (!data || data.type !== "radiology") {
    return (
      <ProviderNotFound
        title="We couldn't find that radiology center"
        description="This link points to a profile that isn't a radiology center. It may have moved."
        backHref="/search?type=radiology"
        backLabel="Browse radiology centers"
      />
    );
  }

  const center: RadiologyCenter = data;
  const activeScans = center.scans.filter((s) => s.isActive);
  const activePackages = center.packages.filter((p) => p.isActive);

  const averageScanMinutes = activeScans.length
    ? Math.round(
        activeScans.reduce((sum, scan) => sum + scan.durationMinutes, 0) /
          activeScans.length,
      )
    : 0;

  const overview = (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">About {center.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm leading-relaxed text-foreground/90">{center.bio}</p>

          <Separator />

          <dl className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-start gap-3">
              <ScanLine className="mt-0.5 size-4 shrink-0 text-primary" />
              <div>
                <dt className="text-xs text-muted-foreground">Catalogue</dt>
                <dd className="text-sm font-medium">
                  {activeScans.length} scans · {activePackages.length} packages
                </dd>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Clock className="mt-0.5 size-4 shrink-0 text-primary" />
              <div>
                <dt className="text-xs text-muted-foreground">Typical scan time</dt>
                <dd className="text-sm font-medium">
                  {averageScanMinutes
                    ? formatDuration(averageScanMinutes)
                    : "Varies by scan"}
                </dd>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
              <div>
                <dt className="text-xs text-muted-foreground">Main branch</dt>
                <dd className="text-sm font-medium">
                  {center.address} — {getAreaName(center.areaId)},{" "}
                  {getGovernorateName(center.governorateId)}
                </dd>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Phone className="mt-0.5 size-4 shrink-0 text-primary" />
              <div>
                <dt className="text-xs text-muted-foreground">Phone</dt>
                <dd className="text-sm font-medium tabular-nums">
                  <a href={`tel:${center.phone}`} className="hover:text-primary">
                    {center.phone}
                  </a>
                </dd>
              </div>
            </div>
          </dl>

          {center.accreditation.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="mb-2 text-xs text-muted-foreground">Accreditations</p>
                <div className="flex flex-wrap gap-1.5">
                  {center.accreditation.map((item) => (
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
            center={center.location}
            address={center.address}
            markers={[
              {
                id: center.id,
                label: center.name,
                location: center.location,
                isPrimary: true,
              },
              ...center.branches.map((branch) => ({
                id: branch.id,
                label: branch.name,
                location: branch.location,
              })),
            ]}
          />
        </CardContent>
      </Card>

      <div className="lg:hidden">
        <AvailabilityPanel provider={center} />
      </div>
    </div>
  );

  return (
    <div className="pb-20">
      <ProfileHero
        provider={center}
        subtitle="Radiology Center"
        priceLabel="Scans from"
        chips={center.accreditation.slice(0, 4)}
      />

      <div className="mx-auto mt-10 w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
          <div className="min-w-0">
            <Tabs defaultValue="overview">
              <TabsList className="h-auto w-full overflow-x-auto rounded-xl p-1 no-scrollbar">
                <TabsTrigger value="overview" className="h-9 px-4">
                  Overview
                </TabsTrigger>
                <TabsTrigger value="scans" className="h-9 px-4">
                  Scans ({activeScans.length})
                </TabsTrigger>
                <TabsTrigger value="packages" className="h-9 px-4">
                  Packages ({activePackages.length})
                </TabsTrigger>
                <TabsTrigger value="branches" className="h-9 px-4">
                  Branches ({center.branches.length})
                </TabsTrigger>
                <TabsTrigger value="reviews" className="h-9 px-4">
                  Reviews ({center.reviewCount.toLocaleString()})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-6">
                {overview}
              </TabsContent>

              <TabsContent value="scans" className="mt-6">
                <ServiceCatalog
                  items={center.scans}
                  branches={center.branches}
                  slug={center.slug}
                  noun="scan"
                />
              </TabsContent>

              <TabsContent value="packages" className="mt-6">
                <PackagesGrid
                  packages={center.packages}
                  catalog={center.scans}
                  slug={center.slug}
                />
              </TabsContent>

              <TabsContent value="branches" className="mt-6">
                <BranchesSection
                  branches={center.branches}
                  emptyDescription="This center operates from its main location only."
                />
              </TabsContent>

              <TabsContent value="reviews" className="mt-6">
                <ReviewsSection provider={center} />
              </TabsContent>
            </Tabs>
          </div>

          <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
            <Card className="border-primary/20">
              <CardContent className="space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground">Scans starting from</p>
                  <p className="text-2xl font-bold text-primary tabular-nums">
                    {formatEGP(center.price)}
                  </p>
                </div>

                <Button
                  render={<Link href={`/booking/${center.slug}`} />}
                  className="h-11 w-full rounded-xl"
                >
                  <CalendarCheck className="size-4" />
                  Book Now
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  Bring any previous imaging or referral letter with you.
                </p>
              </CardContent>
            </Card>

            <div className="hidden lg:block">
              <AvailabilityPanel provider={center} />
            </div>

            <InsuranceCard planIds={center.acceptedInsurancePlanIds} />

            <NearbySection providerId={center.id} title="Nearby centers" />
          </aside>
        </div>
      </div>
    </div>
  );
}
