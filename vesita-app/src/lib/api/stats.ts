/**
 * Dashboard statistics (§15).
 *
 * **Nothing here is computable today, and nothing here is invented.**
 *
 * Every figure on a dashboard — bookings, revenue, utilisation, no-show rate,
 * top specialties — is an aggregate over bookings. MedPoint has no analytics
 * endpoint, and `GET /v1/bookings` returns rows with no provider, no service and
 * no appointment datetime, so there is nothing to aggregate even client-side.
 *
 * These functions used to fold over the seeded dataset and produce confident,
 * entirely fictional numbers: revenue that was never billed, a conversion rate
 * measured against views nobody made. They now return `null` for every metric
 * and an empty series for every chart. The dashboards render each null as a dash
 * and each chart as an empty state, so the gap is visible instead of decorated.
 *
 * Wiring this up needs either an analytics endpoint or a bookings payload with
 * real foreign keys and datetimes — see BACKEND-GAPS.md.
 */

import type {
  AdminStats,
  PatientStats,
  Provider,
  ProviderRole,
  ProviderStats,
} from "@/lib/types";

export interface RankedProvider {
  provider: Provider;
  bookings: number | null;
  revenue: number | null;
  cancellationRate: number | null;
}

export async function getPatientStats(_patientId: string): Promise<PatientStats> {
  void _patientId;
  return {
    upcomingCount: null,
    completedCount: null,
    cancelledCount: null,
    totalSpent: null,
    cashbackEarned: null,
    favoriteCount: null,
    reviewCount: null,
  };
}

export async function getProviderStats(_providerId: string): Promise<ProviderStats> {
  void _providerId;
  return {
    totalBookings: null,
    bookingsChange: null,
    revenue: null,
    revenueChange: null,
    newPatients: null,
    newPatientsChange: null,
    cancellations: null,
    cancellationsChange: null,
    averageRating: null,
    monthly: [],
    utilizationRate: null,
    utilizationChange: null,
    averageWaitMinutes: null,
    cancellationRate: null,
    noShowRate: null,
  };
}

export async function getAdminStats(): Promise<AdminStats> {
  return {
    totalUsers: null,
    usersChange: null,
    totalProviders: null,
    providersChange: null,
    totalBookings: null,
    bookingsChange: null,
    totalRevenue: null,
    revenueChange: null,
    bookingTrends: [],
    topSpecialties: [],
    topGovernorates: [],
    conversionRate: null,
    conversionChange: null,
    cancellationRate: null,
    cancellationRateChange: null,
    noShowRate: null,
  };
}

/** Ranking needs booking volume and ratings. The API serves neither. */
export async function getTopProviders(
  _type: ProviderRole,
  _limit = 5,
): Promise<RankedProvider[]> {
  void _type;
  void _limit;
  return [];
}

export interface CancellationAnalytics {
  byReason: { label: string; count: number }[];
  byRole: { label: string; count: number }[];
  refundedTotal: number | null;
}

export async function getCancellationAnalytics(): Promise<CancellationAnalytics> {
  return { byReason: [], byRole: [], refundedTotal: null };
}

export interface RevenueAnalytics {
  monthly: { label: string; commission: number; net: number }[];
  commissionTotal: number | null;
  netTotal: number | null;
  grossTotal: number | null;
}

export async function getRevenueAnalytics(): Promise<RevenueAnalytics> {
  return { monthly: [], commissionTotal: null, netTotal: null, grossTotal: null };
}
