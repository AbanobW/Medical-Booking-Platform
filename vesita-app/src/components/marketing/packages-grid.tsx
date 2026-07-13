"use client";

import Link from "next/link";
import { Check, PackageOpen } from "lucide-react";

import { EmptyState } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatEGP } from "@/lib/site";
import type { LabTest, RadiologyScan, ServicePackage } from "@/lib/types";

/** Discounted bundles of tests / scans, with the included items spelled out. */
export function PackagesGrid({
  packages,
  catalog,
  slug,
}: {
  packages: ServicePackage[];
  /** Used to resolve `includes` IDs into human names. */
  catalog: (LabTest | RadiologyScan)[];
  slug: string;
}) {
  const active = packages.filter((p) => p.isActive);
  const nameOf = (id: string) =>
    catalog.find((item) => item.id === id)?.name ?? "Included service";

  if (active.length === 0) {
    return (
      <EmptyState
        icon={PackageOpen}
        title="No packages available"
        description="This center doesn't currently bundle its services into packages."
      />
    );
  }

  return (
    <ul className="grid gap-5 lg:grid-cols-2">
      {active.map((pkg) => {
        const saving = pkg.originalPrice - pkg.price;
        const percent = pkg.originalPrice
          ? Math.round((saving / pkg.originalPrice) * 100)
          : 0;

        return (
          <li key={pkg.id}>
            <Card className="h-full border-primary/20 transition-shadow hover:shadow-lift">
              <CardContent className="flex h-full flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="font-semibold leading-tight">{pkg.name}</h4>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {pkg.description}
                    </p>
                  </div>
                  {percent > 0 && (
                    <Badge className="shrink-0 bg-success text-success-foreground tabular-nums">
                      Save {percent}%
                    </Badge>
                  )}
                </div>

                <ul className="space-y-1.5">
                  {pkg.includes.map((id) => (
                    <li key={id} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-success" />
                      <span className="text-foreground/90">{nameOf(id)}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-auto flex items-end justify-between gap-3 border-t pt-4">
                  <div>
                    <p className="text-xs text-muted-foreground line-through tabular-nums">
                      {formatEGP(pkg.originalPrice)}
                    </p>
                    <p className="text-xl font-bold text-primary tabular-nums">
                      {formatEGP(pkg.price)}
                    </p>
                    {saving > 0 && (
                      <p className="text-xs font-medium text-success tabular-nums">
                        You save {formatEGP(saving)}
                      </p>
                    )}
                  </div>

                  <Button
                    render={<Link href={`/booking/${slug}?serviceId=${pkg.id}`} />}
                    className="h-10 rounded-xl px-4"
                  >
                    Book package
                  </Button>
                </div>
              </CardContent>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
