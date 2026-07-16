import type { MetadataRoute } from "next";

import { GOVERNORATES, SPECIALTIES } from "@/lib/data/egypt";
import { SITE } from "@/lib/site";

/**
 * Every public URL: static pages and search facets.
 *
 * Provider pages are **not** listed. They used to be enumerated from the seeded
 * dataset, which was available synchronously at build time. The real catalogue
 * lives behind `/v1/providers`, which requires a bearer token — and a sitemap is
 * generated on the server with no signed-in user, so there is no token to send.
 * Listing providers again needs either a public (unauthenticated) provider
 * endpoint or a build-time service credential; see BACKEND-GAPS.md.
 *
 * The facet pages below are static and carry the long-tail search traffic
 * regardless, so the sitemap is thinner but not wrong.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = SITE.url;
  const lastModified = new Date();

  const staticPages: MetadataRoute.Sitemap = (
    [
      { url: base, changeFrequency: "daily", priority: 1 },
      { url: `${base}/search?type=doctor`, changeFrequency: "daily", priority: 0.9 },
      { url: `${base}/search?type=lab`, changeFrequency: "daily", priority: 0.9 },
      { url: `${base}/search?type=radiology`, changeFrequency: "daily", priority: 0.9 },
      { url: `${base}/login`, changeFrequency: "monthly", priority: 0.3 },
      { url: `${base}/register`, changeFrequency: "monthly", priority: 0.4 },
    ] satisfies MetadataRoute.Sitemap
  ).map((entry) => ({ ...entry, lastModified }));

  // Facet pages are where the long-tail search traffic actually lands.
  const facets: MetadataRoute.Sitemap = [
    ...SPECIALTIES.map((s) => `${base}/search?type=doctor&specialtyId=${s.id}`),
    ...GOVERNORATES.map((g) => `${base}/search?type=doctor&governorateId=${g.id}`),
  ].map((url) => ({
    url,
    lastModified,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  return [...staticPages, ...facets];
}
