import type { MetadataRoute } from "next";

import { SITE } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Authenticated surfaces carry no crawlable value and shouldn't be indexed.
      disallow: ["/patient/", "/provider/", "/admin/", "/booking/", "/api/"],
    },
    sitemap: `${SITE.url}/sitemap.xml`,
  };
}
