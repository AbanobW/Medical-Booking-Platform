import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import DoctorProfilePage from "./profile-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("profile");
  return { title: t("meta.doctorTitle") };
}

/**
 * Doctor profile.
 *
 * A thin server wrapper now. It used to resolve the slug against the seeded
 * catalogue so an unknown doctor was a real 404 with per-doctor metadata and
 * JSON-LD. The catalogue is behind an authenticated endpoint that a server
 * render has no token for, so the slug is resolved by the client component
 * instead — which shows its own not-found state — and the title is generic.
 * See `@/lib/seo`.
 */
export default function Page() {
  return <DoctorProfilePage />;
}
