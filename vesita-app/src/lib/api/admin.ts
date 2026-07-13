import { applyProviderCancellation, isUpcoming } from "@/lib/api/bookings";
import { ApiError, db, makeId, paginate, request } from "@/lib/api/client";
import {
  isHold,
  type CashbackCampaign,
  type CommissionSettings,
  type Coupon,
  type Paginated,
  type Provider,
  type ProviderRole,
  type ProviderStatus,
  type Role,
  type SuspensionType,
  type User,
  type UserStatus,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export interface UserQuery {
  q?: string;
  role?: Role;
  status?: UserStatus;
  page?: number;
  pageSize?: number;
}

export function getUsers(query: UserQuery = {}): Promise<Paginated<User>> {
  return request(() => {
    const { q, role, status, page = 1, pageSize = 10 } = query;

    let results = db().users;

    if (role) results = results.filter((u) => u.role === role);
    if (status) results = results.filter((u) => u.status === status);
    if (q) {
      const term = q.toLowerCase();
      results = results.filter((u) =>
        [u.name, u.email, u.phone].join(" ").toLowerCase().includes(term),
      );
    }

    const sorted = [...results].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
    return paginate(sorted, page, pageSize);
  });
}

export function setUserStatus(id: string, status: UserStatus): Promise<User> {
  return request(() => {
    const state = db();
    const user = state.users.find((u) => u.id === id);
    if (!user) throw new ApiError("User not found", 404);

    user.status = status;

    // Suspending a provider's account must also pull their public listing.
    if (user.providerId) {
      const provider = state.providers.find((p) => p.id === user.providerId);
      if (provider) {
        if (status === "suspended") provider.status = "suspended";
        else if (provider.status === "suspended") provider.status = "approved";
      }
    }

    return user;
  });
}

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

export interface AdminProviderQuery {
  q?: string;
  type?: ProviderRole;
  status?: ProviderStatus;
  governorateId?: string;
  page?: number;
  pageSize?: number;
}

export function getAdminProviders(
  query: AdminProviderQuery = {},
): Promise<Paginated<Provider>> {
  return request(() => {
    const { q, type, status, governorateId, page = 1, pageSize = 10 } = query;

    let results = db().providers;

    if (type) results = results.filter((p) => p.type === type);
    if (status) results = results.filter((p) => p.status === status);
    if (governorateId)
      results = results.filter((p) => p.governorateId === governorateId);
    if (q) {
      const term = q.toLowerCase();
      results = results.filter((p) =>
        [p.name, p.address, p.phone].join(" ").toLowerCase().includes(term),
      );
    }

    const sorted = [...results].sort((a, b) => b.joinedAt.localeCompare(a.joinedAt));
    return paginate(sorted, page, pageSize);
  });
}

export function setProviderStatus(
  id: string,
  status: ProviderStatus,
): Promise<Provider> {
  return request(() => {
    const state = db();
    const provider = state.providers.find((p) => p.id === id);
    if (!provider) throw new ApiError("Provider not found", 404);

    provider.status = status;
    if (status !== "suspended") provider.suspension = undefined;

    // Keep the linked login account in sync.
    const account = state.users.find((u) => u.providerId === id);
    if (account) {
      account.status = status === "suspended" ? "suspended" : status === "pending" ? "pending" : "active";
    }

    return provider;
  });
}

/**
 * Suspends a provider (§13).
 *
 * A **soft** suspension removes them from search and blocks new bookings while
 * honoring the bookings that already exist — it suits a temporary pause and does
 * not punish patients who already booked.
 *
 * A **hard** suspension — for a credential problem or fraud — additionally
 * cancels every upcoming booking, refunds them in full, and notifies the
 * affected patients so they can rebook elsewhere.
 */
export function suspendProvider(
  id: string,
  type: SuspensionType,
  reason: string,
): Promise<{ provider: Provider; cancelledBookings: number }> {
  return request(() => {
    const state = db();
    const provider = state.providers.find((p) => p.id === id);
    if (!provider) throw new ApiError("Provider not found", 404);

    let cancelledBookings = 0;

    if (type === "hard") {
      const upcoming = state.bookings.filter(
        (b) =>
          b.providerId === id &&
          isUpcoming(b) &&
          (b.status === "confirmed" || isHold(b.status)),
      );

      for (const booking of upcoming) {
        if (isHold(booking.status)) {
          state.bookings = state.bookings.filter((x) => x.id !== booking.id);
          continue;
        }
        applyProviderCancellation(
          booking,
          `${provider.name} has been suspended from the platform. ${reason}`,
        );
        cancelledBookings += 1;
      }
    }

    provider.status = "suspended";
    provider.suspension = {
      type,
      reason,
      suspendedAt: new Date().toISOString(),
      cancelledBookingCount: cancelledBookings,
    };

    const account = state.users.find((u) => u.providerId === id);
    if (account) account.status = "suspended";

    return { provider, cancelledBookings };
  });
}

/** Lifts a suspension and returns the provider to search. */
export function reinstateProvider(id: string): Promise<Provider> {
  return request(() => {
    const state = db();
    const provider = state.providers.find((p) => p.id === id);
    if (!provider) throw new ApiError("Provider not found", 404);

    provider.status = "approved";
    provider.suspension = undefined;

    const account = state.users.find((u) => u.providerId === id);
    if (account) account.status = "active";

    return provider;
  });
}

// ---------------------------------------------------------------------------
// Coupons
// ---------------------------------------------------------------------------

export function getCoupons(): Promise<Coupon[]> {
  return request(() =>
    [...db().coupons].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  );
}

export type CouponInput = Omit<Coupon, "id" | "usageCount" | "createdAt">;

export function createCoupon(input: CouponInput): Promise<Coupon> {
  return request(() => {
    const state = db();

    const exists = state.coupons.some(
      (c) => c.code.toUpperCase() === input.code.toUpperCase(),
    );
    if (exists) throw new ApiError("A coupon with that code already exists.", 409);

    const coupon: Coupon = {
      ...input,
      code: input.code.toUpperCase(),
      id: makeId("cpn"),
      usageCount: 0,
      createdAt: new Date().toISOString(),
    };

    state.coupons.unshift(coupon);
    return coupon;
  });
}

export function updateCoupon(id: string, patch: Partial<CouponInput>): Promise<Coupon> {
  return request(() => {
    const state = db();
    const coupon = state.coupons.find((c) => c.id === id);
    if (!coupon) throw new ApiError("Coupon not found", 404);

    if (patch.code) {
      const clash = state.coupons.some(
        (c) => c.id !== id && c.code.toUpperCase() === patch.code!.toUpperCase(),
      );
      if (clash) throw new ApiError("A coupon with that code already exists.", 409);
    }

    Object.assign(coupon, patch, patch.code ? { code: patch.code.toUpperCase() } : {});
    return coupon;
  });
}

export function deleteCoupon(id: string): Promise<{ id: string }> {
  return request(() => {
    const state = db();
    const index = state.coupons.findIndex((c) => c.id === id);
    if (index < 0) throw new ApiError("Coupon not found", 404);

    state.coupons.splice(index, 1);
    return { id };
  });
}

// ---------------------------------------------------------------------------
// Cashback campaigns
// ---------------------------------------------------------------------------

export function getCampaigns(): Promise<CashbackCampaign[]> {
  return request(() =>
    [...db().campaigns].sort((a, b) => b.startsAt.localeCompare(a.startsAt)),
  );
}

export type CampaignInput = Omit<
  CashbackCampaign,
  "id" | "totalIssued" | "redeemedCount" | "status"
>;

/** Derives status from the campaign window rather than trusting the caller. */
function statusFor(startsAt: string, endsAt: string): CashbackCampaign["status"] {
  const now = new Date().toISOString();
  if (endsAt < now) return "ended";
  if (startsAt > now) return "scheduled";
  return "active";
}

export function createCampaign(input: CampaignInput): Promise<CashbackCampaign> {
  return request(() => {
    const campaign: CashbackCampaign = {
      ...input,
      id: makeId("cbk"),
      status: statusFor(input.startsAt, input.endsAt),
      totalIssued: 0,
      redeemedCount: 0,
    };

    db().campaigns.unshift(campaign);
    return campaign;
  });
}

export function updateCampaign(
  id: string,
  patch: Partial<CampaignInput>,
): Promise<CashbackCampaign> {
  return request(() => {
    const campaign = db().campaigns.find((c) => c.id === id);
    if (!campaign) throw new ApiError("Campaign not found", 404);

    Object.assign(campaign, patch);
    campaign.status = statusFor(campaign.startsAt, campaign.endsAt);
    return campaign;
  });
}

export function deleteCampaign(id: string): Promise<{ id: string }> {
  return request(() => {
    const state = db();
    const index = state.campaigns.findIndex((c) => c.id === id);
    if (index < 0) throw new ApiError("Campaign not found", 404);

    state.campaigns.splice(index, 1);
    return { id };
  });
}

// ---------------------------------------------------------------------------
// Commission
// ---------------------------------------------------------------------------

export function getCommission(): Promise<CommissionSettings> {
  return request(() => db().commission);
}

export function updateCommission(
  patch: Partial<Omit<CommissionSettings, "updatedAt">>,
): Promise<CommissionSettings> {
  return request(() => {
    const state = db();
    state.commission = {
      ...state.commission,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    return state.commission;
  });
}
