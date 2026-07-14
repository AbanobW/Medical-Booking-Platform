/**
 * Availability from MedPoint slots and doctor-sessions — client-side filtering.
 */

import { ApiError } from "@/lib/api/client";
import { apiList } from "@/lib/api/http";
import { sessionToTimeSlot, slotToTimeSlot } from "@/lib/api/medpoint/mappers";
import type {
  WireDoctorSession,
  WireSlot,
} from "@/lib/api/medpoint/types";
import { addDays, TODAY, toISODate } from "@/lib/data/seed";
import type { Provider, TimeSlot } from "@/lib/types";
import { getProviderById } from "@/lib/api/medpoint/providers";

const PAGE_SIZE = 100;

async function fetchAllPages<T>(path: string): Promise<T[]> {
  const items: T[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const { items: batch, pagination } = await apiList<T>(path, {
      query: { page, limit: PAGE_SIZE },
    });
    items.push(...batch);
    totalPages = pagination?.total_pages ?? 1;
    page += 1;
    if (batch.length === 0) break;
  }

  return items;
}

function branchIdsFor(provider: Provider, branchId?: string): Set<string> {
  if (branchId) return new Set([branchId]);
  return new Set(provider.branches.map((b) => b.id));
}

export async function getAvailability(
  providerId: string,
  days = 30,
  branchId?: string,
): Promise<Record<string, TimeSlot[]>> {
  const provider = await getProviderById(providerId);
  const branches = await branchIdsFor(provider, branchId);
  if (branches.size === 0) {
    throw new ApiError("Branch not found", 404, "branch.notFound");
  }

  const [slots, sessions] = await Promise.all([
    fetchAllPages<WireSlot>("/slots"),
    fetchAllPages<WireDoctorSession>("/doctor-sessions"),
  ]);

  const start = toISODate(TODAY);
  const end = toISODate(addDays(TODAY, days - 1));

  const byDate: Record<string, TimeSlot[]> = {};
  for (let i = 0; i < days; i++) {
    byDate[toISODate(addDays(TODAY, i))] = [];
  }

  for (const wire of slots) {
    if (!wire.branch_id || !branches.has(wire.branch_id)) continue;
    const slot = slotToTimeSlot(wire);
    if (!slot || slot.date < start || slot.date > end) continue;
    byDate[slot.date]?.push(slot);
  }

  for (const wire of sessions) {
    if (!wire.branch_id || !branches.has(wire.branch_id)) continue;
    if (wire.provider_id && wire.provider_id !== providerId) continue;
    const slot = sessionToTimeSlot(wire);
    if (!slot || slot.date < start || slot.date > end) continue;
    byDate[slot.date]?.push(slot);
  }

  for (const date of Object.keys(byDate)) {
    byDate[date].sort((a, b) => a.time.localeCompare(b.time));
  }

  return byDate;
}

export async function getSlotsForDate(
  providerId: string,
  date: string,
  branchId?: string,
): Promise<TimeSlot[]> {
  const all = await getAvailability(providerId, 30, branchId);
  return all[date] ?? [];
}

export async function getNextSlots(
  providerId: string,
  limit = 4,
): Promise<TimeSlot[]> {
  const all = await getAvailability(providerId, 14);
  const out: TimeSlot[] = [];

  const dates = Object.keys(all).sort();
  for (const date of dates) {
    for (const slot of all[date]) {
      if (slot.isAvailable) out.push(slot);
    }
    if (out.length >= limit) break;
  }

  return out
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
    .slice(0, limit);
}
