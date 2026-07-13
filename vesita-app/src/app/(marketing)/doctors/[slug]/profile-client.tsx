"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
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
import { getAreaName, getGovernorateName, getSpecialtyName } from "@/lib/data/egypt";
import { formatDuration } from "@/lib/format";
import { formatEGP } from "@/lib/site";
import type { Doctor } from "@/lib/types";

export default function DoctorProfilePage() {
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

  // A missing slug and a wrong-type slug are the same thing to a patient.
  if (error) {
    const isNotFound = /not found/i.test(error.message);
    if (isNotFound) {
      return (
        <ProviderNotFound
          title="We couldn't find that doctor"
          backHref="/search?type=doctor"
          backLabel="Browse doctors"
        />
      );
    }
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-24 sm:px-6 lg:px-8">
        <ErrorState
          title="Couldn't load this profile"
          onRetry={refetch}
        />
      </div>
    );
  }

  if (!data || data.type !== "doctor") {
    return (
      <ProviderNotFound
        title="We couldn't find that doctor"
        description="This link points to a profile that isn't a doctor. It may have moved."
        backHref="/search?type=doctor"
        backLabel="Browse doctors"
      />
    );
  }

  const doctor: Doctor = data;
  const consultations = doctor.consultationTypes.filter((c) => c.isActive);

  const about = (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">About {doctor.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm leading-relaxed text-foreground/90">{doctor.bio}</p>

        <Separator />

        <dl className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-start gap-3">
            <Stethoscope className="mt-0.5 size-4 shrink-0 text-primary" />
            <div>
              <dt className="text-xs text-muted-foreground">Specialty</dt>
              <dd className="text-sm font-medium">
                {getSpecialtyName(doctor.specialtyId)}
              </dd>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Award className="mt-0.5 size-4 shrink-0 text-primary" />
            <div>
              <dt className="text-xs text-muted-foreground">Experience</dt>
              <dd className="text-sm font-medium">
                {doctor.yearsOfExperience} years of practice
              </dd>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <GraduationCap className="mt-0.5 size-4 shrink-0 text-primary" />
            <div>
              <dt className="text-xs text-muted-foreground">Degrees</dt>
              <dd className="text-sm font-medium">{doctor.degrees.join(" · ")}</dd>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Languages className="mt-0.5 size-4 shrink-0 text-primary" />
            <div>
              <dt className="text-xs text-muted-foreground">Languages</dt>
              <dd className="text-sm font-medium">{doctor.languages.join(", ")}</dd>
            </div>
          </div>
        </dl>

        {doctor.subSpecialties.length > 0 && (
          <>
            <Separator />
            <div>
              <p className="mb-2 text-xs text-muted-foreground">Areas of focus</p>
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
  );

  const services = (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Consultation types</CardTitle>
        {doctor.branches.length > 1 && (
          <p className="text-sm text-muted-foreground">
            Fees can differ between clinics — you&apos;ll see the exact fee for the
            clinic you pick.
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
                <h4 className="font-medium leading-tight">{consultation.name}</h4>
                <BranchPrice service={consultation} branches={doctor.branches} />
              </div>
              <p className="text-sm text-muted-foreground">
                {consultation.description}
              </p>
              <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                <Badge variant="secondary" className="font-normal">
                  {formatDuration(consultation.durationMinutes)}
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
                  Book
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
        <CardTitle className="text-base">Clinic & location</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-3">
          <Building2 className="mt-0.5 size-4 shrink-0 text-primary" />
          <div>
            <p className="font-medium">{doctor.clinicName}</p>
            <p className="mt-0.5 flex items-start gap-1.5 text-sm text-muted-foreground">
              <MapPin className="mt-0.5 size-3.5 shrink-0" />
              <span>
                {doctor.address} — {getAreaName(doctor.areaId)},{" "}
                {getGovernorateName(doctor.governorateId)}
              </span>
            </p>
          </div>
        </div>

        <MapPlaceholder
          center={doctor.location}
          address={doctor.address}
          markers={[
            {
              id: doctor.id,
              label: doctor.clinicName,
              location: doctor.location,
              isPrimary: true,
            },
          ]}
        />
      </CardContent>
    </Card>
  );

  return (
    <div className="pb-20">
      <ProfileHero
        provider={doctor}
        subtitle={`${doctor.title} · ${getSpecialtyName(doctor.specialtyId)}`}
        priceLabel="Consultation fee"
        chips={[
          `${doctor.yearsOfExperience} yrs experience`,
          ...doctor.degrees.slice(0, 2),
          ...doctor.languages.slice(0, 2),
        ]}
      />

      <div className="mx-auto mt-10 w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
          <div className="min-w-0">
            <Tabs defaultValue="about">
              <TabsList className="h-auto w-full overflow-x-auto rounded-xl p-1 no-scrollbar">
                <TabsTrigger value="about" className="h-9 px-4">
                  Overview
                </TabsTrigger>
                <TabsTrigger value="services" className="h-9 px-4">
                  Services
                </TabsTrigger>
                <TabsTrigger value="clinic" className="h-9 px-4">
                  Clinic
                </TabsTrigger>
                <TabsTrigger value="branches" className="h-9 px-4">
                  Branches ({doctor.branches.length})
                </TabsTrigger>
                <TabsTrigger value="reviews" className="h-9 px-4">
                  Reviews ({doctor.reviewCount.toLocaleString()})
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
                  emptyDescription="This doctor practises from a single clinic."
                />
              </TabsContent>

              <TabsContent value="reviews" className="mt-6">
                <ReviewsSection provider={doctor} />
              </TabsContent>
            </Tabs>
          </div>

          <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
            <Card className="border-primary/20">
              <CardContent className="space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground">Consultation fee</p>
                  <p className="text-2xl font-bold text-primary tabular-nums">
                    {formatEGP(doctor.price)}
                  </p>
                </div>
                <Button
                  render={<Link href={`/booking/${doctor.slug}`} />}
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
              <AvailabilityPanel provider={doctor} />
            </div>

            <InsuranceCard planIds={doctor.acceptedInsurancePlanIds} />

            <NearbySection providerId={doctor.id} title="Nearby doctors" />
          </aside>
        </div>
      </div>
    </div>
  );
}
