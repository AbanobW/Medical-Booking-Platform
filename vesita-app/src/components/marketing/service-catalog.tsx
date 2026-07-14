"use client";

import {
  ChevronDown,
  Clock,
  Droplet,
  FileText,
  GlassWater,
  Pill,
  Search,
  ShieldAlert,
  Sparkles,
  TriangleAlert,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { BranchPrice } from "@/components/marketing/branch-pricing";
import { EmptyState } from "@/components/shared/states";
import { AppSelect } from "@/components/ui/app-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useDomain, useFormat } from "@/lib/i18n/use-format";
import { useLabels } from "@/lib/i18n/use-labels";
import {
  hasPreparation,
  requiresAcknowledgement,
  type Branch,
  type EligibilityRules,
  type LabTest,
  type RadiologyScan,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type CatalogItem = LabTest | RadiologyScan;

/**
 * The catalogue categories are a closed set in the dataset, so each one has a
 * translation; anything unexpected falls back to the stored English label.
 */
function useCategoryName() {
  const t = useTranslations("profile");
  return (category: string) =>
    t.has(`category.${category}`) ? t(`category.${category}`) : category;
}

/**
 * A plain-language summary of a service's restrictions — the translated twin of
 * `describeEligibility`, which returns English strings for non-React callers.
 */
function useEligibilityDescription() {
  const t = useTranslations("profile");
  const L = useLabels();

  return (rules: EligibilityRules | undefined): string[] => {
    if (!rules) return [];
    const out: string[] = [];

    if (rules.genders?.length === 1) {
      out.push(
        rules.genders[0] === "male"
          ? t("eligibility.menOnly")
          : t("eligibility.womenOnly"),
      );
    }
    if (rules.minAge !== undefined && rules.maxAge !== undefined) {
      out.push(t("eligibility.agesRange", { min: rules.minAge, max: rules.maxAge }));
    } else if (rules.minAge !== undefined) {
      out.push(t("eligibility.agesMin", { min: rules.minAge }));
    } else if (rules.maxAge !== undefined) {
      out.push(t("eligibility.agesMax", { max: rules.maxAge }));
    }
    if (!rules.pregnancySafe) {
      out.push(t("eligibility.notInPregnancy"));
    }
    for (const condition of rules.excludedConditions) {
      out.push(
        t("eligibility.notSuitableWith", { condition: L.condition(condition) }),
      );
    }

    return out;
  };
}

/**
 * Preparation and eligibility, before the patient books (§3).
 *
 * This is the screen that stops someone arriving un-fasted, or booking a scan
 * they cannot have. It is deliberately shown on the profile — not saved for the
 * checkout — so nobody discovers the fast four hours too late.
 */
function PreparationDetails({ item }: { item: CatalogItem }) {
  const t = useTranslations("profile");
  const { localized } = useDomain();
  const describe = useEligibilityDescription();

  const prep = item.preparation;
  const restrictions = describe(item.eligibility);

  return (
    <div className="space-y-3 rounded-xl border border-warning/30 bg-warning/5 p-3 text-sm">
      <p className="flex items-center gap-1.5 font-medium text-warning-foreground">
        <TriangleAlert className="size-3.5 shrink-0 text-warning" />
        {t("preparation.title")}
      </p>

      <ul className="space-y-2 text-muted-foreground">
        {prep.fastingRequired && (
          <li className="flex items-start gap-2">
            <Droplet className="mt-0.5 size-3.5 shrink-0 text-warning" />
            <span>
              <span className="font-medium text-foreground">
                {prep.fastingHours
                  ? t("preparation.fastingRequiredHours", {
                      hours: prep.fastingHours,
                    })
                  : t("preparation.fastingRequired")}
              </span>
              {". "}
              {prep.waterAllowed
                ? t("preparation.waterAllowed")
                : t("preparation.noWater")}
            </span>
          </li>
        )}

        {!prep.fastingRequired && prep.waterAllowed && (
          <li className="flex items-start gap-2">
            <GlassWater className="mt-0.5 size-3.5 shrink-0 text-primary" />
            <span>{t("preparation.noFasting")}</span>
          </li>
        )}

        {prep.medicationRestrictions.length > 0 && (
          <li className="flex items-start gap-2">
            <Pill className="mt-0.5 size-3.5 shrink-0 text-warning" />
            <span>
              <span className="font-medium text-foreground">
                {t("preparation.medication")}{" "}
              </span>
              {prep.medicationRestrictions.map(localized).join(" · ")}
            </span>
          </li>
        )}

        {localized(prep.arrivalInstructions) && (
          <li className="flex items-start gap-2">
            <Clock className="mt-0.5 size-3.5 shrink-0 text-primary" />
            <span>
              <span className="font-medium text-foreground">
                {t("preparation.onArrival")}{" "}
              </span>
              {localized(prep.arrivalInstructions)}
            </span>
          </li>
        )}

        {prep.documentsRequired.length > 0 && (
          <li className="flex items-start gap-2">
            <FileText className="mt-0.5 size-3.5 shrink-0 text-primary" />
            <span>
              <span className="font-medium text-foreground">
                {t("preparation.bring")}{" "}
              </span>
              {prep.documentsRequired.map(localized).join(", ")}
            </span>
          </li>
        )}

        {restrictions.length > 0 && (
          <li className="flex items-start gap-2">
            <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-destructive" />
            <span>
              <span className="font-medium text-foreground">
                {t("preparation.whoCanBook")}{" "}
              </span>
              {restrictions.join(" · ")}
            </span>
          </li>
        )}
      </ul>

      <p className="text-xs text-muted-foreground">{t("preparation.confirmNote")}</p>
    </div>
  );
}

/**
 * The searchable, category-filterable catalogue of a lab's tests or a radiology
 * center's scans — with branch-aware pricing, preparation instructions and
 * eligibility rules surfaced before anyone books.
 */
export function ServiceCatalog({
  items,
  branches,
  slug,
  noun,
}: {
  items: CatalogItem[];
  /** Prices and the service list itself both resolve at the branch (§2). */
  branches: Branch[];
  slug: string;
  /** "test" or "scan" — used in copy. */
  noun: "test" | "scan";
}) {
  const t = useTranslations("profile");
  const { formatDuration, locale } = useFormat();
  const { named, localized } = useDomain();
  const categoryName = useCategoryName();

  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("name");
  const [expanded, setExpanded] = useState<string | null>(null);

  const Noun = noun === "test" ? "Test" : "Scan";

  const active = useMemo(() => items.filter((i) => i.isActive), [items]);

  const categories = useMemo(
    () => Array.from(new Set(active.map((i) => i.category))).sort(),
    [active],
  );

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();

    const filtered = active.filter((item) => {
      if (category && item.category !== category) return false;
      if (!term) return true;
      return `${item.name} ${item.nameAr} ${item.category} ${localized(item.description)}`
        .toLowerCase()
        .includes(term);
    });

    return [...filtered].sort((a, b) => {
      if (sort === "price_asc") return a.price - b.price;
      if (sort === "price_desc") return b.price - a.price;
      return named(a).localeCompare(named(b), locale);
    });
  }, [active, category, q, sort, named, localized, locale]);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 start-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder={t(`catalog.searchPlaceholder${Noun}`)}
            aria-label={t(`catalog.searchLabel${Noun}`)}
            className="h-11 rounded-xl ps-9"
          />
        </div>

        <AppSelect
          value={category}
          onValueChange={setCategory}
          emptyOption={t("catalog.allCategories")}
          placeholder={t("catalog.allCategories")}
          aria-label={t("catalog.categoryLabel")}
          className="sm:w-52"
          options={categories.map((c) => ({ value: c, label: categoryName(c) }))}
        />

        <AppSelect
          value={sort}
          onValueChange={(value) => setSort(value || "name")}
          placeholder={t("catalog.sort")}
          aria-label={t(`catalog.sortLabel${Noun}`)}
          className="sm:w-44"
          options={[
            { value: "name", label: t("catalog.sortName") },
            { value: "price_asc", label: t("catalog.sortPriceAsc") },
            { value: "price_desc", label: t("catalog.sortPriceDesc") },
          ]}
        />
      </div>

      <p className="text-sm text-muted-foreground">
        {t(noun === "test" ? "catalog.showingTests" : "catalog.showingScans", {
          visible: visible.length,
          total: active.length,
        })}
      </p>

      {visible.length === 0 ? (
        <EmptyState
          title={t(`catalog.emptyTitle${Noun}`)}
          description={t("catalog.emptyDescription")}
          action={
            <Button
              variant="outline"
              className="h-10 rounded-xl px-4"
              onClick={() => {
                setQ("");
                setCategory("");
              }}
            >
              {t("catalog.clearFilters")}
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {visible.map((item) => {
            const needsAck = requiresAcknowledgement(item);
            const isOpen = expanded === item.id;

            return (
              <li key={item.id}>
                <Card className="h-full transition-shadow hover:shadow-card">
                  <CardContent className="flex h-full flex-col gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h4 className="font-medium leading-tight">{named(item)}</h4>
                        {/* The other language's name, as a quiet subtitle. */}
                        <p
                          dir={locale === "ar" ? "ltr" : "rtl"}
                          className="mt-0.5 truncate text-xs text-muted-foreground"
                        >
                          {locale === "ar" ? item.name : item.nameAr}
                        </p>
                      </div>
                      <BranchPrice service={item} branches={branches} />
                    </div>

                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {localized(item.description)}
                    </p>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className="font-normal">
                        {categoryName(item.category)}
                      </Badge>

                      {item.kind === "test" ? (
                        <>
                          <Badge variant="secondary" className="gap-1 font-normal">
                            <Clock className="size-3" />
                            {t("catalog.resultsIn", { hours: item.resultTimeHours })}
                          </Badge>
                          {item.preparation.fastingRequired && (
                            <Badge
                              variant="secondary"
                              className="gap-1 bg-warning/15 font-normal text-warning-foreground"
                            >
                              <Droplet className="size-3" />
                              {item.preparation.fastingHours
                                ? t("catalog.fastingHours", {
                                    hours: item.preparation.fastingHours,
                                  })
                                : t("catalog.fasting")}
                            </Badge>
                          )}
                        </>
                      ) : (
                        <>
                          <Badge variant="secondary" className="gap-1 font-normal">
                            <Clock className="size-3" />
                            {formatDuration(item.durationMinutes)}
                          </Badge>
                          {item.contrastRequired && (
                            <Badge
                              variant="secondary"
                              className="gap-1 bg-warning/15 font-normal text-warning-foreground"
                            >
                              <Zap className="size-3" />
                              {t("catalog.contrast")}
                            </Badge>
                          )}
                        </>
                      )}

                      {/* §3 — the badge that makes a prepared patient. */}
                      {needsAck && (
                        <Badge
                          variant="secondary"
                          className="gap-1 bg-warning/15 font-normal text-warning-foreground"
                        >
                          <TriangleAlert className="size-3" />
                          {hasPreparation(item)
                            ? t("catalog.preparationRequired")
                            : t("catalog.eligibilityRules")}
                        </Badge>
                      )}
                    </div>

                    {needsAck && (
                      <>
                        <button
                          type="button"
                          onClick={() => setExpanded(isOpen ? null : item.id)}
                          aria-expanded={isOpen}
                          className="flex w-fit items-center gap-1 text-xs font-medium text-primary hover:underline"
                        >
                          {isOpen ? t("catalog.hidePrep") : t("catalog.readPrep")}
                          <ChevronDown
                            className={cn(
                              "size-3.5 transition-transform",
                              isOpen && "rotate-180",
                            )}
                          />
                        </button>

                        {isOpen && <PreparationDetails item={item} />}
                      </>
                    )}

                    <div className="mt-auto flex items-center justify-end pt-1">
                      <Button
                        render={
                          <Link href={`/booking/${slug}?serviceId=${item.id}`} />
                        }
                        size="sm"
                        variant="outline"
                        className="rounded-lg"
                      >
                        <Sparkles className="size-3.5" />
                        {t("catalog.book")}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
