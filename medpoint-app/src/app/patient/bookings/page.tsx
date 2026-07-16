"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CalendarSearch, Search, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { Suspense, useMemo, useState, type ReactNode } from "react";

import { BookingCard } from "@/components/patient/booking-card";
import { useAuth } from "@/components/providers/auth-provider";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/shared/states";
import { AppSelect } from "@/components/ui/app-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAsync, useDebounced } from "@/hooks/use-async";
import { getBookings, type BookingQuery } from "@/lib/api/bookings";
import { getPatientProfiles } from "@/lib/api/profiles";
import { useApiError } from "@/lib/i18n/use-api-error";
import { useLabels } from "@/lib/i18n/use-labels";
import { isCancelled, type Booking, type PatientProfile } from "@/lib/types";

type Tab = "upcoming" | "completed" | "cancelled" | "all";

const TABS: Tab[] = ["upcoming", "completed", "cancelled", "all"];

/**
 * Maps a tab to the query the API understands.
 *
 * "Cancelled" spans four states — cancelled_by_patient, cancelled_by_provider,
 * refund_pending and refunded — and the API's `status` filter takes exactly one,
 * so that tab is fetched wide and narrowed with `isCancelled` client-side.
 */
function queryFor(
  tab: Tab,
  patientId: string,
  patientProfileId: string,
  q: string,
): BookingQuery {
  const base: BookingQuery = { patientId, pageSize: 100 };
  if (q.trim()) base.q = q.trim();
  if (patientProfileId) base.patientProfileId = patientProfileId;

  if (tab === "upcoming") return { ...base, when: "upcoming" };
  if (tab === "completed") return { ...base, status: "completed" };
  return base;
}

/** `useSearchParams` needs a Suspense boundary above it in the App Router. */
export default function PatientBookingsPage() {
  return (
    <Suspense fallback={<ListSkeleton count={4} />}>
      <PatientBookings />
    </Suspense>
  );
}

function PatientBookings() {
  const t = useTranslations("patient");
  const L = useLabels();
  const describeError = useApiError();

  const { user } = useAuth();
  const patientId = user?.id ?? "";

  const searchParams = useSearchParams();

  const [tab, setTab] = useState<Tab>("upcoming");
  const [profileId, setProfileId] = useState(
    () => searchParams.get("profile") ?? "",
  );
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search);

  const profiles = useAsync(
    () => getPatientProfiles(patientId),
    [patientId],
  );

  const { data, error, isLoading, refetch } = useAsync(
    () => getBookings(queryFor(tab, patientId, profileId, debouncedSearch)),
    [patientId, tab, profileId, debouncedSearch],
  );

  const profilesById = useMemo(() => {
    const map: Record<string, PatientProfile> = {};
    for (const profile of profiles.data ?? []) map[profile.id] = profile;
    return map;
  }, [profiles.data]);

  const bookings: Booking[] = useMemo(() => {
    const items = data?.items ?? [];
    return tab === "cancelled"
      ? items.filter((booking) => isCancelled(booking.status))
      : items;
  }, [data, tab]);

  const profileOptions = (profiles.data ?? []).map((profile) => ({
    value: profile.id,
    label: t("bookings.profileOption", {
      name: profile.fullName,
      relationship: L.relationship(profile.relationship),
    }),
  }));

  const selected = profileId ? profilesById[profileId] : undefined;

  const strong = (chunks: ReactNode) => (
    <span className="font-medium text-foreground">{chunks}</span>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            {t("bookings.title")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("bookings.subtitle")}
          </p>
        </div>

        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-end">
          <div className="space-y-2 sm:w-64">
            <Label htmlFor="booking-profile-filter" className="text-xs">
              {t("bookings.patientFilter")}
            </Label>
            <AppSelect
              id="booking-profile-filter"
              value={profileId}
              onValueChange={setProfileId}
              options={profileOptions}
              emptyOption={t("bookings.allPatients")}
              placeholder={t("bookings.allPatients")}
              disabled={profiles.isLoading || profileOptions.length === 0}
            />
          </div>

          <div className="space-y-2 sm:w-72">
            <Label htmlFor="booking-search" className="text-xs">
              {t("bookings.search")}
            </Label>
            <div className="relative">
              <Search className="absolute top-1/2 start-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="booking-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("bookings.searchPlaceholder")}
                aria-label={t("bookings.searchAria")}
                className="h-11 rounded-xl ps-9"
              />
            </div>
          </div>
        </div>
      </div>

      {selected && (
        <p className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/15 bg-primary/5 px-3 py-2 text-sm">
          <Users className="size-4 shrink-0 text-primary" />
          <span className="text-muted-foreground">
            {t.rich("bookings.showingFor", {
              name: selected.fullName,
              relationship: L.relationship(selected.relationship),
              b: strong,
            })}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setProfileId("")}
            className="ms-auto"
          >
            {t("bookings.showAll")}
          </Button>
        </p>
      )}

      <Tabs
        value={tab}
        onValueChange={(value) => setTab(String(value) as Tab)}
        className="space-y-6"
      >
        <TabsList className="w-full sm:w-auto">
          {TABS.map((item) => (
            <TabsTrigger key={item} value={item}>
              {t(`bookings.tabs.${item}`)}
            </TabsTrigger>
          ))}
        </TabsList>

        {TABS.map((item) => (
          <TabsContent key={item} value={item}>
            {isLoading ? (
              <ListSkeleton count={4} />
            ) : error ? (
              <ErrorState
                title={t("bookings.error")}
                description={describeError(error)}
                onRetry={refetch}
              />
            ) : bookings.length === 0 ? (
              <EmptyState
                icon={CalendarSearch}
                title={
                  debouncedSearch.trim()
                    ? t("bookings.noMatchTitle")
                    : t(`bookings.empty.${item}Title`)
                }
                description={
                  debouncedSearch.trim()
                    ? t("bookings.noMatchDescription", {
                        query: debouncedSearch.trim(),
                      })
                    : t(`bookings.empty.${item}Description`)
                }
                action={
                  !debouncedSearch.trim() && (
                    <Button
                      render={<Link href="/search" />}
                      className="h-10 rounded-xl px-4"
                    >
                      {t("bookings.find")}
                    </Button>
                  )
                }
              />
            ) : (
              <div className="grid gap-4 xl:grid-cols-2">
                {bookings.map((booking) => (
                  <BookingCard
                    key={booking.id}
                    booking={booking}
                    profile={profilesById[booking.patientProfileId]}
                    onChanged={refetch}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
