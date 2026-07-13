import type { Metadata } from "next";

import { getAreaName, getGovernorateName, getSpecialtyName } from "@/lib/data/egypt";
import { DB } from "@/lib/data/seed";
import { formatEGP } from "@/lib/site";
import type { Provider, ProviderRole } from "@/lib/types";

/**
 * Server-side provider lookup for the profile routes.
 *
 * The profile UIs are client components (they fetch through the mock API like
 * everything else), but the *route* still needs to resolve the slug on the
 * server so it can emit a real 404 and per-provider metadata instead of a soft
 * 404 with the generic site title.
 */
export function findProviderForRoute(
  slug: string,
  type: ProviderRole,
): Provider | null {
  const provider = DB.providers.find((p) => p.slug === slug);

  // Wrong-type slugs (a lab id under /doctors/) are 404s, not redirects.
  if (!provider || provider.type !== type) return null;
  if (provider.status !== "approved") return null;

  return provider;
}

/** Per-provider title/description/OG tags — the actual SEO payload. */
export function providerMetadata(provider: Provider): Metadata {
  const where = `${getAreaName(provider.areaId)}, ${getGovernorateName(provider.governorateId)}`;

  const title =
    provider.type === "doctor"
      ? `${provider.name} — ${getSpecialtyName(provider.specialtyId)} in ${where}`
      : `${provider.name} — ${where}`;

  const description =
    provider.type === "doctor"
      ? `Book ${provider.name}, ${getSpecialtyName(provider.specialtyId)} in ${where}. ` +
        `${provider.yearsOfExperience} years of experience · ${provider.rating.toFixed(1)}★ from ` +
        `${provider.reviewCount} reviews · Consultation from ${formatEGP(provider.price)}.`
      : `Book ${provider.name} in ${where}. ${provider.rating.toFixed(1)}★ from ` +
        `${provider.reviewCount} reviews · ${
          provider.type === "lab"
            ? `${provider.tests.length} tests`
            : `${provider.scans.length} scans`
        } from ${formatEGP(provider.price)}.`;

  const segment =
    provider.type === "doctor"
      ? "doctors"
      : provider.type === "lab"
        ? "labs"
        : "radiology";

  return {
    title,
    description,
    alternates: { canonical: `/${segment}/${provider.slug}` },
    openGraph: {
      type: "profile",
      title,
      description,
      images: [{ url: provider.coverImage, width: 1200, height: 400, alt: provider.name }],
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

/**
 * schema.org JSON-LD. This is what actually earns the rich result — rating
 * stars and price in the SERP — so it's worth emitting properly.
 */
export function providerJsonLd(provider: Provider) {
  const type =
    provider.type === "doctor"
      ? "Physician"
      : provider.type === "lab"
        ? "MedicalClinic"
        : "MedicalClinic";

  return {
    "@context": "https://schema.org",
    "@type": type,
    name: provider.name,
    description: provider.bio,
    image: provider.photo,
    telephone: provider.phone,
    address: {
      "@type": "PostalAddress",
      streetAddress: provider.address,
      addressLocality: getAreaName(provider.areaId),
      addressRegion: getGovernorateName(provider.governorateId),
      addressCountry: "EG",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: provider.location.lat,
      longitude: provider.location.lng,
    },
    ...(provider.type === "doctor" && {
      medicalSpecialty: getSpecialtyName(provider.specialtyId),
    }),
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: provider.rating,
      reviewCount: provider.reviewCount,
      bestRating: 5,
      worstRating: 1,
    },
    priceRange: formatEGP(provider.price),
  };
}

/** Renders the JSON-LD block. */
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
