"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  Award,
  Building2,
  CalendarCheck,
  GraduationCap,
  Languages,
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
import { useDomain, useFormat, useIsRtl } from "@/lib/i18n/use-format";
import { useLabels } from "@/lib/i18n/use-labels";
import { BUSINESS } from "@/lib/site";
import type { Doctor } from "@/lib/types";

export default function DoctorProfilePage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? "";

  const t = useTranslations("profile");
  const tCommon = useTranslations("common");
  const { formatDuration, formatEGP } = useFormat();
  const { named, localized, getAreaName, getGovernorateName, getSpecialtyName } =
    useDomain();
  const L = useLabels();
  const isRtl = useIsRtl();
  // Arabic separates a list with an Arabic comma, not a Latin one.
  const listSeparator = isRtl ? "، " : ", ";

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

  // A missing slug and a wrong-type slug are the same thing to a patient.
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
  const consultations = doctor.consultationTypes.filter((c) => c.isActive);
  const specialtyName = doctor.specialtyId
    ? getSpecialtyName(doctor.specialtyId)
    : null;

  /** Street address, area and governorate — as much of each as the API answered. */
  const place = [
    doctor.address,
    [
      doctor.areaId ? getAreaName(doctor.areaId) : null,
      doctor.governorateId ? getGovernorateName(doctor.governorateId) : null,
    ]
      .filter((part): part is string => Boolean(part))
      .join(", "),
  ]
    .filter((part): part is string => Boolean(part))
    .join(" — ");

  const about = (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {t("about.title", { name: named(doctor) })}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm leading-relaxed text-foreground/90">
          {localized(doctor.bio)}
        </p>

        <Separator />

        <dl className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-start gap-3">
            <Stethoscope className="mt-0.5 size-4 shrink-0 text-primary" />
            <div>
              <dt className="text-xs text-muted-foreground">
                {t("about.specialty")}
              </dt>
              <dd className="text-sm font-medium">{orDash(specialtyName)}</dd>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Award className="mt-0.5 size-4 shrink-0 text-primary" />
            <div>
              <dt className="text-xs text-muted-foreground">
                {t("about.experience")}
              </dt>
              <dd className="text-sm font-medium">
                {doctor.yearsOfExperience === null
                  ? DASH
                  : t("about.experienceValue", {
                      years: doctor.yearsOfExperience,
                    })}
              </dd>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <GraduationCap className="mt-0.5 size-4 shrink-0 text-primary" />
            <div>
              <dt className="text-xs text-muted-foreground">{t("about.degrees")}</dt>
              <dd className="text-sm font-medium">
                {doctor.degrees.map(L.degree).join(" · ")}
              </dd>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Languages className="mt-0.5 size-4 shrink-0 text-primary" />
            <div>
              <dt className="text-xs text-muted-foreground">
                {t("about.languages")}
              </dt>
              <dd className="text-sm font-medium">
                {doctor.languages.map(L.language).join(listSeparator)}
              </dd>
            </div>
          </div>
        </dl>

        {doctor.subSpecialties.length > 0 && (
          <>
            <Separator />
            <div>
              <p className="mb-2 text-xs text-muted-foreground">{t("about.focus")}</p>
              <div className="flex flex-wrap gap-1.5">
                {doctor.subSpecialties.map((item) => (
                  <Badge key={item} variant="outline" className="font-normal">
                    {L.subSpecialty(item)}
                  </Badge>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );

  const services = (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("consultations.title")}</CardTitle>
        {doctor.branches.length > 1 && (
          <p className="text-sm text-muted-foreground">
            {t("consultations.feesVary")}
          </p>
        )}
      </CardHeader>
      <CardContent>
        <ul className="grid gap-3 sm:grid-cols-2">
          {consultations.map((consultation) => (
            <li
              key={consultation.id}
              className="flex flex-col gap-2 rounded-xl border p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <h4 className="font-medium leading-tight">
                  {named(consultation)}
                </h4>
                <BranchPrice service={consultation} branches={doctor.branches} />
              </div>
              <p className="text-sm text-muted-foreground">
                {localized(consultation.description)}
              </p>
              <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                <Badge variant="secondary" className="font-normal">
                  {consultation.durationMinutes === null
                    ? DASH
                    : formatDuration(consultation.durationMinutes)}
                </Badge>
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
  );

  const clinic = (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("about.clinicTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-3">
          <Building2 className="mt-0.5 size-4 shrink-0 text-primary" />
          <div>
            <p className="font-medium">{orDash(doctor.clinicName)}</p>
            <p className="mt-0.5 flex items-start gap-1.5 text-sm text-muted-foreground">
              <MapPin className="mt-0.5 size-3.5 shrink-0" />
              <span>{orDash(place)}</span>
            </p>
          </div>
        </div>

        {doctor.location && (
          <MapPlaceholder
            center={doctor.location}
            address={doctor.address ?? undefined}
            markers={[
              {
                id: doctor.id,
                label: doctor.clinicName ?? named(doctor),
                location: doctor.location,
                isPrimary: true,
              },
            ]}
          />
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="pb-20">
      <ProfileHero
        provider={doctor}
        subtitle={[L.doctorTitle(doctor.title), specialtyName]
          .filter((part): part is string => Boolean(part))
          .join(" · ")}
        priceLabel={t("hero.priceConsultation")}
        chips={[
          ...(doctor.yearsOfExperience === null
            ? []
            : [t("hero.chipExperience", { years: doctor.yearsOfExperience })]),
          ...doctor.degrees.slice(0, 2).map(L.degree),
          ...doctor.languages.slice(0, 2).map(L.language),
        ]}
      />

      <div className="mx-auto mt-10 w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
          <div className="min-w-0">
            <Tabs defaultValue="about">
              <TabsList className="h-auto w-full overflow-x-auto rounded-xl p-1 no-scrollbar">
                <TabsTrigger value="about" className="h-9 px-4">
                  {t("tabs.overview")}
                </TabsTrigger>
                <TabsTrigger value="services" className="h-9 px-4">
                  {t("tabs.services")}
                </TabsTrigger>
                <TabsTrigger value="clinic" className="h-9 px-4">
                  {t("tabs.clinic")}
                </TabsTrigger>
                <TabsTrigger value="branches" className="h-9 px-4">
                  {t("tabs.branches", { count: doctor.branches.length })}
                </TabsTrigger>
                <TabsTrigger value="reviews" className="h-9 px-4">
                  {doctor.reviewCount === null
                    ? t("tabs.reviewsNoCount")
                    : t("tabs.reviews", { count: doctor.reviewCount })}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="about" className="mt-6 space-y-6">
                {about}
                <div className="lg:hidden">
                  <AvailabilityPanel provider={doctor} />
                </div>
              </TabsContent>

              <TabsContent value="services" className="mt-6">
                {services}
              </TabsContent>

              <TabsContent value="clinic" className="mt-6 space-y-6">
                {clinic}
              </TabsContent>

              {/* A doctor's branches are their clinics — they may run several (§2). */}
              <TabsContent value="branches" className="mt-6">
                <BranchesSection
                  branches={doctor.branches}
                  emptyDescription={t("branches.emptyDoctor")}
                />
              </TabsContent>

              <TabsContent value="reviews" className="mt-6">
                <ReviewsSection provider={doctor} />
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
                    {t("sidebar.consultationFee")}
                  </p>
                  <p className="text-2xl font-bold text-primary tabular-nums">
                    {formatEGP(doctor.price)}
                  </p>
                </div>
                <Button
                  render={<Link href={`/booking/${doctor.slug}`} />}
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
              <AvailabilityPanel provider={doctor} />
            </div>

            <InsuranceCard planIds={doctor.acceptedInsurancePlanIds} />

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
