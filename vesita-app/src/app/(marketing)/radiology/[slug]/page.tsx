import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { getLocale } from "@/i18n/locale";
import { JsonLd, findProviderForRoute, providerJsonLd, providerMetadata } from "@/lib/seo";
import RadiologyProfilePage from "./profile-client";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const center = findProviderForRoute(slug, "radiology");

  if (!center) {
    const t = await getTranslations("profile");
    return { title: t("meta.radiologyNotFound") };
  }
  return providerMetadata(center);
}

/** See the doctor route — same server-resolve-then-render pattern. */
export default async function Page({ params }: Props) {
  const { slug } = await params;
  const center = findProviderForRoute(slug, "radiology");

  if (!center) notFound();

  const locale = await getLocale();

  return (
    <>
      <JsonLd data={providerJsonLd(center, locale)} />
      <RadiologyProfilePage />
    </>
  );
}
