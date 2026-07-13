import type { MetadataRoute } from "next";

import { GOVERNORATES, SPECIALTIES } from "@/lib/data/egypt";
import { DB } from "@/lib/data/seed";
import { SITE } from "@/lib/site";

/** Every public URL: static pages, search facets, and one page per provider. */
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

  const segment = { doctor: "doctors", lab: "labs", radiology: "radiology" } as const;

  const providers: MetadataRoute.Sitemap = DB.providers
    .filter((p) => p.status === "approved")
    .map((p) => ({
      url: `${base}/${segment[p.type]}/${p.slug}`,
      lastModified,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));

  return [...staticPages, ...facets, ...providers];
}
