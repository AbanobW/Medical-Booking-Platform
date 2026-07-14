import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { getLocale } from "@/i18n/locale";
import type { Locale } from "@/i18n/config";
import { DB } from "@/lib/data/seed";
import {
  getAreaName,
  getGovernorateName,
  getSpecialtyName,
  localized,
  named,
} from "@/lib/i18n/domain";
import { formatEGP } from "@/lib/i18n/format";
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

/**
 * Per-provider title/description/OG tags — the actual SEO payload.
 *
 * Async because the locale lives in a cookie: an Arabic visitor must get an
 * Arabic title and description, not an English one with an Arabic body.
 */
export async function providerMetadata(provider: Provider): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations("profile.seo");

  const where = `${getAreaName(provider.areaId, locale)}, ${getGovernorateName(provider.governorateId, locale)}`;
  const name = named(provider, locale);
  const rating = provider.rating.toFixed(1);

  const title =
    provider.type === "doctor"
      ? t("doctorTitle", {
          name,
          specialty: getSpecialtyName(provider.specialtyId, locale),
          where,
        })
      : t("providerTitle", { name, where });

  const description =
    provider.type === "doctor"
      ? t("doctorDescription", {
          name,
          specialty: getSpecialtyName(provider.specialtyId, locale),
          where,
          years: provider.yearsOfExperience,
          rating,
          reviews: provider.reviewCount,
          price: formatEGP(provider.price, locale),
        })
      : t("providerDescription", {
          name,
          where,
          rating,
          reviews: provider.reviewCount,
          count:
            provider.type === "lab"
              ? provider.tests.length
              : provider.scans.length,
          kind: provider.type,
          price: formatEGP(provider.price, locale),
        });

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
      images: [
        { url: provider.coverImage, width: 1200, height: 400, alt: name },
      ],
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

/**
 * schema.org JSON-LD. This is what actually earns the rich result — rating
 * stars and price in the SERP — so it's worth emitting properly.
 *
 * Emitted in the visitor's language: `name` and `description` are what a search
 * engine shows, so an Arabic page must not advertise an English name.
 */
export function providerJsonLd(provider: Provider, locale: Locale) {
  const type =
    provider.type === "doctor"
      ? "Physician"
      : provider.type === "lab"
        ? "MedicalClinic"
        : "MedicalClinic";

  return {
    "@context": "https://schema.org",
    "@type": type,
    name: named(provider, locale),
    description: localized(provider.bio, locale),
    image: provider.photo,
    telephone: provider.phone,
    address: {
      "@type": "PostalAddress",
      streetAddress: provider.address,
      addressLocality: getAreaName(provider.areaId, locale),
      addressRegion: getGovernorateName(provider.governorateId, locale),
      addressCountry: "EG",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: provider.location.lat,
      longitude: provider.location.lng,
    },
    ...(provider.type === "doctor" && {
      medicalSpecialty: getSpecialtyName(provider.specialtyId, locale),
    }),
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: provider.rating,
      reviewCount: provider.reviewCount,
      bestRating: 5,
      worstRating: 1,
    },
    priceRange: formatEGP(provider.price, locale),
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
