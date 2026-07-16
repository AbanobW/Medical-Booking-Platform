/**
 * Provider discovery and availability.
 *
 * Everything here comes from MedPoint. This module used to pick between a
 * seeded dataset and the API; there is no dataset now, so it is a thin seam over
 * `medpoint/*` that exists only so screens keep importing `@/lib/api/providers`
 * rather than reaching into the wire layer.
 *
 * What the API cannot answer is not answered: `getPopularSpecialties` and
 * `getProviderReviews` return nothing, because no endpoint serves them. They are
 * not simulated.
 */

export {
  searchProviders,
  getProviderBySlug,
  getProviderById,
  getFeaturedProviders,
  getPopularSpecialties,
  getProviderReviews,
  getNearbyProviders,
  clearProviderCache,
} from "@/lib/api/medpoint/providers";

export {
  getAvailability,
  getSlotsForDate,
  getNextSlots,
  clearAvailabilityCache,
} from "@/lib/api/medpoint/availability";

export type { Doctor, Lab, RadiologyCenter } from "@/lib/types";
