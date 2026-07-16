"use client";

import { useTranslations } from "next-intl";

import { DASH } from "@/lib/i18n/format";
import { useFormat } from "@/lib/i18n/use-format";
import { branchPriceOf, type Branch, type Service } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Branch-specific pricing (§2).
 *
 * The same service can cost differently at different branches, so a single
 * headline price would be a lie. We show the cheapest branch price and say
 * plainly when it varies — the exact price is settled once a branch is chosen.
 */
export function branchPriceRange(
  service: Service,
  branches: Branch[],
): { min: number | null; max: number | null; varies: boolean } {
  const offering = branches.filter(
    (branch) => branch.isActive && branch.serviceIds.includes(service.id),
  );

  const prices: (number | null)[] =
    offering.length > 0
      ? offering.map((branch) => branchPriceOf(branch, service))
      : [service.price];

  const known = prices.filter((price): price is number => price !== null);
  if (known.length === 0) return { min: null, max: null, varies: false };

  const min = Math.min(...known);
  const max = Math.max(...known);
  // A branch whose price the API did not answer is another way it varies: the
  // cheapest we know of is not necessarily the cheapest there is.
  return { min, max, varies: min !== max || known.length < prices.length };
}

export function BranchPrice({
  service,
  branches,
  className,
}: {
  service: Service;
  branches: Branch[];
  className?: string;
}) {
  const t = useTranslations("profile");
  const { formatEGP } = useFormat();
  const { min, varies } = branchPriceRange(service, branches);

  return (
    <span className={cn("shrink-0 text-end", className)}>
      <span className="font-bold text-primary tabular-nums">
        {min === null
          ? DASH
          : varies
            ? t("price.from", { price: formatEGP(min) })
            : formatEGP(min)}
      </span>
      {varies && (
        <span className="block text-xs font-normal text-muted-foreground">
          {t("price.variesByBranch")}
        </span>
      )}
    </span>
  );
}
