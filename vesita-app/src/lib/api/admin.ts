/**
 * The admin API.
 *
 * Mixed, and explicit about which half is which:
 *
 *   • **Coupons** are real — `/v1/coupons` lists and deletes.
 *   • **Users** and **providers** are real but admin-gated. A non-admin token
 *     gets a 403, which is the right answer and is passed through rather than
 *     swallowed into an empty list.
 *   • **Campaigns**, **commission** and **suspension** have no endpoint at all.
 *
 * Everything used to run on the seeded dataset — 60 users, 100 providers, 8
 * coupons, 4 campaigns — mutated in the browser and persisted to localStorage.
 * An admin "suspending" a provider changed nothing but their own tab.
 */

import { ApiError } from "@/lib/api/errors";
import { apiList } from "@/lib/api/http";
import * as live from "@/lib/api/medpoint/admin";
import { toProvider, toUser } from "@/lib/api/medpoint/mappers";
import type { WireProvider, WireUser } from "@/lib/api/medpoint/types";
import type {
  CashbackCampaign,
  CommissionSettings,
  Coupon,
  Paginated,
  Provider,
  ProviderRole,
  ProviderStatus,
  Role,
  SuspensionType,
  User,
  UserStatus,
} from "@/lib/types";

function unsupported(what: string, why: string): ApiError {
  return new ApiError(`${what} is not available yet — ${why}`, 501, "admin.notSupported");
}

function paginateAll<T>(items: T[], page = 1, pageSize = 12): Paginated<T> {
  const start = (page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    total: items.length,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(items.length / pageSize)),
  };
}

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

/**
 * `GET /v1/users` takes no filters, so the query is applied client-side over
 * whatever the page returns — the same degraded pattern as provider discovery.
 */
export async function getUsers(query: UserQuery = {}): Promise<Paginated<User>> {
  const { items } = await apiList<WireUser>("/users");
  let users = items.map(toUser);

  if (query.q) {
    const q = query.q.toLowerCase();
    users = users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.phone ?? "").includes(q),
    );
  }
  if (query.status) users = users.filter((u) => u.status === query.status);

  return paginateAll(users, query.page, query.pageSize);
}

export async function setUserStatus(_id: string, _status: UserStatus): Promise<User> {
  void _id;
  void _status;
  throw unsupported(
    "Suspending a user",
    "the API has no status field on a user it will accept.",
  );
}

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

export interface ProviderQuery {
  q?: string;
  type?: ProviderRole;
  status?: ProviderStatus;
  page?: number;
  pageSize?: number;
}

export async function getAdminProviders(
  query: ProviderQuery = {},
): Promise<Paginated<Provider>> {
  const { items } = await apiList<WireProvider>("/providers");
  let providers = items.map((wire) => toProvider({ wire }));

  if (query.q) {
    const q = query.q.toLowerCase();
    providers = providers.filter((p) => p.name.toLowerCase().includes(q));
  }
  if (query.type) providers = providers.filter((p) => p.type === query.type);
  if (query.status) providers = providers.filter((p) => p.status === query.status);

  return paginateAll(providers, query.page, query.pageSize);
}

export async function setProviderStatus(
  _id: string,
  _status: ProviderStatus,
): Promise<Provider> {
  void _id;
  void _status;
  throw unsupported("Changing a provider's status", "there is no endpoint for it.");
}

export async function suspendProvider(
  _id: string,
  _type: SuspensionType,
  _reason: string,
): Promise<Provider> {
  void _id;
  void _type;
  void _reason;
  throw unsupported(
    "Suspending a provider",
    "a hard suspension must cancel and refund every upcoming booking (§13), and the API can neither list nor refund them.",
  );
}

export async function reinstateProvider(_id: string): Promise<Provider> {
  void _id;
  throw unsupported("Reinstating a provider", "there is no endpoint for it.");
}

// ---------------------------------------------------------------------------
// Coupons — real
// ---------------------------------------------------------------------------

export async function getCoupons(): Promise<Coupon[]> {
  return live.getCoupons();
}

export type CouponInput = Omit<Coupon, "id" | "usageCount" | "createdAt">;

export async function createCoupon(_input: CouponInput): Promise<Coupon> {
  void _input;
  throw unsupported(
    "Creating a coupon",
    "the API's coupon has no description, minimum-order or applies-to column to write.",
  );
}

export async function updateCoupon(
  _id: string,
  _patch: Partial<CouponInput>,
): Promise<Coupon> {
  void _id;
  void _patch;
  throw unsupported("Editing a coupon", "the fields this form edits do not exist on the API.");
}

export async function deleteCoupon(id: string): Promise<{ id: string }> {
  return live.deleteCoupon(id);
}

// ---------------------------------------------------------------------------
// Campaigns & commission — no endpoint
// ---------------------------------------------------------------------------

export async function getCampaigns(): Promise<CashbackCampaign[]> {
  return [];
}

export type CampaignInput = Omit<
  CashbackCampaign,
  "id" | "status" | "totalIssued" | "redeemedCount"
>;

export async function createCampaign(_input: CampaignInput): Promise<CashbackCampaign> {
  void _input;
  throw unsupported("Creating a campaign", "there is no campaigns endpoint.");
}

export async function updateCampaign(
  _id: string,
  _patch: Partial<CampaignInput>,
): Promise<CashbackCampaign> {
  void _id;
  void _patch;
  throw unsupported("Editing a campaign", "there is no campaigns endpoint.");
}

export async function deleteCampaign(_id: string): Promise<{ id: string }> {
  void _id;
  throw unsupported("Deleting a campaign", "there is no campaigns endpoint.");
}

export async function getCommission(): Promise<CommissionSettings | null> {
  return null;
}

export async function updateCommission(
  _patch: Partial<CommissionSettings>,
): Promise<CommissionSettings> {
  void _patch;
  throw unsupported("Editing commission", "there is no commission endpoint.");
}
