"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Info, SearchX } from "lucide-react";
import { Suspense, useCallback, useMemo } from "react";

import { FilterSidebar } from "@/components/shared/filter-sidebar";
import { ProviderCard } from "@/components/shared/provider-card";
import { SearchBar } from "@/components/shared/search-bar";
import {
  EmptyState,
  ErrorState,
  ProviderListSkeleton,
} from "@/components/shared/states";
import { AppSelect } from "@/components/ui/app-select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAsync } from "@/hooks/use-async";
import { searchProviders } from "@/lib/api/providers";
import { getGovernorateName, getSpecialtyName } from "@/lib/data/egypt";
import {
  INSURANCE_ENABLED,
  SORT_LABELS,
  type Gender,
  type ProviderRole,
  type SearchFilters,
  type SortOption,
} from "@/lib/types";

const PAGE_SIZE = 12;

const SORT_OPTIONS = (Object.keys(SORT_LABELS) as SortOption[]).map((value) => ({
  value,
  label: SORT_LABELS[value],
}));

const PROVIDER_ROLES: ProviderRole[] = ["doctor", "lab", "radiology"];
const SORT_KEYS = Object.keys(SORT_LABELS) as SortOption[];

/** Parses the query string into the `SearchFilters` the API expects. */
function parseFilters(params: URLSearchParams): SearchFilters {
  const num = (key: string): number | undefined => {
    const raw = params.get(key);
    if (raw === null || raw.trim() === "") return undefined;
    const value = Number(raw);
    return Number.isFinite(value) ? value : undefined;
  };

  const type = params.get("type");
  const gender = params.get("gender");
  const sort = params.get("sort");

  return {
    q: params.get("q") ?? undefined,
    type:
      type && PROVIDER_ROLES.includes(type as ProviderRole)
        ? (type as ProviderRole)
        : undefined,
    specialtyId: params.get("specialtyId") ?? undefined,
    // A subspecialty is only meaningful inside its specialty — a stale one in
    // the URL would silently empty the results.
    subSpecialty: params.get("specialtyId")
      ? (params.get("subSpecialty") ?? undefined)
      : undefined,
    governorateId: params.get("governorateId") ?? undefined,
    areaId: params.get("areaId") ?? undefined,
    gender:
      gender === "male" || gender === "female" ? (gender as Gender) : undefined,
    minRating: num("minRating"),
    minPrice: num("minPrice"),
    maxPrice: num("maxPrice"),
    availableToday: params.get("availableToday") === "true" || undefined,
    // §14 — the filter is reserved but inert until the insurance phase ships,
    // so a hand-typed `insurancePlanId` cannot narrow anyone's results yet.
    insurancePlanId: INSURANCE_ENABLED
      ? (params.get("insurancePlanId") ?? undefined)
      : undefined,
    sort:
      sort && SORT_KEYS.includes(sort as SortOption)
        ? (sort as SortOption)
        : "highest_rated",
    page: Math.max(1, num("page") ?? 1),
    pageSize: PAGE_SIZE,
  };
}

/** Serializes filters back into a shareable query string. */
function toQueryString(filters: SearchFilters): string {
  const params = new URLSearchParams();

  if (filters.q) params.set("q", filters.q);
  if (filters.type) params.set("type", filters.type);
  if (filters.specialtyId) params.set("specialtyId", filters.specialtyId);
  if (filters.specialtyId && filters.subSpecialty)
    params.set("subSpecialty", filters.subSpecialty);
  if (filters.governorateId) params.set("governorateId", filters.governorateId);
  if (filters.areaId) params.set("areaId", filters.areaId);
  if (filters.gender) params.set("gender", filters.gender);
  if (filters.minRating) params.set("minRating", String(filters.minRating));
  if (filters.minPrice) params.set("minPrice", String(filters.minPrice));
  if (filters.maxPrice) params.set("maxPrice", String(filters.maxPrice));
  if (filters.availableToday) params.set("availableToday", "true");
  if (INSURANCE_ENABLED && filters.insurancePlanId)
    params.set("insurancePlanId", filters.insurancePlanId);
  if (filters.sort && filters.sort !== "highest_rated")
    params.set("sort", filters.sort);
  if (filters.page && filters.page > 1) params.set("page", String(filters.page));

  return params.toString();
}

/** How many filters (beyond type/sort/paging) are actually narrowing results. */
function countActive(filters: SearchFilters): number {
  return [
    filters.specialtyId,
    filters.subSpecialty,
    filters.governorateId,
    filters.areaId,
    filters.gender,
    filters.minRating,
    filters.minPrice,
    filters.maxPrice,
    filters.availableToday,
    INSURANCE_ENABLED ? filters.insurancePlanId : undefined,
  ].filter(Boolean).length;
}

const TYPE_LABELS: Record<ProviderRole, string> = {
  doctor: "doctors",
  lab: "labs",
  radiology: "radiology centers",
};

function SearchResults() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // `searchParams` is a stable ReadonlyURLSearchParams per navigation, so its
  // string form is the right dependency for both parsing and re-fetching.
  const key = searchParams.toString();
  const filters = useMemo(() => parseFilters(new URLSearchParams(key)), [key]);

  const { data, error, isLoading, refetch } = useAsync(
    () => searchProviders(filters),
    [key],
  );

  const push = useCallback(
    (next: SearchFilters) => {
      const query = toQueryString(next);
      router.replace(query ? `/search?${query}` : "/search", { scroll: false });
    },
    [router],
  );

  const onChange = useCallback(
    (patch: Partial<SearchFilters>) => {
      // Any filter change invalidates the current page — go back to page 1.
      push({ ...filters, ...patch, page: 1 });
    },
    [filters, push],
  );

  const onReset = useCallback(() => {
    push({ q: filters.q, type: filters.type, sort: filters.sort, page: 1 });
  }, [filters.q, filters.sort, filters.type, push]);

  const goToPage = useCallback(
    (page: number) => {
      push({ ...filters, page });
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    },
    [filters, push],
  );

  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const page = filters.page ?? 1;
  const noun = filters.type ? TYPE_LABELS[filters.type] : "providers";

  const summary = [
    filters.specialtyId ? getSpecialtyName(filters.specialtyId) : null,
    filters.subSpecialty,
    filters.governorateId ? `in ${getGovernorateName(filters.governorateId)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  // Window the page buttons so long result sets don't blow out the row.
  const pageWindow = useMemo(() => {
    const start = Math.max(1, Math.min(page - 2, totalPages - 4));
    const end = Math.min(totalPages, start + 4);
    return Array.from({ length: Math.max(0, end - start + 1) }, (_, i) => start + i);
  }, [page, totalPages]);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <div className="mb-8">
        <SearchBar
          variant="hero"
          defaults={{
            q: filters.q,
            type: filters.type,
            specialtyId: filters.specialtyId,
            governorateId: filters.governorateId,
            areaId: filters.areaId,
            maxPrice: filters.maxPrice,
          }}
        />
      </div>

      <div className="flex gap-8">
        <FilterSidebar
          filters={filters}
          onChange={onChange}
          onReset={onReset}
          activeCount={countActive(filters)}
        />

        <div className="min-w-0 flex-1">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
                {filters.q ? `Results for “${filters.q}”` : `Browse ${noun}`}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {isLoading ? (
                  <Skeleton className="inline-block h-4 w-40 align-middle" />
                ) : (
                  <>
                    <span className="font-medium text-foreground tabular-nums">
                      {total.toLocaleString()}
                    </span>{" "}
                    {total === 1 ? noun.replace(/s$/, "") : noun}
                    {summary ? ` · ${summary}` : ""}
                  </>
                )}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {/* The mobile filter trigger lives inside FilterSidebar. */}
              <AppSelect
                value={filters.sort ?? "highest_rated"}
                onValueChange={(value) =>
                  onChange({ sort: (value || "highest_rated") as SortOption })
                }
                options={SORT_OPTIONS}
                placeholder="Sort by"
                aria-label="Sort results"
                className="w-44"
              />
            </div>
          </div>

          {isLoading ? (
            <ProviderListSkeleton count={6} />
          ) : error ? (
            <ErrorState
              title="Couldn't load results"
              description="Something went wrong while searching. Please try again."
              onRetry={refetch}
            />
          ) : !data || data.items.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title="No providers match these filters"
              description="Try widening the price range, clearing the area, or lowering the minimum rating."
              action={
                <div className="flex flex-wrap justify-center gap-3">
                  <Button
                    variant="outline"
                    onClick={onReset}
                    className="h-10 rounded-xl px-4"
                  >
                    Reset filters
                  </Button>
                  <Button
                    render={<Link href="/search?type=doctor" />}
                    className="h-10 rounded-xl px-4"
                  >
                    Browse all doctors
                  </Button>
                </div>
              }
            />
          ) : (
            <>
              {/*
                §4 — search availability is approximate by design. Say so, rather
                than letting a card's "likely available" read as a promise.
              */}
              <p className="mb-4 flex items-start gap-2 rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                <Info className="mt-0.5 size-3.5 shrink-0" />
                Availability here is a quick estimate. Open a provider&apos;s page to
                see their live places, and the times they can actually take you.
              </p>

              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {data.items.map((provider) => (
                  <ProviderCard key={provider.id} provider={provider} />
                ))}
              </div>

              {totalPages > 1 && (
                <nav
                  aria-label="Pagination"
                  className="mt-10 flex flex-wrap items-center justify-center gap-2"
                >
                  <Button
                    variant="outline"
                    disabled={page <= 1}
                    onClick={() => goToPage(page - 1)}
                    className="h-10 rounded-xl px-3"
                  >
                    <ChevronLeft className="size-4" />
                    Previous
                  </Button>

                  {pageWindow.map((n) => (
                    <Button
                      key={n}
                      variant={n === page ? "default" : "outline"}
                      onClick={() => goToPage(n)}
                      aria-current={n === page ? "page" : undefined}
                      className="size-10 rounded-xl p-0 tabular-nums"
                    >
                      {n}
                    </Button>
                  ))}

                  <Button
                    variant="outline"
                    disabled={page >= totalPages}
                    onClick={() => goToPage(page + 1)}
                    className="h-10 rounded-xl px-3"
                  >
                    Next
                    <ChevronRight className="size-4" />
                  </Button>
                </nav>
              )}

              <p className="mt-4 text-center text-xs text-muted-foreground">
                Page {page} of {totalPages}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SearchFallback() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <Skeleton className="mb-8 h-56 w-full rounded-3xl" />
      <div className="flex gap-8">
        <Skeleton className="hidden h-[32rem] w-72 shrink-0 rounded-2xl lg:block" />
        <div className="min-w-0 flex-1">
          <Skeleton className="mb-6 h-8 w-64" />
          <ProviderListSkeleton count={6} />
        </div>
      </div>
    </div>
  );
}

/** `useSearchParams` must sit inside a Suspense boundary in Next 15. */
export default function SearchPage() {
  return (
    <Suspense fallback={<SearchFallback />}>
      <SearchResults />
    </Suspense>
  );
}
