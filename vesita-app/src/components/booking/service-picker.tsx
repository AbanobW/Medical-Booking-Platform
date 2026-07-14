"use client";

import { Check, Clock, MapPin, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useDomain, useFormat } from "@/lib/i18n/use-format";
import type { Named } from "@/lib/i18n/domain";
import {
  branchPriceOf,
  requiresAcknowledgement,
  type Branch,
  type Provider,
  type Service,
} from "@/lib/types";
import { cn } from "@/lib/utils";

/** Group headings are keys, not copy — the component translates them. */
type GroupKey = "consultation" | "tests" | "scans" | "packages";

interface ServiceGroup {
  key: GroupKey;
  services: Service[];
}

/**
 * A service in the shape `named()` understands.
 *
 * Lab tests and scans ship `nameAr`; consultation types and packages do not
 * (yet). `named()` falls back to the English name when the Arabic one is blank,
 * so this is safe either way.
 */
export function serviceNamed(service: Service): Named {
  return {
    name: service.name,
    nameAr: "nameAr" in service ? service.nameAr : "",
  };
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
        key: "consultation",
        services: provider.consultationTypes.filter(offered),
      },
    ];
  }

  const items: ServiceGroup =
    provider.type === "lab"
      ? { key: "tests", services: provider.tests.filter(offered) }
      : { key: "scans", services: provider.scans.filter(offered) };

  const packages = provider.packages.filter(offered);

  return [
    ...(packages.length > 0
      ? [{ key: "packages" as const, services: packages as Service[] }]
      : []),
    items,
  ];
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
  const t = useTranslations("booking");
  const { named, localized } = useDomain();
  const { formatDuration, formatEGP, formatNumber } = useFormat();

  const pkg = service.kind === "package" ? service : undefined;
  const saving = pkg ? pkg.originalPrice - pkg.price : 0;

  const meta: string[] = (() => {
    switch (service.kind) {
      case "consultation":
        return [formatDuration(service.durationMinutes)];
      case "test":
        return [
          t("service.meta.results", {
            duration: formatDuration(service.resultTimeHours * 60),
          }),
          ...(service.fastingRequired ? [t("service.meta.fasting")] : []),
        ];
      case "scan":
        return [
          formatDuration(service.durationMinutes),
          ...(service.contrastRequired ? [t("service.meta.contrast")] : []),
        ];
      case "package":
        return [
          t("service.meta.includes", {
            count: service.includes.length,
            n: formatNumber(service.includes.length),
          }),
        ];
    }
  })();

  const description = localized(service.description);

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isSelected}
      className={cn(
        "flex w-full flex-col gap-2 rounded-2xl border p-4 text-start transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        isSelected
          ? "border-primary bg-primary/5 shadow-glow"
          : "border-border bg-card hover:border-primary/50 hover:shadow-soft",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 font-semibold">
            <span className="truncate">{named(serviceNamed(service))}</span>
            {isSelected && (
              <Check className="size-4 shrink-0 text-primary" aria-hidden />
            )}
          </p>
          {description && (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
              {description}
            </p>
          )}
        </div>

        <div className="shrink-0 text-end">
          <p className="font-bold text-primary">{formatEGP(price)}</p>
          {pkg && saving > 0 && (
            <p className="text-xs text-muted-foreground line-through">
              {formatEGP(pkg.originalPrice)}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {meta.map((line) => (
          <Badge
            key={line}
            variant="secondary"
            className="text-[0.7rem] font-normal"
          >
            {line}
          </Badge>
        ))}
        {requiresAcknowledgement(service) && (
          <Badge variant="outline" className="text-[0.7rem] font-normal">
            {t("service.prepNeeded")}
          </Badge>
        )}
        {saving > 0 && (
          <Badge className="text-[0.7rem]">
            {t("service.save", { amount: formatEGP(saving) })}
          </Badge>
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
  const t = useTranslations("booking");
  const { named, localized, getAreaName, getGovernorateName } = useDomain();

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
          `${s.name} ${named(serviceNamed(s))} ${localized(s.description)}`
            .toLowerCase()
            .includes(term),
        ),
      }))
      .filter((group) => group.services.length > 0);
  }, [groups, query, named, localized]);

  const heading =
    provider.type === "doctor"
      ? t("service.titleDoctor")
      : provider.type === "lab"
        ? t("service.titleLab")
        : t("service.titleRadiology");

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">{t("service.branchTitle")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("service.branchSubtitle")}
          </p>
        </div>

        {branches.length === 0 ? (
          <p className="rounded-2xl border border-dashed bg-card/50 px-6 py-8 text-center text-sm text-muted-foreground">
            {t("service.branchEmpty")}
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
                    "flex w-full items-start gap-3 rounded-2xl border p-4 text-start transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
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
                        <Check
                          className="size-4 shrink-0 text-primary"
                          aria-hidden
                        />
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
                      <span className="ltr-nums">{item.openingHours}</span>
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
            <h2 className="text-lg font-semibold">{heading}</h2>
            <p className="text-sm text-muted-foreground">
              {branch
                ? t("service.subtitleBranch", { branch: branch.name })
                : t("service.subtitleNoBranch")}
            </p>
          </div>

          {branch && isSearchable && (
            <div className="relative w-full sm:w-64">
              <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("service.searchPlaceholder")}
                className="h-10 rounded-xl ps-9"
                aria-label={t("service.searchAria")}
              />
            </div>
          )}
        </div>

        {!branch ? (
          <p className="rounded-2xl border border-dashed bg-card/50 px-6 py-10 text-center text-sm text-muted-foreground">
            {t("service.chooseBranchFirst")}
          </p>
        ) : totalServices === 0 ? (
          <p className="rounded-2xl border border-dashed bg-card/50 px-6 py-10 text-center text-sm text-muted-foreground">
            {t("service.branchNoServices", { branch: branch.name })}
          </p>
        ) : filtered.length === 0 ? (
          <p className="rounded-2xl border border-dashed bg-card/50 px-6 py-10 text-center text-sm text-muted-foreground">
            {t("service.noMatches", { query })}
          </p>
        ) : (
          filtered.map((group) => (
            <div key={group.key} className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t(`service.group.${group.key}`)}
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
