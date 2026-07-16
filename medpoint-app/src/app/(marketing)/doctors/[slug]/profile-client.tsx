"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  Building2,
  CalendarCheck,
  MapPin,
  Stethoscope,
} from "lucide-react";

import { AvailabilityPanel } from "@/components/marketing/availability-panel";
import { BranchPrice } from "@/components/marketing/branch-pricing";
import { BranchesSection } from "@/components/marketing/branches-section";
import { InsuranceCard } from "@/components/marketing/insurance-card";
import { NearbySection } from "@/components/marketing/nearby-section";
import { ProfileHero } from "@/components/marketing/profile-hero";
import { ProviderNotFound } from "@/components/marketing/provider-not-found";
import { ReviewsSection } from "@/components/marketing/reviews-section";
import {
  apiDoctorTaxonomy,
  providerSubtitle,
} from "@/components/shared/provider-card";
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
import type { Doctor } from "@/lib/types";

export default function DoctorProfilePage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? "";

  const t = useTranslations("profile");
  const tCommon = useTranslations("common");
  const { formatDuration, formatEGP } = useFormat();
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
    const isNotFound = /not found/i.test(error.message);
    if (isNotFound) {
      return (
        <ProviderNotFound
          title={t("notFound.doctorTitle")}
          backHref="/search?type=doctor"
          backLabel={t("notFound.browseDoctors")}
        />
      );
    }
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-24 sm:px-6 lg:px-8">
        <ErrorState title={t("error.loadTitle")} onRetry={refetch} />
      </div>
    );
  }

  if (!data || data.type !== "doctor") {
    return (
      <ProviderNotFound
        title={t("notFound.doctorTitle")}
        description={t("notFound.doctorDescription")}
        backHref="/search?type=doctor"
        backLabel={t("notFound.browseDoctors")}
      />
    );
  }

  const doctor: Doctor = data;
  const { specialty, subspecialty } = apiDoctorTaxonomy(doctor);
  const consultations = doctor.consultationTypes.filter((c) => c.isActive);
  const address = doctor.address?.trim() || null;
  const bio =
    doctor.bio &&
    (doctor.bio.en.trim() || doctor.bio.ar.trim())
      ? doctor.bio
      : null;

  const hasAbout =
    bio ||
    specialty ||
    doctor.subSpecialties.length > 0 ||
    doctor.gender ||
    doctor.syndicateNumber;

  const hasClinic = Boolean(doctor.clinicName || address || doctor.location);

  const about = hasAbout ? (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {t("about.title", { name: doctor.name })}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {bio && (
          <p className="text-sm leading-relaxed text-foreground/90">
            {localized(bio)}
          </p>
        )}

        {(specialty || doctor.gender || doctor.syndicateNumber) && (
          <>
            {bio && <Separator />}
            <dl className="grid gap-4 sm:grid-cols-2">
              {specialty && (
                <div className="flex items-start gap-3">
                  <Stethoscope className="mt-0.5 size-4 shrink-0 text-primary" />
                  <div>
                    <dt className="text-xs text-muted-foreground">
                      {t("about.specialty")}
                    </dt>
                    <dd className="text-sm font-medium">{specialty}</dd>
                  </div>
                </div>
              )}

              {doctor.gender && (
                <div className="flex items-start gap-3">
                  <div>
                    <dt className="text-xs text-muted-foreground">
                      {t("about.gender")}
                    </dt>
                    <dd className="text-sm font-medium capitalize">{doctor.gender}</dd>
                  </div>
                </div>
              )}

              {doctor.syndicateNumber && (
                <div className="flex items-start gap-3">
                  <div>
                    <dt className="text-xs text-muted-foreground">
                      {t("about.syndicate")}
                    </dt>
                    <dd className="text-sm font-medium tabular-nums ltr-nums">
                      {doctor.syndicateNumber}
                    </dd>
                  </div>
                </div>
              )}
            </dl>
          </>
        )}

        {doctor.subSpecialties.length > 0 && (
          <>
            <Separator />
            <div>
              <p className="mb-2 text-xs text-muted-foreground">{t("about.focus")}</p>
              <div className="flex flex-wrap gap-1.5">
                {doctor.subSpecialties.map((item) => (
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
  ) : null;

  const services =
    consultations.length > 0 ? (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("consultations.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-3 sm:grid-cols-2">
            {consultations.map((consultation) => (
              <li
                key={consultation.id}
                className="flex flex-col gap-2 rounded-xl border p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <h4 className="font-medium leading-tight">{consultation.name}</h4>
                  <BranchPrice service={consultation} branches={doctor.branches} />
                </div>
                {consultation.description &&
                  (consultation.description.en.trim() ||
                    consultation.description.ar.trim()) && (
                    <p className="text-sm text-muted-foreground">
                      {localized(consultation.description)}
                    </p>
                  )}
                <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                  {consultation.durationMinutes !== null && (
                    <Badge variant="secondary" className="font-normal">
                      {formatDuration(consultation.durationMinutes)}
                    </Badge>
                  )}
                  <Button
                    render={
                      <Link
                        href={`/booking/${doctor.slug}?serviceId=${consultation.id}`}
                      />
                    }
                    size="sm"
                    variant="outline"
                    className="rounded-lg"
                  >
                    {t("consultations.book")}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    ) : null;

  const clinic = hasClinic ? (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("about.clinicTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-3">
          <Building2 className="mt-0.5 size-4 shrink-0 text-primary" />
          <div>
            {doctor.clinicName && (
              <p className="font-medium">{doctor.clinicName}</p>
            )}
            {address && (
              <p className="mt-0.5 flex items-start gap-1.5 text-sm text-muted-foreground">
                <MapPin className="mt-0.5 size-3.5 shrink-0" />
                <span>{address}</span>
              </p>
            )}
          </div>
        </div>

        {doctor.location && (
          <MapPlaceholder
            center={doctor.location}
            address={doctor.address ?? undefined}
            markers={[
              {
                id: doctor.id,
                label: doctor.clinicName ?? doctor.name,
                location: doctor.location,
                isPrimary: true,
              },
            ]}
          />
        )}
      </CardContent>
    </Card>
  ) : null;

  const heroSubtitle = providerSubtitle(doctor) || null;
  const extraSubspecialties = subspecialty
    ? doctor.subSpecialties.filter((s) => s !== subspecialty)
    : doctor.subSpecialties;

  const defaultTab = hasAbout
    ? "about"
    : consultations.length > 0
      ? "services"
      : hasClinic
        ? "clinic"
        : doctor.branches.length > 0
          ? "branches"
          : "reviews";

  return (
    <div className="pb-20">
      <ProfileHero
        provider={doctor}
        subtitle={heroSubtitle}
        chips={extraSubspecialties}
      />

      <div className="mx-auto mt-10 w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
          <div className="min-w-0">
            <Tabs defaultValue={defaultTab}>
              <TabsList className="h-auto w-full overflow-x-auto rounded-xl p-1 no-scrollbar">
                {hasAbout && (
                  <TabsTrigger value="about" className="h-9 px-4">
                    {t("tabs.overview")}
                  </TabsTrigger>
                )}
                {consultations.length > 0 && (
                  <TabsTrigger value="services" className="h-9 px-4">
                    {t("tabs.services")}
                  </TabsTrigger>
                )}
                {hasClinic && (
                  <TabsTrigger value="clinic" className="h-9 px-4">
                    {t("tabs.clinic")}
                  </TabsTrigger>
                )}
                {doctor.branches.length > 0 && (
                  <TabsTrigger value="branches" className="h-9 px-4">
                    {t("tabs.branches", { count: doctor.branches.length })}
                  </TabsTrigger>
                )}
                {doctor.reviewCount !== null && (
                  <TabsTrigger value="reviews" className="h-9 px-4">
                    {t("tabs.reviews", { count: doctor.reviewCount })}
                  </TabsTrigger>
                )}
              </TabsList>

              {hasAbout && (
                <TabsContent value="about" className="mt-6 space-y-6">
                  {about}
                  <div className="lg:hidden">
                    <AvailabilityPanel provider={doctor} />
                  </div>
                </TabsContent>
              )}

              {consultations.length > 0 && (
                <TabsContent value="services" className="mt-6">
                  {services}
                </TabsContent>
              )}

              {hasClinic && (
                <TabsContent value="clinic" className="mt-6 space-y-6">
                  {clinic}
                </TabsContent>
              )}

              {doctor.branches.length > 0 && (
                <TabsContent value="branches" className="mt-6">
                  <BranchesSection
                    branches={doctor.branches}
                    emptyDescription={t("branches.emptyDoctor")}
                  />
                </TabsContent>
              )}

              {doctor.reviewCount !== null && (
                <TabsContent value="reviews" className="mt-6">
                  <ReviewsSection provider={doctor} />
                </TabsContent>
              )}
            </Tabs>
          </div>

          <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
            {doctor.price !== null && (
              <Card className="hidden border-primary/20 lg:block">
                <CardContent className="space-y-4">
                  <p className="text-2xl font-bold text-primary tabular-nums">
                    {formatEGP(doctor.price)}
                  </p>
                  <Button
                    render={<Link href={`/booking/${doctor.slug}`} />}
                    className="h-11 w-full rounded-xl"
                  >
                    <CalendarCheck className="size-4" />
                    {tCommon("actions.bookNow")}
                  </Button>
                </CardContent>
              </Card>
            )}

            <div className="hidden lg:block">
              <AvailabilityPanel provider={doctor} />
            </div>

            {doctor.acceptedInsurancePlanIds.length > 0 && (
              <InsuranceCard planIds={doctor.acceptedInsurancePlanIds} />
            )}

            <NearbySection
              providerId={doctor.id}
              title={t("nearby.titleDoctors")}
            />
          </aside>
        </div>
      </div>
    </div>
  );
}
