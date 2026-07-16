"use client";

import { ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAsync } from "@/hooks/use-async";
import { getInsurancePlans } from "@/lib/api/medpoint/insurance";
import { useDomain } from "@/lib/i18n/use-format";
import { INSURANCE_ENABLED } from "@/lib/types";

/**
 * Accepted insurance plans (§14 — future phase).
 *
 * Informational only while `INSURANCE_ENABLED` is false: the provider has
 * declared the networks they accept, but nothing on the platform can be booked
 * *through* insurance yet, and we say so rather than implying coverage.
 *
 * `planIds` always arrives empty today — no wire `Provider` has an insurance
 * field yet — so this renders nothing in practice. It fetches the real plan
 * list (`/v1/insurances`) rather than a local table, so the day a provider
 * does carry plan ids, the names shown are never stale.
 */
export function InsuranceCard({ planIds }: { planIds: string[] }) {
  const t = useTranslations("profile");
  const { named } = useDomain();
  const { data: plans } = useAsync(getInsurancePlans, []);

  if (planIds.length === 0) return null;

  const nameFor = (id: string): string => {
    const plan = plans?.find((p) => p.id === id);
    return plan ? named(plan) : id;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="size-4 text-primary" />
          {t("insurance.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {planIds.map((id) => (
            <Badge key={id} variant="outline" className="font-normal">
              {nameFor(id)}
            </Badge>
          ))}
        </div>

        {!INSURANCE_ENABLED && (
          <p className="rounded-xl bg-muted p-3 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">
              {t("insurance.comingSoonLabel")}
            </span>{" "}
            {t("insurance.comingSoon")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
