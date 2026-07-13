"use client";

import Link from "next/link";
import { SearchX } from "lucide-react";

import { EmptyState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";

/** Clean 404 surface for a slug that doesn't resolve to the expected type. */
export function ProviderNotFound({
  title = "We couldn't find that profile",
  description = "The link may be out of date, or the provider is no longer listed on Vesita.",
  backHref = "/search",
  backLabel = "Browse providers",
}: {
  title?: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-24 sm:px-6 lg:px-8">
      <EmptyState
        icon={SearchX}
        title={title}
        description={description}
        action={
          <div className="flex flex-wrap justify-center gap-3">
            <Button render={<Link href={backHref} />} className="h-10 rounded-xl px-4">
              {backLabel}
            </Button>
            <Button
              render={<Link href="/" />}
              variant="outline"
              className="h-10 rounded-xl px-4"
            >
              Back home
            </Button>
          </div>
        }
      />
    </div>
  );
}
