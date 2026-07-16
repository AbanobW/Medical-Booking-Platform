import { db, request } from "@/lib/api/client";
import { isUpcoming } from "@/lib/api/bookings";
import { GOVERNORATES, SPECIALTIES } from "@/lib/data/egypt";
import { now } from "@/lib/time";
import {
  isCancelled,
  type AdminStats,
  type Booking,
  type CategoryCount,
  type Doctor,
  type PatientStats,
  type Provider,
  type ProviderRole,
  type ProviderStats,
  type TimeSeriesPoint,
} from "@/lib/types";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Percentage change, guarding against divide-by-zero. */
function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return +(((current - previous) / previous) * 100).toFixed(1);
}

/**
 * Buckets bookings into the last `months` calendar months, ending with the
 * month containing `now()`.
 */
function monthlySeries(bookings: Booking[], months = 12): TimeSeriesPoint[] {
  const series: TimeSeriesPoint[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const cursor = new Date(
      Date.UTC(now().getUTCFullYear(), now().getUTCMonth() - i, 1),
    );
    const prefix = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`;
    const inMonth = bookings.filter((b) => b.date.startsWith(prefix));

    series.push({
      label: MONTHS[cursor.getUTCMonth()],
      bookings: inMonth.filter((b) => !isCancelled(b.status)).length,
      // Only completed visits count as realised revenue.
      revenue: inMonth
        .filter((b) => b.status === "completed")
        .reduce((sum, b) => sum + b.total, 0),
      cancellations: inMonth.filter((b) => isCancelled(b.status)).length,
    });
  }

  return series;
}

/** Splits a set of bookings into "this month" and "last month" halves. */
function splitByMonth(bookings: Booking[]) {
  const thisPrefix = `${now().getUTCFullYear()}-${String(now().getUTCMonth() + 1).padStart(2, "0")}`;
  const last = new Date(Date.UTC(now().getUTCFullYear(), now().getUTCMonth() - 1, 1));
  const lastPrefix = `${last.getUTCFullYear()}-${String(last.getUTCMonth() + 1).padStart(2, "0")}`;

  return {
    current: bookings.filter((b) => b.date.startsWith(thisPrefix)),
    previous: bookings.filter((b) => b.date.startsWith(lastPrefix)),
  };
}

const revenueOf = (bookings: Booking[]) =>
  bookings.filter((b) => b.status === "completed").reduce((s, b) => s + b.total, 0);

// ---------------------------------------------------------------------------
// Patient
// ---------------------------------------------------------------------------

export function getPatientStats(patientId: string): Promise<PatientStats> {
  return request(() => {
    const state = db();
    const mine = state.bookings.filter((b) => b.patientId === patientId);

    return {
      upcomingCount: mine.filter(isUpcoming).length,
      completedCount: mine.filter((b) => b.status === "completed").length,
      cancelledCount: mine.filter((b) => isCancelled(b.status)).length,
      totalSpent: mine
        .filter((b) => b.status === "completed")
        .reduce((sum, b) => sum + b.total, 0),
      cashbackEarned: mine
        .filter((b) => b.status === "completed")
        .reduce((sum, b) => sum + b.cashback, 0),
      favoriteCount: state.favorites.filter((f) => f.patientId === patientId).length,
      reviewCount: state.reviews.filter((r) => r.patientId === patientId).length,
    };
  });
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

/**
 * Utilization (§15) — how full a provider's sessions and slots actually run.
 *
 * Places taken divided by places offered, across the bookings in the window.
 */
function utilizationOf(providerId: string, bookings: Booking[]): number {
  const provider = db().providers.find((p) => p.id === providerId);
  if (!provider || bookings.length === 0) return 0;

  const live = bookings.filter((b) => !isCancelled(b.status));
  if (live.length === 0) return 0;

  // Capacity offered by each distinct session/slot the bookings landed on.
  const sessions = new Map<string, number>();

  for (const booking of live) {
    const branch = provider.branches.find((b) => b.id === booking.branchId);
    const weekday = new Date(`${booking.date}T00:00:00.000Z`).getUTCDay();
    const day = (branch ?? provider).schedule.find((d) => d.weekday === weekday);
    if (!day) continue;

    sessions.set(`${booking.branchId}|${booking.date}|${booking.time}`, day.capacity);
  }

  const offered = [...sessions.values()].reduce((sum, c) => sum + c, 0);
  if (offered === 0) return 0;

  return Math.min(100, Math.round((live.length / offered) * 100));
}

export function getProviderStats(providerId: string): Promise<ProviderStats> {
  return request(() => {
    const state = db();
    const mine = state.bookings.filter((b) => b.providerId === providerId);
    const { current, previous } = splitByMonth(mine);

    const uniquePatients = (list: Booking[]) =>
      new Set(list.map((b) => b.patientId)).size;

    const reviews = state.reviews.filter((r) => r.providerId === providerId);
    const averageRating = reviews.length
      ? +(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
      : 0;

    // Average wait, taken from the waiting-time sub-score patients actually
    // give — 5 stars means a short wait, 1 star means a long one.
    const provider = state.providers.find((p) => p.id === providerId);
    const waitScores = reviews.map((r) => r.breakdown.waitingTime);
    const averageWaitMinutes = waitScores.length
      ? Math.round(
          (waitScores.reduce((s, w) => s + (6 - w), 0) / waitScores.length) *
            ((provider?.waitingTimeMinutes ?? 20) / 3),
        )
      : (provider?.waitingTimeMinutes ?? 0);

    const live = mine.filter((b) => !isCancelled(b.status)).length;
    const cancellations = mine.filter((b) => isCancelled(b.status)).length;
    const noShows = mine.filter((b) => b.status === "no_show").length;

    return {
      totalBookings: live,
      bookingsChange: pctChange(current.length, previous.length),
      revenue: revenueOf(mine),
      revenueChange: pctChange(revenueOf(current), revenueOf(previous)),
      newPatients: uniquePatients(current),
      newPatientsChange: pctChange(uniquePatients(current), uniquePatients(previous)),
      cancellations,
      cancellationsChange: pctChange(
        current.filter((b) => isCancelled(b.status)).length,
        previous.filter((b) => isCancelled(b.status)).length,
      ),
      averageRating,
      monthly: monthlySeries(mine),

      utilizationRate: utilizationOf(providerId, mine),
      utilizationChange: pctChange(
        utilizationOf(providerId, current),
        utilizationOf(providerId, previous),
      ),
      averageWaitMinutes,
      cancellationRate: mine.length
        ? Math.round((cancellations / mine.length) * 100)
        : 0,
      noShowRate: mine.length ? Math.round((noShows / mine.length) * 100) : 0,
    };
  });
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export function getAdminStats(): Promise<AdminStats> {
  return request(() => {
    const state = db();
    const bookings = state.bookings;
    const { current, previous } = splitByMonth(bookings);

    const providerById = new Map(state.providers.map((p) => [p.id, p]));

    const bySpecialty = new Map<string, number>();
    const byGovernorate = new Map<string, number>();

    for (const booking of bookings) {
      if (isCancelled(booking.status)) continue;

      const provider = providerById.get(booking.providerId);
      if (!provider) continue;

      if (provider.type === "doctor") {
        const id = (provider as Doctor).specialtyId;
        bySpecialty.set(id, (bySpecialty.get(id) ?? 0) + 1);
      }
      byGovernorate.set(
        provider.governorateId,
        (byGovernorate.get(provider.governorateId) ?? 0) + 1,
      );
    }

    const topSpecialties: CategoryCount[] = Array.from(bySpecialty, ([id, value]) => ({
      name: SPECIALTIES.find((s) => s.id === id)?.name ?? id,
      value,
    }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    const topGovernorates: CategoryCount[] = Array.from(byGovernorate, ([id, value]) => ({
      name: GOVERNORATES.find((g) => g.id === id)?.name ?? id,
      value,
    }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    // Users created this month vs last, so the deltas aren't fabricated.
    const newUsers = (prefix: string) =>
      state.users.filter((u) => u.createdAt.startsWith(prefix)).length;
    const thisPrefix = `${now().getUTCFullYear()}-${String(now().getUTCMonth() + 1).padStart(2, "0")}`;
    const lastDate = new Date(Date.UTC(now().getUTCFullYear(), now().getUTCMonth() - 1, 1));
    const lastPrefix = `${lastDate.getUTCFullYear()}-${String(lastDate.getUTCMonth() + 1).padStart(2, "0")}`;

    const newProviders = (prefix: string) =>
      state.providers.filter((p) => p.joinedAt.startsWith(prefix)).length;

    /**
     * Conversion (§15) — the share of profile views that become bookings.
     *
     * There is no view-tracking table in the frontend dataset, so views are
     * modelled from the provider's booking volume rather than measured. The
     * shape is right; the real number will come from the events the backend
     * captures.
     */
    const conversionOf = (list: Booking[]) => {
      if (list.length === 0) return 0;
      const views = state.providers.reduce(
        (sum, p) => sum + Math.max(1, Math.round(p.bookingCount * 6.5)),
        0,
      );
      return views ? +((list.length / views) * 100).toFixed(1) : 0;
    };

    const cancelRateOf = (list: Booking[]) =>
      list.length
        ? Math.round(
            (list.filter((b) => isCancelled(b.status)).length / list.length) * 100,
          )
        : 0;

    return {
      totalUsers: state.users.filter((u) => u.role === "patient").length,
      usersChange: pctChange(newUsers(thisPrefix), newUsers(lastPrefix)),
      totalProviders: state.providers.length,
      providersChange: pctChange(newProviders(thisPrefix), newProviders(lastPrefix)),
      totalBookings: bookings.filter((b) => !isCancelled(b.status)).length,
      bookingsChange: pctChange(current.length, previous.length),
      totalRevenue: revenueOf(bookings),
      revenueChange: pctChange(revenueOf(current), revenueOf(previous)),
      bookingTrends: monthlySeries(bookings),
      topSpecialties,
      topGovernorates,

      conversionRate: conversionOf(bookings),
      conversionChange: pctChange(conversionOf(current), conversionOf(previous)),
      cancellationRate: cancelRateOf(bookings),
      cancellationRateChange: pctChange(
        cancelRateOf(current),
        cancelRateOf(previous),
      ),
      noShowRate: bookings.length
        ? Math.round(
            (bookings.filter((b) => b.status === "no_show").length /
              bookings.length) *
              100,
          )
        : 0,
    };
  });
}

// ---------------------------------------------------------------------------
// Admin analytics pages
// ---------------------------------------------------------------------------

export interface RankedProvider {
  provider: Provider;
  bookings: number;
  revenue: number;
  cancellationRate: number;
}

/** Leaderboard of providers by booking volume, for a given type. */
export function getTopProviders(
  type: ProviderRole,
  limit = 10,
): Promise<RankedProvider[]> {
  return request(() => {
    const state = db();

    return state.providers
      .filter((p) => p.type === type)
      .map((provider) => {
        const mine = state.bookings.filter((b) => b.providerId === provider.id);
        const cancelled = mine.filter((b) => isCancelled(b.status)).length;

        return {
          provider,
          bookings: mine.filter((b) => !isCancelled(b.status)).length,
          revenue: revenueOf(mine),
          cancellationRate: mine.length
            ? +((cancelled / mine.length) * 100).toFixed(1)
            : 0,
        };
      })
      .sort((a, b) => b.bookings - a.bookings)
      .slice(0, limit);
  });
}

export interface CancellationAnalytics {
  totalCancellations: number;
  cancellationRate: number;
  byReason: CategoryCount[];
  byType: CategoryCount[];
  monthly: TimeSeriesPoint[];
}

export function getCancellationAnalytics(): Promise<CancellationAnalytics> {
  return request(() => {
    const bookings = db().bookings;
    const cancelled = bookings.filter((b) => isCancelled(b.status));

    const tally = (key: (b: Booking) => string): CategoryCount[] => {
      const counts = new Map<string, number>();
      for (const b of cancelled) {
        const k = key(b);
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
      return Array.from(counts, ([name, value]) => ({ name, value })).sort(
        (a, b) => b.value - a.value,
      );
    };

    const TYPE_LABELS: Record<ProviderRole, string> = {
      doctor: "Doctors",
      lab: "Labs",
      radiology: "Radiology",
    };

    return {
      totalCancellations: cancelled.length,
      cancellationRate: bookings.length
        ? +((cancelled.length / bookings.length) * 100).toFixed(1)
        : 0,
      byReason: tally((b) => b.cancellationReason ?? "Not specified"),
      byType: tally((b) => TYPE_LABELS[b.providerType]),
      monthly: monthlySeries(bookings),
    };
  });
}

export interface RevenueAnalytics {
  totalRevenue: number;
  platformCommission: number;
  netToProviders: number;
  averageBookingValue: number;
  monthly: TimeSeriesPoint[];
  byType: CategoryCount[];
  byPaymentMethod: CategoryCount[];
}

export function getRevenueAnalytics(): Promise<RevenueAnalytics> {
  return request(() => {
    const state = db();
    const completed = state.bookings.filter((b) => b.status === "completed");
    const commission = state.commission;

    const totalRevenue = completed.reduce((s, b) => s + b.total, 0);

    // Commission is charged per provider type, at that type's rate.
    const platformCommission = Math.round(
      completed.reduce(
        (sum, b) => sum + (b.total * commission[b.providerType]) / 100,
        0,
      ),
    );

    const tally = (key: (b: (typeof completed)[number]) => string, value: (b: (typeof completed)[number]) => number): CategoryCount[] => {
      const counts = new Map<string, number>();
      for (const b of completed) {
        const k = key(b);
        counts.set(k, (counts.get(k) ?? 0) + value(b));
      }
      return Array.from(counts, ([name, v]) => ({ name, value: Math.round(v) })).sort(
        (a, b) => b.value - a.value,
      );
    };

    const TYPE_LABELS: Record<ProviderRole, string> = {
      doctor: "Doctors",
      lab: "Labs",
      radiology: "Radiology",
    };
    const PAY_LABELS: Record<string, string> = {
      cash: "Cash",
      card: "Card",
      vodafone_cash: "Vodafone Cash",
      instapay: "InstaPay",
    };

    return {
      totalRevenue,
      platformCommission,
      netToProviders: totalRevenue - platformCommission,
      averageBookingValue: completed.length
        ? Math.round(totalRevenue / completed.length)
        : 0,
      monthly: monthlySeries(state.bookings),
      byType: tally((b) => TYPE_LABELS[b.providerType], (b) => b.total),
      byPaymentMethod: tally((b) => PAY_LABELS[b.paymentMethod] ?? b.paymentMethod, (b) => b.total),
    };
  });
}
