/**
 * Admin resources that MedPoint actually serves.
 *
 * Coupons are real and complete enough to map. Users and providers are real but
 * admin-gated — a non-admin token gets a 403, which is the correct answer and is
 * surfaced rather than swallowed.
 */

import { apiList, apiRequest } from "@/lib/api/http";
import { parseMoney } from "@/lib/api/medpoint/mappers";
import type { WireCoupon } from "@/lib/api/medpoint/types";
import type { Coupon, DiscountType } from "@/lib/types";

function discountTypeOf(raw: string | undefined): DiscountType {
  return raw === "percentage" ? "percentage" : "fixed";
}

export function toCoupon(wire: WireCoupon): Coupon {
  const expiresAt = wire.expires_at ?? null;

  return {
    id: wire.id,
    code: wire.code,
    // No description column on the wire.
    description: null,
    discountType: discountTypeOf(wire.coupon_type),
    discountValue: parseMoney(wire.value),
    // No minimum-order column: null reads as "unknown", where 0 would read as
    // "no minimum" — a different and possibly wrong promise.
    minOrderValue: null,
    // A null `max_uses` is the API's way of saying unlimited.
    usageLimit: wire.max_uses ?? null,
    usageCount: wire.used_count ?? 0,
    expiresAt,
    // Expiry is the only signal available; `scope: "global"` says who it applies
    // to, not whether it is switched on.
    isActive: expiresAt === null || expiresAt > new Date().toISOString(),
    appliesTo: [],
    createdAt: wire.created_at ?? new Date().toISOString(),
  };
}

export async function getCoupons(): Promise<Coupon[]> {
  const { items } = await apiList<WireCoupon>("/coupons");
  return items.map(toCoupon);
}

export async function deleteCoupon(id: string): Promise<{ id: string }> {
  await apiRequest<void>(`/coupons/${id}`, { method: "DELETE" });
  return { id };
}
