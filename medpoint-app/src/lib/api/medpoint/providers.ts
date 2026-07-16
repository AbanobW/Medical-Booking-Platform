/**
 * Provider discovery against MedPoint — degraded client-side filtering.
 *
 * The API returns thin Provider payloads and ignores search filters, so we fetch
 * paginated lists and filter/sort in the browser.
 */

import { ApiError } from "@/lib/api/errors";
import { apiRequest } from "@/lib/api/http";
import { createCachedLoader, fetchAllPages } from "@/lib/api/medpoint/cache";
import { toProvider } from "@/lib/api/medpoint/mappers";
import type { ProviderAssembly } from "@/lib/api/medpoint/mappers";
import type {
  WireBranch,
  WireProvider,
  WireService,
} from "@/lib/api/medpoint/types";
import { GOVERNORATES, SPECIALTIES } from "@/lib/data/egypt";
import type {
  GeoPoint,
  Paginated,
  Provider,
  ProviderRole,
  Review,
  SearchFilters,
} from "@/lib/types";


// One cached, request-coalesced build of the catalog. Concurrent callers — the
// search grid, featured rails, a provider page — share a single fetch of
// providers + branches + services rather than each firing their own.
const catalogLoader = createCachedLoader(buildCatalog);

async function buildCatalog(): Promise<Provider[]> {
  const [wires, branchWires, serviceWires] = await Promise.all([
    fetchAllPages<WireProvider>("/providers"),
    fetchAllPages<WireBranch>("/branches"),
    fetchAllPages<WireService>("/services"),
  ]);

  // The API sends no `provider_id` on a branch and no `branch_id` on a service,
  // even though `POST` accepts both — the relations exist in the database and are
  // omitted on read (BACKEND-GAPS.md).
  //
  // Do NOT "fix" this by matching ids across resources. They collide: the backend
  // hashes every table's row index with the same salt, so Provider row 1, Branch
  // row 1 and Service row 1 are all `W6V1Y2Pn83Q7mDEK`. That looks like a foreign
  // key and is not one — joining on it pairs row N with row N, which puts
  // "Initial Consultation" under a *laboratory* and gives each doctor exactly one
  // of their two consultations. An earlier version of this file did precisely
  // that for branches and was right only by luck of the seed's row order.
  //
  // So a branch is attached only when the API says so, and services only when a
  // branch claims them. Today that means every provider has no services and
  // therefore no price and nothing bookable, which is the truth about this API.
  const branchesByProvider = new Map<string, WireBranch[]>();
  for (const branch of branchWires) {
    if (!branch.provider_id) continue;
    const list = branchesByProvider.get(branch.provider_id) ?? [];
    list.push(branch);
    branchesByProvider.set(branch.provider_id, list);
  }

  const servicesByBranch = new Map<string, WireService[]>();
  for (const service of serviceWires) {
    const bid = service.branch_id;
    if (!bid) continue;
    const list = servicesByBranch.get(bid) ?? [];
    list.push(service);
    servicesByBranch.set(bid, list);
  }

  const providers = wires
    .filter((w) => w.status === "active" || w.status === "approved")
    .map((wire) => {
      const branches = branchesByProvider.get(wire.id) ?? [];
      const services: WireService[] = [];
      for (const branch of branches) {
        services.push(...(servicesByBranch.get(branch.id) ?? []));
      }
      const assembly: ProviderAssembly = { wire, branches, services };
      return toProvider(assembly);
    });

  return providers;
}

/** Cached catalog; builds once per TTL and coalesces concurrent callers. */
function loadCatalog(): Promise<Provider[]> {
  return catalogLoader.load();
}

function specialtyNameOf(provider: Provider): string {
  if (provider.type !== "doctor") return "";
  return SPECIALTIES.find((s) => s.id === provider.specialtyId)?.name ?? "";
}

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
 * Rough distance from a governorate centroid, in km.
 *
 * `Infinity` when either end is unknown, so a provider whose branch has no
 * coordinates sorts to the back of "nearest" instead of pretending to sit on
 * the centroid — which is what a `?? 0` here would have meant.
 */
function distanceFrom(provider: Provider, governorateId?: string): number {
  const gov = GOVERNORATES.find((g) => g.id === governorateId);
  const at = provider.location;
  if (!gov || !at) return Infinity;

  const dLat = (at.lat - gov.lat) * 111;
  const dLng = (at.lng - gov.lng) * 111 * Math.cos((gov.lat * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

/** Unknown sorts last, whichever direction the column is going. */
function desc(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return b - a;
}

function asc(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}

function paginate<T>(items: T[], page: number, pageSize: number): Paginated<T> {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    total,
    page,
    pageSize,
    totalPages,
  };
}

export async function searchProviders(
  filters: SearchFilters = {},
): Promise<Paginated<Provider> & { appliedFilters: SearchFilters }> {
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
    sort = "highest_rated",
    page = 1,
    pageSize = 12,
  } = filters;

  let results = await loadCatalog();

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
  // An unknown value cannot satisfy a threshold. Filtering "under 300 EGP" must
  // not return providers whose price nobody knows — the patient asked a question
  // about the price, and "we don't know" is not an answer of "yes".
  if (minRating !== undefined)
    results = results.filter((p) => p.rating !== null && p.rating >= minRating);
  if (minPrice !== undefined)
    results = results.filter((p) => p.price !== null && p.price >= minPrice);
  if (maxPrice !== undefined)
    results = results.filter((p) => p.price !== null && p.price <= maxPrice);

  const sorted = [...results].sort((a, b) => {
    switch (sort) {
      case "lowest_price":
        return asc(a.price, b.price);
      case "most_booked":
        return desc(a.bookingCount, b.bookingCount);
      case "nearest":
        return distanceFrom(a, governorateId) - distanceFrom(b, governorateId);
      case "highest_rated":
      default:
        return desc(a.rating, b.rating) || desc(a.reviewCount, b.reviewCount);
    }
  });

  return { ...paginate(sorted, page, pageSize), appliedFilters: filters };
}

export async function getProviderBySlug(slug: string): Promise<Provider> {
  const providers = await loadCatalog();
  const provider = providers.find((p) => p.slug === slug);
  if (!provider) throw new ApiError("Provider not found", 404, "provider.notFound");
  return provider;
}

export async function getProviderById(id: string): Promise<Provider> {
  // Prefer the cached catalog — the provider is almost always already loaded, so
  // the common path (e.g. every card resolving its own availability) costs no
  // extra request. Only fall back to the single-provider endpoint on a miss.
  const providers = await loadCatalog();
  const cached = providers.find((p) => p.id === id);
  if (cached) return cached;

  const wire = await apiRequest<WireProvider>(`/providers/${id}`);
  const assembly: ProviderAssembly = { wire };
  return toProvider(assembly);
}

export async function getFeaturedProviders(
  type: ProviderRole,
  limit = 6,
): Promise<Provider[]> {
  const providers = await loadCatalog();
  return providers
    .filter((p) => p.type === type)
    .sort((a, b) => desc(a.rating, b.rating) || desc(a.bookingCount, b.bookingCount))
    .slice(0, limit);
}

/**
 * Specialties that have doctors, most-populated first.
 *
 * A specialty is parsed out of the provider's name ("Dr. X — Cardiology"), so a
 * doctor whose name carries no specialty is counted under none rather than
 * swelling a "General" bucket that nobody chose.
 */
export async function getPopularSpecialties(limit = 12) {
  const providers = await loadCatalog();
  const counts = new Map<string, number>();

  for (const p of providers) {
    if (p.type !== "doctor" || p.specialtyId === null) continue;
    counts.set(p.specialtyId, (counts.get(p.specialtyId) ?? 0) + 1);
  }

  return Array.from(counts, ([id, doctorCount]) => {
    const specialty = SPECIALTIES.find((s) => s.id === id);
    return specialty ? { ...specialty, doctorCount } : null;
  })
    .filter((s): s is NonNullable<typeof s> => s !== null)
    .sort((a, b) => b.doctorCount - a.doctorCount)
    .slice(0, limit);
}

/** No reviews endpoint the app can read — see `api/engagement`. */
export async function getProviderReviews(_providerId: string): Promise<Review[]> {
  void _providerId;
  return [];
}

/**
 * The nearest providers of the same type.
 *
 * Needs coordinates at both ends. A provider whose branch has none cannot be
 * placed, so it is left out rather than being drawn at an arbitrary point.
 */
export async function getNearbyProviders(
  providerId: string,
  limit = 4,
): Promise<Provider[]> {
  const providers = await loadCatalog();
  const origin = providers.find((p) => p.id === providerId);
  if (!origin) throw new ApiError("Provider not found", 404, "provider.notFound");

  const from = origin.location;
  if (!from) return [];

  const km = (at: GeoPoint) => {
    const dLat = (at.lat - from.lat) * 111;
    const dLng = (at.lng - from.lng) * 111 * Math.cos((from.lat * Math.PI) / 180);
    return Math.sqrt(dLat * dLat + dLng * dLng);
  };

  return providers
    .filter((p) => p.id !== providerId && p.type === origin.type && p.location !== null)
    .sort((a, b) => km(a.location!) - km(b.location!))
    .slice(0, limit);
}

/** Invalidate the in-memory catalog (e.g. after tests). */
export function clearProviderCache(): void {
  catalogLoader.clear();
}
