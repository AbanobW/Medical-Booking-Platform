"use client";

import { formatEGP } from "@/lib/site";
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
): { min: number; max: number; varies: boolean } {
  const offering = branches.filter(
    (branch) => branch.isActive && branch.serviceIds.includes(service.id),
  );

  const prices = (offering.length > 0 ? offering : []).map((branch) =>
    branchPriceOf(branch, service),
  );
  if (prices.length === 0) prices.push(service.price);

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return { min, max, varies: min !== max };
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
  const { min, varies } = branchPriceRange(service, branches);

  return (
    <span className={cn("shrink-0 text-right", className)}>
      <span className="font-bold text-primary tabular-nums">
        {varies ? `from ${formatEGP(min)}` : formatEGP(min)}
      </span>
      {varies && (
        <span className="block text-xs font-normal text-muted-foreground">
          varies by branch
        </span>
      )}
    </span>
  );
}
