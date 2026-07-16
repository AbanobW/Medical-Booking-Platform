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
  Paginated,
  Provider,
  ProviderRole,
  Review,
  SearchFilters,
  Weekday,
} from "@/lib/types";

const PAGE_SIZE = 50;

// One cached, request-coalesced build of the catalog. Concurrent callers — the
// search grid, featured rails, a provider page — share a single fetch of
// providers + branches + services rather than each firing their own.
const catalogLoader = createCachedLoader(buildCatalog);

async function buildCatalog(): Promise<Provider[]> {
  const [wires, branchWires, serviceWires] = await Promise.all([
    fetchAllPages<WireProvider>("/providers", PAGE_SIZE),
    fetchAllPages<WireBranch>("/branches", PAGE_SIZE),
    fetchAllPages<WireService>("/services", PAGE_SIZE),
  ]);

  // The API sends no `provider_id` on a branch. It does, however, encode every
  // table's row id with the same salt, so a provider's *primary* branch comes
  // back carrying the provider's own id (Provider row N and Branch row N collide
  // — verified: the first eight ids line up exactly). Fall back to that when the
  // foreign key is absent, so every provider gets its real location and a branch
  // the booking flow can hang off. Secondary branches carry ids that match no
  // provider and are simply left unattached.
  const branchesByProvider = new Map<string, WireBranch[]>();
  for (const branch of branchWires) {
    const pid = branch.provider_id ?? branch.id;
    const list = branchesByProvider.get(pid) ?? [];
    list.push(branch);
    branchesByProvider.set(pid, list);
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

function distanceFrom(provider: Provider, governorateId?: string): number {
  const gov = GOVERNORATES.find((g) => g.id === (governorateId ?? "cairo"))!;
  const dLat = (provider.location.lat - gov.lat) * 111;
  const dLng =
    (provider.location.lng - gov.lng) * 111 * Math.cos((gov.lat * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng);
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
  if (minRating !== undefined)
    results = results.filter((p) => p.rating >= minRating);
  if (minPrice !== undefined) results = results.filter((p) => p.price >= minPrice);
  if (maxPrice !== undefined) results = results.filter((p) => p.price <= maxPrice);

  const sorted = [...results].sort((a, b) => {
    switch (sort) {
      case "lowest_price":
        return a.price - b.price;
      case "most_booked":
        return b.bookingCount - a.bookingCount;
      case "nearest":
        return distanceFrom(a, governorateId) - distanceFrom(b, governorateId);
      case "highest_rated":
      default:
        return b.rating - a.rating || b.reviewCount - a.reviewCount;
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
    .sort((a, b) => b.rating - a.rating || b.bookingCount - a.bookingCount)
    .slice(0, limit);
}

export async function getPopularSpecialties(limit = 12) {
  const providers = await loadCatalog();
  const counts = new Map<string, number>();

  for (const p of providers) {
    if (p.type !== "doctor") continue;
    counts.set(p.specialtyId, (counts.get(p.specialtyId) ?? 0) + 1);
  }

  return Array.from(counts, ([id, doctorCount]) => ({
    ...SPECIALTIES.find((s) => s.id === id)!,
    doctorCount,
  }))
    .filter((s) => s.id)
    .sort((a, b) => b.doctorCount - a.doctorCount)
    .slice(0, limit);
}

/** Reviews stay mock in live MVP — returns empty until wired. */
export async function getProviderReviews(_providerId: string): Promise<Review[]> {
  return [];
}

export async function getNearbyProviders(
  providerId: string,
  limit = 4,
): Promise<Provider[]> {
  const providers = await loadCatalog();
  const origin = providers.find((p) => p.id === providerId);
  if (!origin) throw new ApiError("Provider not found", 404, "provider.notFound");

  const km = (p: Provider) => {
    const dLat = (p.location.lat - origin.location.lat) * 111;
    const dLng =
      (p.location.lng - origin.location.lng) *
      111 *
      Math.cos((origin.location.lat * Math.PI) / 180);
    return Math.sqrt(dLat * dLat + dLng * dLng);
  };

  return providers
    .filter((p) => p.id !== providerId && p.type === origin.type)
    .sort((a, b) => km(a) - km(b))
    .slice(0, limit);
}

/** Invalidate the in-memory catalog (e.g. after tests). */
export function clearProviderCache(): void {
  catalogLoader.clear();
}
