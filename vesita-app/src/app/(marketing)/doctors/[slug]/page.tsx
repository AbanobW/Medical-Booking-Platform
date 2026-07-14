import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { getLocale } from "@/i18n/locale";
import { JsonLd, findProviderForRoute, providerJsonLd, providerMetadata } from "@/lib/seo";
import DoctorProfilePage from "./profile-client";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const doctor = findProviderForRoute(slug, "doctor");

  if (!doctor) {
    const t = await getTranslations("profile");
    return { title: t("meta.doctorNotFound") };
  }
  return providerMetadata(doctor);
}

/**
 * Server wrapper: resolves the slug so an unknown doctor is a real 404 (not a
 * soft 404 rendered at 200), and emits per-doctor metadata + JSON-LD. The
 * profile UI itself stays a client component.
 */
export default async function Page({ params }: Props) {
  const { slug } = await params;
  const doctor = findProviderForRoute(slug, "doctor");

  if (!doctor) notFound();

  const locale = await getLocale();

  return (
    <>
      <JsonLd data={providerJsonLd(doctor, locale)} />
      <DoctorProfilePage />
    </>
  );
}
