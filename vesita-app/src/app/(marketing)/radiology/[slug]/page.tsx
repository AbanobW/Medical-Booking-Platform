import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { JsonLd, findProviderForRoute, providerJsonLd, providerMetadata } from "@/lib/seo";
import RadiologyProfilePage from "./profile-client";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const center = findProviderForRoute(slug, "radiology");

  if (!center) return { title: "Radiology center not found" };
  return providerMetadata(center);
}

/** See the doctor route — same server-resolve-then-render pattern. */
export default async function Page({ params }: Props) {
  const { slug } = await params;
  const center = findProviderForRoute(slug, "radiology");

  if (!center) notFound();

  return (
    <>
      <JsonLd data={providerJsonLd(center)} />
      <RadiologyProfilePage />
    </>
  );
}
