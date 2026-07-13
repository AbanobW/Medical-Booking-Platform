"use client";

import { Check, Clock, MapPin, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { getAreaName, getGovernorateName } from "@/lib/data/egypt";
import { formatDuration } from "@/lib/format";
import { formatEGP } from "@/lib/site";
import {
  branchPriceOf,
  requiresAcknowledgement,
  type Branch,
  type Provider,
  type Service,
} from "@/lib/types";
import { cn } from "@/lib/utils";

interface ServiceGroup {
  title: string;
  services: Service[];
}

/** Every service the provider offers, whatever their type. */
export function allServicesOf(provider: Provider): Service[] {
  if (provider.type === "doctor") return provider.consultationTypes;
  return provider.type === "lab"
    ? [...provider.tests, ...provider.packages]
    : [...provider.scans, ...provider.packages];
}

/**
 * Splits the services a *branch* offers into the groups the user sees (§2).
 *
 * Branches operate independently: a service offered at one branch may not exist
 * at another, so the catalogue is always filtered by the chosen branch.
 */
export function serviceGroupsFor(
  provider: Provider,
  branch: Branch | undefined,
): ServiceGroup[] {
  const offered = (service: Service) =>
    service.isActive && (!branch || branch.serviceIds.includes(service.id));

  if (provider.type === "doctor") {
    return [
      {
        title: "Consultation types",
        services: provider.consultationTypes.filter(offered),
      },
    ];
  }

  const items =
    provider.type === "lab"
      ? { title: "Tests", services: provider.tests.filter(offered) }
      : { title: "Scans", services: provider.scans.filter(offered) };

  const packages = provider.packages.filter(offered);

  return [
    ...(packages.length > 0
      ? [{ title: "Packages", services: packages as Service[] }]
      : []),
    items,
  ];
}

function serviceMeta(service: Service): string[] {
  switch (service.kind) {
    case "consultation":
      return [formatDuration(service.durationMinutes)];
    case "test":
      return [
        `Results in ${formatDuration(service.resultTimeHours * 60)}`,
        ...(service.fastingRequired ? ["Fasting required"] : []),
      ];
    case "scan":
      return [
        formatDuration(service.durationMinutes),
        ...(service.contrastRequired ? ["Contrast required"] : []),
      ];
    case "package":
      return [`${service.includes.length} items included`];
  }
}

function ServiceCard({
  service,
  price,
  isSelected,
  onSelect,
}: {
  service: Service;
  price: number;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const pkg = service.kind === "package" ? service : undefined;
  const saving = pkg ? pkg.originalPrice - pkg.price : 0;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isSelected}
      className={cn(
        "flex w-full flex-col gap-2 rounded-2xl border p-4 text-left transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        isSelected
          ? "border-primary bg-primary/5 shadow-glow"
          : "border-border bg-card hover:border-primary/50 hover:shadow-soft",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 font-semibold">
            <span className="truncate">{service.name}</span>
            {isSelected && (
              <Check className="size-4 shrink-0 text-primary" aria-hidden />
            )}
          </p>
          {service.description && (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
              {service.description}
            </p>
          )}
        </div>

        <div className="shrink-0 text-right">
          <p className="font-bold text-primary">{formatEGP(price)}</p>
          {pkg && saving > 0 && (
            <p className="text-xs text-muted-foreground line-through">
              {formatEGP(pkg.originalPrice)}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {serviceMeta(service).map((meta) => (
          <Badge key={meta} variant="secondary" className="text-[0.7rem] font-normal">
            {meta}
          </Badge>
        ))}
        {requiresAcknowledgement(service) && (
          <Badge variant="outline" className="text-[0.7rem] font-normal">
            Preparation needed
          </Badge>
        )}
        {saving > 0 && (
          <Badge className="text-[0.7rem]">Save {formatEGP(saving)}</Badge>
        )}
      </div>
    </button>
  );
}

/**
 * Step 2 — branch first, then the services that branch actually offers.
 *
 * Pricing is per branch (§2), so the price shown here is the price of this
 * service *at this branch*.
 */
export function ServicePicker({
  provider,
  branchId,
  onSelectBranch,
  serviceId,
  onSelectService,
}: {
  provider: Provider;
  branchId?: string;
  onSelectBranch: (id: string) => void;
  serviceId?: string;
  onSelectService: (id: string) => void;
}) {
  const [query, setQuery] = useState("");

  const branches = provider.branches.filter((b) => b.isActive);
  const branch = branches.find((b) => b.id === branchId);

  const groups = useMemo(
    () => serviceGroupsFor(provider, branch),
    [provider, branch],
  );

  const totalServices = groups.reduce((n, g) => n + g.services.length, 0);
  const isSearchable = totalServices > 8;

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return groups;

    return groups
      .map((group) => ({
        ...group,
        services: group.services.filter((s) =>
          `${s.name} ${s.description}`.toLowerCase().includes(term),
        ),
      }))
      .filter((group) => group.services.length > 0);
  }, [groups, query]);

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Choose a branch</h2>
          <p className="text-sm text-muted-foreground">
            Each branch keeps its own schedule, services and prices — pick where
            you&apos;d like to be seen first.
          </p>
        </div>

        {branches.length === 0 ? (
          <p className="rounded-2xl border border-dashed bg-card/50 px-6 py-8 text-center text-sm text-muted-foreground">
            This provider has no active branch taking bookings right now.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {branches.map((item) => {
              const isSelected = item.id === branchId;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectBranch(item.id)}
                  aria-pressed={isSelected}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    isSelected
                      ? "border-primary bg-primary/5 shadow-glow"
                      : "border-border bg-card hover:border-primary/50 hover:shadow-soft",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl",
                      isSelected
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    <MapPin className="size-4" />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 font-medium">
                      <span className="truncate">{item.name}</span>
                      {isSelected && (
                        <Check className="size-4 shrink-0 text-primary" aria-hidden />
                      )}
                    </span>
                    <span className="mt-0.5 block text-sm text-muted-foreground">
                      {getAreaName(item.areaId)},{" "}
                      {getGovernorateName(item.governorateId)}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {item.address}
                    </span>
                    <span className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="size-3" />
                      {item.openingHours}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">
              {provider.type === "doctor"
                ? "Choose a consultation"
                : provider.type === "lab"
                  ? "Choose a test or package"
                  : "Choose a scan or package"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {branch
                ? `Offered at ${branch.name}. Prices are this branch's prices — no hidden fees at the counter.`
                : "Pick a branch first — services and prices differ between branches."}
            </p>
          </div>

          {branch && isSearchable && (
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search services…"
                className="h-10 rounded-xl pl-9"
                aria-label="Search services"
              />
            </div>
          )}
        </div>

        {!branch ? (
          <p className="rounded-2xl border border-dashed bg-card/50 px-6 py-10 text-center text-sm text-muted-foreground">
            Choose a branch above to see what it offers.
          </p>
        ) : totalServices === 0 ? (
          <p className="rounded-2xl border border-dashed bg-card/50 px-6 py-10 text-center text-sm text-muted-foreground">
            {branch.name} has no bookable services listed. Try another branch.
          </p>
        ) : filtered.length === 0 ? (
          <p className="rounded-2xl border border-dashed bg-card/50 px-6 py-10 text-center text-sm text-muted-foreground">
            No services match &ldquo;{query}&rdquo;. Try a different search.
          </p>
        ) : (
          filtered.map((group) => (
            <div key={group.title} className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {group.title}
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                {group.services.map((service) => (
                  <ServiceCard
                    key={service.id}
                    service={service}
                    price={branchPriceOf(branch, service)}
                    isSelected={service.id === serviceId}
                    onSelect={() => onSelectService(service.id)}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
