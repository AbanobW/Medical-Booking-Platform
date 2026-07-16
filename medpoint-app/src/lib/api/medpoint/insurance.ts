/**
 * Insurance networks (§14 — future phase).
 *
 * `/v1/insurances` is real and lists real plans (13 on staging: AXA, MedNet,
 * Bupa, …) — this used to be a hardcoded 6-entry list in `data/egypt.ts` that
 * quietly drifted from what the API actually has. There is no separate Arabic
 * name on the wire, so `nameAr` falls back to the one name given, same as
 * every other entity with no `nameAr` column.
 *
 * Nothing consumes this yet: `Provider.acceptedInsurancePlanIds` is always `[]`
 * (no such field exists on a wire `Provider`), so this only matters once that
 * changes or `INSURANCE_ENABLED` flips on.
 */

import { apiList } from "@/lib/api/http";
import type { WireInsurance } from "@/lib/api/medpoint/types";
import type { InsurancePlan } from "@/lib/types";

function toInsurancePlan(wire: WireInsurance): InsurancePlan {
  return {
    id: wire.id,
    name: wire.plan_name,
    nameAr: wire.plan_name,
  };
}

export async function getInsurancePlans(): Promise<InsurancePlan[]> {
  const { items } = await apiList<WireInsurance>("/insurances");
  return items.map(toInsurancePlan);
}
