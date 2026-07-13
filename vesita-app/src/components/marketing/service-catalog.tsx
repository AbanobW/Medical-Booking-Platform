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
import { useMemo, useState } from "react";

import { BranchPrice } from "@/components/marketing/branch-pricing";
import { EmptyState } from "@/components/shared/states";
import { AppSelect } from "@/components/ui/app-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { describeEligibility } from "@/lib/eligibility";
import { formatDuration } from "@/lib/format";
import {
  hasPreparation,
  requiresAcknowledgement,
  type Branch,
  type LabTest,
  type RadiologyScan,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type CatalogItem = LabTest | RadiologyScan;

/**
 * Preparation and eligibility, before the patient books (§3).
 *
 * This is the screen that stops someone arriving un-fasted, or booking a scan
 * they cannot have. It is deliberately shown on the profile — not saved for the
 * checkout — so nobody discovers the fast four hours too late.
 */
function PreparationDetails({ item }: { item: CatalogItem }) {
  const prep = item.preparation;
  const restrictions = describeEligibility(item);

  return (
    <div className="space-y-3 rounded-xl border border-warning/30 bg-warning/5 p-3 text-sm">
      <p className="flex items-center gap-1.5 font-medium text-warning-foreground">
        <TriangleAlert className="size-3.5 shrink-0 text-warning" />
        Before you book
      </p>

      <ul className="space-y-2 text-muted-foreground">
        {prep.fastingRequired && (
          <li className="flex items-start gap-2">
            <Droplet className="mt-0.5 size-3.5 shrink-0 text-warning" />
            <span>
              <span className="font-medium text-foreground">
                Fasting required
                {prep.fastingHours ? ` — ${prep.fastingHours} hours` : ""}
              </span>
              {". "}
              {prep.waterAllowed
                ? "Water is allowed during the fast."
                : "No water during the fast."}
            </span>
          </li>
        )}

        {!prep.fastingRequired && prep.waterAllowed && (
          <li className="flex items-start gap-2">
            <GlassWater className="mt-0.5 size-3.5 shrink-0 text-primary" />
            <span>No fasting needed — eat and drink as normal.</span>
          </li>
        )}

        {prep.medicationRestrictions.length > 0 && (
          <li className="flex items-start gap-2">
            <Pill className="mt-0.5 size-3.5 shrink-0 text-warning" />
            <span>
              <span className="font-medium text-foreground">Medication: </span>
              {prep.medicationRestrictions.join(" · ")}
            </span>
          </li>
        )}

        {prep.arrivalInstructions && (
          <li className="flex items-start gap-2">
            <Clock className="mt-0.5 size-3.5 shrink-0 text-primary" />
            <span>
              <span className="font-medium text-foreground">On arrival: </span>
              {prep.arrivalInstructions}
            </span>
          </li>
        )}

        {prep.documentsRequired.length > 0 && (
          <li className="flex items-start gap-2">
            <FileText className="mt-0.5 size-3.5 shrink-0 text-primary" />
            <span>
              <span className="font-medium text-foreground">Bring with you: </span>
              {prep.documentsRequired.join(", ")}
            </span>
          </li>
        )}

        {restrictions.length > 0 && (
          <li className="flex items-start gap-2">
            <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-destructive" />
            <span>
              <span className="font-medium text-foreground">Who can book this: </span>
              {restrictions.join(" · ")}
            </span>
          </li>
        )}
      </ul>

      <p className="text-xs text-muted-foreground">
        You&apos;ll be asked to confirm you&apos;ve read this before the booking is
        finalised.
      </p>
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
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("name");
  const [expanded, setExpanded] = useState<string | null>(null);

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
      return `${item.name} ${item.nameAr} ${item.category} ${item.description}`
        .toLowerCase()
        .includes(term);
    });

    return [...filtered].sort((a, b) => {
      if (sort === "price_asc") return a.price - b.price;
      if (sort === "price_desc") return b.price - a.price;
      return a.name.localeCompare(b.name);
    });
  }, [active, category, q, sort]);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder={`Search ${noun}s by name or category…`}
            aria-label={`Search ${noun}s`}
            className="h-11 rounded-xl pl-9"
          />
        </div>

        <AppSelect
          value={category}
          onValueChange={setCategory}
          emptyOption="All categories"
          placeholder="All categories"
          aria-label="Category"
          className="sm:w-52"
          options={categories.map((c) => ({ value: c, label: c }))}
        />

        <AppSelect
          value={sort}
          onValueChange={(value) => setSort(value || "name")}
          placeholder="Sort"
          aria-label={`Sort ${noun}s`}
          className="sm:w-44"
          options={[
            { value: "name", label: "Name (A–Z)" },
            { value: "price_asc", label: "Price: low to high" },
            { value: "price_desc", label: "Price: high to low" },
          ]}
        />
      </div>

      <p className="text-sm text-muted-foreground">
        Showing <span className="font-medium text-foreground">{visible.length}</span>{" "}
        of {active.length} {noun}s
      </p>

      {visible.length === 0 ? (
        <EmptyState
          title={`No ${noun}s match your search`}
          description="Try a different keyword, or clear the category filter."
          action={
            <Button
              variant="outline"
              className="h-10 rounded-xl px-4"
              onClick={() => {
                setQ("");
                setCategory("");
              }}
            >
              Clear filters
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
                        <h4 className="font-medium leading-tight">{item.name}</h4>
                        <p
                          dir="rtl"
                          className="mt-0.5 truncate text-xs text-muted-foreground"
                        >
                          {item.nameAr}
                        </p>
                      </div>
                      <BranchPrice service={item} branches={branches} />
                    </div>

                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {item.description}
                    </p>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className="font-normal">
                        {item.category}
                      </Badge>

                      {item.kind === "test" ? (
                        <>
                          <Badge variant="secondary" className="gap-1 font-normal">
                            <Clock className="size-3" />
                            Results in {item.resultTimeHours}h
                          </Badge>
                          {item.preparation.fastingRequired && (
                            <Badge
                              variant="secondary"
                              className="gap-1 bg-warning/15 font-normal text-warning-foreground"
                            >
                              <Droplet className="size-3" />
                              Fasting
                              {item.preparation.fastingHours
                                ? ` ${item.preparation.fastingHours}h`
                                : ""}
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
                              Contrast
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
                            ? "Preparation required"
                            : "Eligibility rules"}
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
                          {isOpen ? "Hide" : "Read"} preparation &amp; eligibility
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
                        Book
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
