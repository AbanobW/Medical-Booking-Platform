"use client";

import Link from "next/link";
import { SearchX } from "lucide-react";
import { useTranslations } from "next-intl";

import { EmptyState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";

/** Clean 404 surface for a slug that doesn't resolve to the expected type. */
export function ProviderNotFound({
  title,
  description,
  backHref = "/search",
  backLabel,
}: {
  title?: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
}) {
  const t = useTranslations("profile");

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-24 sm:px-6 lg:px-8">
      <EmptyState
        icon={SearchX}
        title={title ?? t("notFound.genericTitle")}
        description={description ?? t("notFound.genericDescription")}
        action={
          <div className="flex flex-wrap justify-center gap-3">
            <Button render={<Link href={backHref} />} className="h-10 rounded-xl px-4">
              {backLabel ?? t("notFound.browseProviders")}
            </Button>
            <Button
              render={<Link href="/" />}
              variant="outline"
              className="h-10 rounded-xl px-4"
            >
              {t("notFound.backHome")}
            </Button>
          </div>
        }
      />
    </div>
  );
}
