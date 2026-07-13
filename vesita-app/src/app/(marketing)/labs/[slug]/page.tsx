import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { JsonLd, findProviderForRoute, providerJsonLd, providerMetadata } from "@/lib/seo";
import LabProfilePage from "./profile-client";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const lab = findProviderForRoute(slug, "lab");

  if (!lab) return { title: "Lab not found" };
  return providerMetadata(lab);
}

/** See the doctor route — same server-resolve-then-render pattern. */
export default async function Page({ params }: Props) {
  const { slug } = await params;
  const lab = findProviderForRoute(slug, "lab");

  if (!lab) notFound();

  return (
    <>
      <JsonLd data={providerJsonLd(lab)} />
      <LabProfilePage />
    </>
  );
}
