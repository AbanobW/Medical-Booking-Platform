import { ApiError, db, makeId, request } from "@/lib/api/client";
import type {
  Branch,
  ConsultationType,
  DaySchedule,
  Holiday,
  Lab,
  LabTest,
  Provider,
  RadiologyCenter,
  RadiologyScan,
  ServicePackage,
} from "@/lib/types";

/** The provider-facing API: a provider managing their own listing. */

function mustFind(id: string): Provider {
  const provider = db().providers.find((p) => p.id === id);
  if (!provider) throw new ApiError("Provider not found", 404);
  return provider;
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export type ProfilePatch = Partial<
  Pick<Provider, "name" | "bio" | "phone" | "address" | "price">
>;

export function updateProviderProfile(
  id: string,
  patch: ProfilePatch,
): Promise<Provider> {
  return request(() => {
    const provider = mustFind(id);
    Object.assign(provider, patch);
    return provider;
  });
}

// ---------------------------------------------------------------------------
// Schedule & working hours
// ---------------------------------------------------------------------------

/**
 * Availability is resolved per branch (§2, §5), so the schedule editor works on
 * a branch. Omitting `branchId` falls back to the provider-level template that
 * new branches start from.
 */
function branchOrThrow(provider: Provider, branchId: string): Branch {
  const branch = provider.branches.find((b) => b.id === branchId);
  if (!branch) throw new ApiError("Branch not found", 404);
  return branch;
}

export function getSchedule(
  id: string,
  branchId?: string,
): Promise<DaySchedule[]> {
  return request(() => {
    const provider = mustFind(id);
    if (!branchId) return provider.schedule;
    return branchOrThrow(provider, branchId).schedule;
  });
}

export function updateSchedule(
  id: string,
  schedule: DaySchedule[],
  branchId?: string,
): Promise<DaySchedule[]> {
  return request(() => {
    const provider = mustFind(id);

    for (const day of schedule) {
      if (!day.isWorkingDay) continue;

      if (day.startTime >= day.endTime) {
        throw new ApiError(
          `${day.startTime}–${day.endTime} is not a valid working window.`,
          400,
        );
      }
      // Capacity is the single source of truth for how many places exist
      // (Appendix A) — a working day without one has nothing to sell.
      if (!Number.isInteger(day.capacity) || day.capacity < 1) {
        throw new ApiError(
          "A working day needs a capacity of at least one place.",
          400,
        );
      }
    }

    if (!branchId) {
      provider.schedule = schedule;
      return provider.schedule;
    }

    const branch = branchOrThrow(provider, branchId);
    branch.schedule = schedule;
    return branch.schedule;
  });
}

export function getHolidays(providerId: string): Promise<Holiday[]> {
  return request(() =>
    db()
      .holidays.filter((h) => h.providerId === providerId)
      .sort((a, b) => a.date.localeCompare(b.date)),
  );
}

export function addHoliday(
  providerId: string,
  date: string,
  reason: string,
): Promise<Holiday> {
  return request(() => {
    const state = db();
    mustFind(providerId);

    const clash = state.holidays.some(
      (h) => h.providerId === providerId && h.date === date,
    );
    if (clash) throw new ApiError("That date is already marked as a holiday.", 409);

    const holiday: Holiday = { id: makeId("hol"), providerId, date, reason };
    state.holidays.push(holiday);
    return holiday;
  });
}

export function removeHoliday(id: string): Promise<{ id: string }> {
  return request(() => {
    const state = db();
    const index = state.holidays.findIndex((h) => h.id === id);
    if (index < 0) throw new ApiError("Holiday not found", 404);

    state.holidays.splice(index, 1);
    return { id };
  });
}

// ---------------------------------------------------------------------------
// Services CRUD
// ---------------------------------------------------------------------------

/** The editable service list for a provider, whatever their type. */
export function getServices(providerId: string): Promise<{
  services: (ConsultationType | LabTest | RadiologyScan)[];
  packages: ServicePackage[];
}> {
  return request(() => {
    const provider = mustFind(providerId);

    if (provider.type === "doctor") {
      return { services: provider.consultationTypes, packages: [] };
    }
    return provider.type === "lab"
      ? { services: provider.tests, packages: provider.packages }
      : { services: provider.scans, packages: provider.packages };
  });
}

type NewConsultation = Omit<ConsultationType, "id" | "kind">;
type NewTest = Omit<LabTest, "id" | "kind">;
type NewScan = Omit<RadiologyScan, "id" | "kind">;

export type NewService = NewConsultation | NewTest | NewScan;

export function createService(
  providerId: string,
  input: NewService,
): Promise<ConsultationType | LabTest | RadiologyScan> {
  return request(() => {
    const provider = mustFind(providerId);

    if (provider.type === "doctor") {
      const service: ConsultationType = {
        ...(input as NewConsultation),
        id: makeId(`${providerId}-cons`),
        kind: "consultation",
      };
      provider.consultationTypes.push(service);
      return service;
    }

    if (provider.type === "lab") {
      const service: LabTest = {
        ...(input as NewTest),
        id: makeId(`${providerId}-test`),
        kind: "test",
      };
      provider.tests.push(service);
      syncEntryPrice(provider);
      return service;
    }

    const service: RadiologyScan = {
      ...(input as NewScan),
      id: makeId(`${providerId}-scan`),
      kind: "scan",
    };
    provider.scans.push(service);
    syncEntryPrice(provider);
    return service;
  });
}

export function updateService(
  providerId: string,
  serviceId: string,
  patch: Partial<NewService>,
): Promise<ConsultationType | LabTest | RadiologyScan> {
  return request(() => {
    const provider = mustFind(providerId);
    const list = editableList(provider);

    const service = list.find((s) => s.id === serviceId);
    if (!service) throw new ApiError("Service not found", 404);

    Object.assign(service, patch);
    syncEntryPrice(provider);
    return service;
  });
}

export function deleteService(
  providerId: string,
  serviceId: string,
): Promise<{ id: string }> {
  return request(() => {
    const provider = mustFind(providerId);
    const list = editableList(provider);

    const index = list.findIndex((s) => s.id === serviceId);
    if (index < 0) throw new ApiError("Service not found", 404);

    if (list.length === 1) {
      throw new ApiError("You must offer at least one service.", 409);
    }

    list.splice(index, 1);

    // Drop the service from any package that referenced it.
    if (provider.type !== "doctor") {
      for (const pkg of provider.packages) {
        pkg.includes = pkg.includes.filter((id) => id !== serviceId);
      }
    }

    syncEntryPrice(provider);
    return { id: serviceId };
  });
}

function editableList(
  provider: Provider,
): (ConsultationType | LabTest | RadiologyScan)[] {
  if (provider.type === "doctor") return provider.consultationTypes;
  return provider.type === "lab" ? provider.tests : provider.scans;
}

/**
 * The card price shown in search is the entry price: a doctor's in-clinic fee,
 * or the cheapest active test/scan. Recompute it whenever services change.
 */
function syncEntryPrice(provider: Provider): void {
  if (provider.type === "doctor") {
    const primary = provider.consultationTypes.find((c) => c.isActive);
    if (primary) provider.price = primary.price;
    return;
  }

  const active = editableList(provider).filter((s) => s.isActive);
  if (active.length > 0) {
    provider.price = Math.min(...active.map((s) => s.price));
  }
}

// ---------------------------------------------------------------------------
// Packages (labs & radiology only)
// ---------------------------------------------------------------------------

export type NewPackage = Omit<ServicePackage, "id" | "kind">;

function withPackages(providerId: string): Lab | RadiologyCenter {
  const provider = mustFind(providerId);
  if (provider.type === "doctor") {
    throw new ApiError("Doctors do not offer packages.", 400);
  }
  return provider;
}

export function createPackage(
  providerId: string,
  input: NewPackage,
): Promise<ServicePackage> {
  return request(() => {
    const provider = withPackages(providerId);

    const pkg: ServicePackage = {
      ...input,
      id: makeId(`${providerId}-pkg`),
      kind: "package",
    };
    provider.packages.push(pkg);
    return pkg;
  });
}

export function updatePackage(
  providerId: string,
  packageId: string,
  patch: Partial<NewPackage>,
): Promise<ServicePackage> {
  return request(() => {
    const provider = withPackages(providerId);

    const pkg = provider.packages.find((p) => p.id === packageId);
    if (!pkg) throw new ApiError("Package not found", 404);

    Object.assign(pkg, patch);
    return pkg;
  });
}

export function deletePackage(
  providerId: string,
  packageId: string,
): Promise<{ id: string }> {
  return request(() => {
    const provider = withPackages(providerId);

    const index = provider.packages.findIndex((p) => p.id === packageId);
    if (index < 0) throw new ApiError("Package not found", 404);

    provider.packages.splice(index, 1);
    return { id: packageId };
  });
}
