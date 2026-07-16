/**
 * The provider-facing API: a provider managing their own listing.
 *
 * **None of this is backed by the server today.** Each function states what is
 * missing rather than writing into a browser tab and reporting success.
 *
 * Where the gaps are:
 *
 *   • **Profile** — `PATCH /v1/providers/:id` exists, but a `Provider` on the
 *     wire is only `{id, provider_type, name, status}`. Bio, phone, address and
 *     price have no column to write to.
 *   • **Schedule & holidays** — `/v1/doctor-sessions` and `/v1/slots` hold the
 *     real availability, but neither returns a `branch_id`, so a provider's own
 *     sessions cannot be picked out to edit. There is no holidays resource.
 *   • **Services** — `POST /v1/services` accepts a `branch_id`, so a service can
 *     be *created*. It cannot be listed back: `GET /v1/services` returns no
 *     `branch_id`, so nothing can tell which of the 50 services are this
 *     provider's. An editor that cannot show what it just created is worse than
 *     no editor.
 *   • **Packages** — no resource at all.
 *
 * All of it previously ran against the seeded dataset. Restoring these screens
 * needs the read-side foreign keys described in BACKEND-GAPS.md.
 */

import { ApiError } from "@/lib/api/errors";
import type {
  ConsultationType,
  DaySchedule,
  Holiday,
  LabTest,
  Provider,
  RadiologyScan,
  ServicePackage,
} from "@/lib/types";

/** 501: the endpoint is missing or unusable — not the caller's mistake. */
function unsupported(what: string, why: string): never {
  throw new ApiError(
    `${what} is not available yet — ${why}`,
    501,
    "provider.notSupported",
  );
}

const NO_FK = "the API does not say which branch a service or session belongs to.";

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export type ProfilePatch = Partial<
  Pick<Provider, "name" | "bio" | "phone" | "address" | "price">
>;

export async function updateProviderProfile(
  _id: string,
  _patch: ProfilePatch,
): Promise<Provider> {
  void _id;
  void _patch;
  return unsupported(
    "Editing your listing",
    "the API stores only a provider's name and status.",
  );
}

// ---------------------------------------------------------------------------
// Schedule & holidays
// ---------------------------------------------------------------------------

export async function getSchedule(
  _providerId: string,
  _branchId?: string,
): Promise<DaySchedule[]> {
  void _providerId;
  void _branchId;
  return [];
}

export async function updateSchedule(
  _providerId: string,
  _schedule: DaySchedule[],
  _branchId?: string,
): Promise<DaySchedule[]> {
  void _providerId;
  void _schedule;
  void _branchId;
  return unsupported("Editing your schedule", NO_FK);
}

export async function getHolidays(_providerId: string): Promise<Holiday[]> {
  void _providerId;
  return [];
}

export async function addHoliday(
  _providerId: string,
  _date: string,
  _reason: string,
): Promise<Holiday> {
  void _providerId;
  void _date;
  void _reason;
  return unsupported("Adding a holiday", "there is no holidays endpoint.");
}

export async function removeHoliday(_id: string): Promise<{ id: string }> {
  void _id;
  return unsupported("Removing a holiday", "there is no holidays endpoint.");
}

// ---------------------------------------------------------------------------
// Services & packages
// ---------------------------------------------------------------------------

type NewConsultation = Omit<ConsultationType, "id" | "kind">;
type NewTest = Omit<LabTest, "id" | "kind">;
type NewScan = Omit<RadiologyScan, "id" | "kind">;

export type NewService = NewConsultation | NewTest | NewScan;

export async function getServices(_providerId: string): Promise<{
  services: (ConsultationType | LabTest | RadiologyScan)[];
  packages: ServicePackage[];
}> {
  void _providerId;
  return { services: [], packages: [] };
}

export async function createService(
  _providerId: string,
  _input: NewService,
): Promise<ConsultationType | LabTest | RadiologyScan> {
  void _providerId;
  void _input;
  return unsupported("Adding a service", NO_FK);
}

export async function updateService(
  _providerId: string,
  _serviceId: string,
  _patch: Partial<NewService>,
): Promise<ConsultationType | LabTest | RadiologyScan> {
  void _providerId;
  void _serviceId;
  void _patch;
  return unsupported("Editing a service", NO_FK);
}

export async function deleteService(
  _providerId: string,
  _serviceId: string,
): Promise<{ id: string }> {
  void _providerId;
  void _serviceId;
  return unsupported("Removing a service", NO_FK);
}

export async function createPackage(
  _providerId: string,
  _input: Omit<ServicePackage, "id">,
): Promise<ServicePackage> {
  void _providerId;
  void _input;
  return unsupported("Adding a package", "there is no packages endpoint.");
}

export async function updatePackage(
  _providerId: string,
  _packageId: string,
  _patch: Partial<ServicePackage>,
): Promise<ServicePackage> {
  void _providerId;
  void _packageId;
  void _patch;
  return unsupported("Editing a package", "there is no packages endpoint.");
}

export async function deletePackage(
  _providerId: string,
  _packageId: string,
): Promise<{ id: string }> {
  void _providerId;
  void _packageId;
  return unsupported("Removing a package", "there is no packages endpoint.");
}
