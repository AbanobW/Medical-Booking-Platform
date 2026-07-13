"use client";

import { ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getInsurancePlanName } from "@/lib/data/egypt";
import { INSURANCE_ENABLED } from "@/lib/types";

/**
 * Accepted insurance plans (§14 — future phase).
 *
 * Informational only while `INSURANCE_ENABLED` is false: the provider has
 * declared the networks they accept, but nothing on the platform can be booked
 * *through* insurance yet, and we say so rather than implying coverage.
 */
export function InsuranceCard({ planIds }: { planIds: string[] }) {
  if (planIds.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="size-4 text-primary" />
          Accepted insurance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {planIds.map((id) => (
            <Badge key={id} variant="outline" className="font-normal">
              {getInsurancePlanName(id)}
            </Badge>
          ))}
        </div>

        {!INSURANCE_ENABLED && (
          <p className="rounded-xl bg-muted p-3 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Coming soon.</span> These
            are the networks this provider accepts at the clinic. Booking with
            insurance isn&apos;t live on Vesita yet — for now, bookings are paid
            directly.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
