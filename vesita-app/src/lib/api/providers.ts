import {
  branchOf,
  earliestAvailability,
  slotsForBranch,
} from "@/lib/api/availability";
import { db, paginate, request, ApiError } from "@/lib/api/client";
import { GOVERNORATES, SPECIALTIES } from "@/lib/data/egypt";
import { addDays, TODAY, toISODate } from "@/lib/data/seed";
import type {
  Doctor,
  Lab,
  Paginated,
  Provider,
  ProviderRole,
  RadiologyCenter,
  Review,
  SearchFilters,
  TimeSlot,
  Weekday,
} from "@/lib/types";

/** Only approved providers are ever exposed to the public site. */
function publicProviders(): Provider[] {
  return db().providers.filter((p) => p.status === "approved");
}

function specialtyNameOf(provider: Provider): string {
  if (provider.type !== "doctor") return "";
  return SPECIALTIES.find((s) => s.id === provider.specialtyId)?.name ?? "";
}

/** Free-text match across name, specialty, and the provider's service catalogue. */
function matchesQuery(provider: Provider, q: string): boolean {
  const haystack = [
    provider.name,
    provider.nameAr,
    provider.address,
    specialtyNameOf(provider),
    ...(provider.type === "doctor"
      ? provider.subSpecialties
      : provider.type === "lab"
        ? provider.tests.map((t) => `${t.name} ${t.nameAr}`)
        : provider.scans.map((s) => `${s.name} ${s.nameAr}`)),
  ]
    .join(" ")
    .toLowerCase();

  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => haystack.includes(term));
}

/**
 * True when any of the provider's branches works today and isn't on holiday.
 *
 * Deliberately approximate (§4): "available today" in search results is an
 * optimistic hint, not a promise. The profile page is where availability is
 * genuine, and the moment of booking is the only authoritative source of truth.
 */
function isAvailableToday(provider: Provider): boolean {
  const weekday = TODAY.getUTCDay() as Weekday;
  const worksToday = provider.branches.some((branch) =>
    branch.isActive &&
    branch.schedule.some((d) => d.weekday === weekday && d.isWorkingDay),
  );
  if (!worksToday) return false;

  const today = toISODate(TODAY);
  return !db().holidays.some(
    (h) => h.providerId === provider.id && h.date === today,
  );
}

/** Great-circle-ish distance from a governorate centroid, in km. */
function distanceFrom(provider: Provider, governorateId?: string): number {
  const gov = GOVERNORATES.find((g) => g.id === (governorateId ?? "cairo"))!;
  const dLat = (provider.location.lat - gov.lat) * 111;
  const dLng =
    (provider.location.lng - gov.lng) * 111 * Math.cos((gov.lat * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

export function searchProviders(
  filters: SearchFilters = {},
): Promise<Paginated<Provider> & { appliedFilters: SearchFilters }> {
  return request(() => {
    const {
      q,
      type,
      specialtyId,
      subSpecialty,
      governorateId,
      areaId,
      gender,
      minRating,
      minPrice,
      maxPrice,
      availableToday,
      insurancePlanId,
      sort = "highest_rated",
      page = 1,
      pageSize = 12,
    } = filters;

    let results = publicProviders();

    if (type) results = results.filter((p) => p.type === type);
    if (q) results = results.filter((p) => matchesQuery(p, q));
    if (specialtyId)
      results = results.filter(
        (p) => p.type === "doctor" && p.specialtyId === specialtyId,
      );
    if (subSpecialty)
      results = results.filter(
        (p) => p.type === "doctor" && p.subSpecialties.includes(subSpecialty),
      );

    // Location filters resolve down to the branch: a provider matches if *any*
    // of its branches is in the requested governorate or area (§2, §4).
    if (governorateId)
      results = results.filter(
        (p) =>
          p.governorateId === governorateId ||
          p.branches.some((b) => b.isActive && b.governorateId === governorateId),
      );
    if (areaId)
      results = results.filter(
        (p) =>
          p.areaId === areaId ||
          p.branches.some((b) => b.isActive && b.areaId === areaId),
      );

    if (gender)
      results = results.filter((p) => p.type === "doctor" && p.gender === gender);
    if (minRating !== undefined)
      results = results.filter((p) => p.rating >= minRating);
    if (minPrice !== undefined) results = results.filter((p) => p.price >= minPrice);
    if (maxPrice !== undefined) results = results.filter((p) => p.price <= maxPrice);
    if (availableToday) results = results.filter(isAvailableToday);

    // §14 — inert until the insurance phase ships, but the filter resolves
    // correctly the moment providers declare their plans.
    if (insurancePlanId)
      results = results.filter((p) =>
        p.acceptedInsurancePlanIds.includes(insurancePlanId),
      );

    // Computed once per provider rather than inside the comparator, which would
    // re-expand the whole schedule on every comparison.
    const earliest = new Map<string, string>();
    if (sort === "earliest_available") {
      for (const p of results) {
        const at = earliestAvailability(p);
        if (at) earliest.set(p.id, at);
      }
    }

    const sorted = [...results].sort((a, b) => {
      switch (sort) {
        case "lowest_price":
          return a.price - b.price;
        case "most_booked":
          return b.bookingCount - a.bookingCount;
        case "nearest":
          return distanceFrom(a, governorateId) - distanceFrom(b, governorateId);
        case "earliest_available": {
          // Providers with nothing open in the window sort last.
          const av = earliest.get(a.id) ?? "9999";
          const bv = earliest.get(b.id) ?? "9999";
          return av.localeCompare(bv) || b.rating - a.rating;
        }
        case "highest_rated":
        default:
          // Break rating ties with review volume so 5.0-with-3-reviews doesn't
          // outrank 4.9-with-300.
          return b.rating - a.rating || b.reviewCount - a.reviewCount;
      }
    });

    return { ...paginate(sorted, page, pageSize), appliedFilters: filters };
  });
}

export function getProviderBySlug(slug: string): Promise<Provider> {
  return request(() => {
    const provider = db().providers.find((p) => p.slug === slug);
    if (!provider) throw new ApiError("Provider not found", 404);
    return provider;
  });
}

export function getProviderById(id: string): Promise<Provider> {
  return request(() => {
    const provider = db().providers.find((p) => p.id === id);
    if (!provider) throw new ApiError("Provider not found", 404);
    return provider;
  });
}

export function getFeaturedProviders(
  type: ProviderRole,
  limit = 6,
): Promise<Provider[]> {
  return request(() =>
    publicProviders()
      .filter((p) => p.type === type && p.isFeatured)
      .sort((a, b) => b.rating - a.rating || b.bookingCount - a.bookingCount)
      .slice(0, limit),
  );
}

export function getPopularSpecialties(limit = 12) {
  return request(() => {
    const counts = new Map<string, number>();

    for (const p of db().providers) {
      if (p.type !== "doctor" || p.status !== "approved") continue;
      counts.set(p.specialtyId, (counts.get(p.specialtyId) ?? 0) + 1);
    }

    return Array.from(counts, ([id, doctorCount]) => ({
      ...SPECIALTIES.find((s) => s.id === id)!,
      doctorCount,
    }))
      .sort((a, b) => b.doctorCount - a.doctorCount)
      .slice(0, limit);
  });
}

export function getProviderReviews(providerId: string): Promise<Review[]> {
  return request(() =>
    db()
      .reviews.filter((r) => r.providerId === providerId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  );
}

/** Providers geographically closest to the given one — powers "Nearby". */
export function getNearbyProviders(providerId: string, limit = 4): Promise<Provider[]> {
  return request(() => {
    const origin = db().providers.find((p) => p.id === providerId);
    if (!origin) throw new ApiError("Provider not found", 404);

    const km = (p: Provider) => {
      const dLat = (p.location.lat - origin.location.lat) * 111;
      const dLng =
        (p.location.lng - origin.location.lng) *
        111 *
        Math.cos((origin.location.lat * Math.PI) / 180);
      return Math.sqrt(dLat * dLat + dLng * dLng);
    };

    return publicProviders()
      .filter((p) => p.id !== providerId && p.type === origin.type)
      .sort((a, b) => km(a) - km(b))
      .slice(0, limit);
  });
}

// ---------------------------------------------------------------------------
// Availability
// ---------------------------------------------------------------------------

/**
 * Availability for one branch over the next `days` days.
 *
 * Availability is always resolved at the branch level (§2). When no branch is
 * named we resolve the provider's main branch, so existing callers keep working.
 */
export function getAvailability(
  providerId: string,
  days = 30,
  branchId?: string,
): Promise<Record<string, TimeSlot[]>> {
  return request(() => {
    const provider = db().providers.find((p) => p.id === providerId);
    if (!provider) throw new ApiError("Provider not found", 404);

    const branch = branchOf(provider, branchId);
    if (!branch) throw new ApiError("Branch not found", 404);

    const byDate: Record<string, TimeSlot[]> = {};
    for (let i = 0; i < days; i++) {
      const date = toISODate(addDays(TODAY, i));
      byDate[date] = slotsForBranch(provider, branch, date);
    }
    return byDate;
  });
}

export function getSlotsForDate(
  providerId: string,
  date: string,
  branchId?: string,
): Promise<TimeSlot[]> {
  return request(() => {
    const provider = db().providers.find((p) => p.id === providerId);
    if (!provider) throw new ApiError("Provider not found", 404);

    const branch = branchOf(provider, branchId);
    if (!branch) throw new ApiError("Branch not found", 404);

    return slotsForBranch(provider, branch, date);
  });
}

/** Next few open places across every branch — shown on search-result cards. */
export function getNextSlots(providerId: string, limit = 4): Promise<TimeSlot[]> {
  return request(() => {
    const provider = db().providers.find((p) => p.id === providerId);
    if (!provider) return [];

    const out: TimeSlot[] = [];

    for (let i = 0; i < 14 && out.length < limit; i++) {
      const date = toISODate(addDays(TODAY, i));

      for (const branch of provider.branches) {
        out.push(
          ...slotsForBranch(provider, branch, date).filter((s) => s.isAvailable),
        );
      }
    }

    return out
      .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
      .slice(0, limit);
  });
}

export type { Doctor, Lab, RadiologyCenter };
