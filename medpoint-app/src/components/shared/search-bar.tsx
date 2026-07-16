"use client";

import { useRouter } from "next/navigation";
import { FlaskConical, ScanLine, Search, Stethoscope } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { AppSelect } from "@/components/ui/app-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { GOVERNORATES, SPECIALTIES, getAreasFor } from "@/lib/data/egypt";
import { useDomain, useFormat } from "@/lib/i18n/use-format";
import { useLabels } from "@/lib/i18n/use-labels";
import { PRICE_RANGE, type ProviderRole } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * `flex flex-col gap-1.5`, never `space-y-1.5`.
 *
 * Base UI's Select renders a hidden `<input>` as the *last* child of the field,
 * and Tailwind v4's `space-y-*` sets `margin-bottom` on every child except the
 * last — so the trigger stopped being last and picked up a 6px margin under it.
 * That made every select field 6px taller than the plain-input field, and
 * `items-end` then dropped the submit button below the row it should line up
 * with. The hidden input is `position: fixed`, hence out of flow, so a flex gap
 * ignores it.
 */
const FIELD_CELL = "flex flex-col gap-1.5";

/** One fixed line box per label, so every column's control starts at the same y. */
const FIELD_LABEL = "block h-5 truncate text-xs leading-5 text-muted-foreground";

const SERVICE_TYPES: { value: ProviderRole; icon: typeof Stethoscope }[] = [
  { value: "doctor", icon: Stethoscope },
  { value: "lab", icon: FlaskConical },
  { value: "radiology", icon: ScanLine },
];

interface SearchBarProps {
  /** Pre-fills the form (used on the search page to reflect the active query). */
  defaults?: {
    q?: string;
    type?: ProviderRole;
    specialtyId?: string;
    governorateId?: string;
    areaId?: string;
    maxPrice?: number;
  };
  /** Hero renders the full panel; `compact` is the inline bar in the header. */
  variant?: "hero" | "compact";
  className?: string;
}

/**
 * The primary search entry point. Serializes its state into the query string
 * and navigates to /search, so results are shareable and bookmarkable.
 */
export function SearchBar({ defaults, variant = "hero", className }: SearchBarProps) {
  const router = useRouter();
  const t = useTranslations("search");
  const L = useLabels();
  const { formatEGP } = useFormat();
  const { getSpecialtyName, getGovernorateName, getAreaName } = useDomain();

  const [type, setType] = useState<ProviderRole>(defaults?.type ?? "doctor");
  const [q, setQ] = useState(defaults?.q ?? "");
  const [specialtyId, setSpecialtyId] = useState(defaults?.specialtyId ?? "");
  const [governorateId, setGovernorateId] = useState(defaults?.governorateId ?? "");
  const [areaId, setAreaId] = useState(defaults?.areaId ?? "");
  const [maxPrice, setMaxPrice] = useState(defaults?.maxPrice ?? PRICE_RANGE.max);

  const areas = useMemo(() => getAreasFor(governorateId), [governorateId]);

  function submit(event: React.FormEvent) {
    event.preventDefault();

    const params = new URLSearchParams();
    params.set("type", type);
    if (q.trim()) params.set("q", q.trim());
    if (specialtyId) params.set("specialtyId", specialtyId);
    if (governorateId) params.set("governorateId", governorateId);
    if (areaId) params.set("areaId", areaId);
    if (maxPrice < PRICE_RANGE.max) params.set("maxPrice", String(maxPrice));

    router.push(`/search?${params.toString()}`);
  }

  if (variant === "compact") {
    return (
      <form onSubmit={submit} className={cn("relative w-full", className)}>
        <Search className="pointer-events-none absolute top-1/2 start-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("bar.compactPlaceholder")}
          aria-label={t("bar.compactLabel")}
          className="h-10 rounded-xl ps-10"
        />
      </form>
    );
  }

  const isDoctor = type === "doctor";
  const isPriceCapped = maxPrice < PRICE_RANGE.max;

  return (
    <form
      onSubmit={submit}
      className={cn(
        "rounded-3xl border bg-card/95 p-3 shadow-lift backdrop-blur sm:p-4",
        className,
      )}
    >
      {/*
        Service type — the switch that reframes the whole search.

        Sized to its labels rather than stretched across the panel: three short
        words spread over a full-width row read as three separate buttons, not as
        one control with one thing selected.
      */}
      <div
        role="tablist"
        aria-label={t("bar.serviceType")}
        className="mb-4 inline-flex w-full gap-1 rounded-2xl bg-muted p-1 sm:w-auto"
      >
        {SERVICE_TYPES.map(({ value, icon: Icon }) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={type === value}
            onClick={() => {
              setType(value);
              // Specialty only applies to doctors.
              if (value !== "doctor") setSpecialtyId("");
            }}
            className={cn(
              // Below `sm` the icon is dropped and the label is allowed to
              // shrink: three labels as long as "Radiology Center" cannot sit
              // side by side on a phone without one of them being cut off.
              "flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-2 py-2 text-xs font-medium transition-all sm:flex-none sm:px-5 sm:text-sm sm:whitespace-nowrap",
              type === value
                ? "bg-card text-primary shadow-soft"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="hidden size-4 shrink-0 sm:block" />
            <span className="truncate">{L.providerType(value)}</span>
          </button>
        ))}
      </div>

      {/*
        The submit button sits outside the field grid, not in a column of it.
        As a grid cell it was one twelfth of the row — narrower than the word
        "Search" — so it spilled out past the panel's rounded edge. Here the
        fields take the remaining space and the button is sized by its content.
      */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        {/*
          12 columns: doctor = 4/3/3/2, lab & radiology = 6/-/3/3.

          The governorate gets 3 rather than 2 because Arabic runs ~20% longer
          than English — at 2 columns its value truncated mid-word ("كل محافظات
          مد"). Sizing to the wider script keeps both honest.
        */}
        <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-12">
          <div
            className={cn(
              FIELD_CELL,
              isDoctor ? "lg:col-span-4" : "lg:col-span-6",
            )}
          >
            <Label htmlFor="search-q" className={FIELD_LABEL}>
              {isDoctor ? t("bar.queryLabel.doctor") : t("bar.queryLabel.service")}
            </Label>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 start-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="search-q"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={
                  isDoctor
                    ? t("bar.queryPlaceholder.doctor")
                    : t("bar.queryPlaceholder.service")
                }
                className="h-11 rounded-xl ps-9"
              />
            </div>
          </div>

          {isDoctor && (
            <div className={cn(FIELD_CELL, "lg:col-span-3")}>
              <Label className={FIELD_LABEL}>{t("bar.specialty")}</Label>
              <AppSelect
                value={specialtyId}
                onValueChange={setSpecialtyId}
                emptyOption={t("bar.allSpecialties")}
                placeholder={t("bar.allSpecialties")}
                aria-label={t("bar.specialty")}
                options={SPECIALTIES.map((s) => ({
                  value: s.id,
                  label: getSpecialtyName(s.id),
                }))}
              />
            </div>
          )}

          <div className={cn(FIELD_CELL, "lg:col-span-3")}>
            <Label className={FIELD_LABEL}>{t("bar.governorate")}</Label>
            <AppSelect
              value={governorateId}
              onValueChange={(value) => {
                setGovernorateId(value);
                setAreaId(""); // areas are scoped to a governorate
              }}
              emptyOption={t("bar.allEgypt")}
              placeholder={t("bar.allEgypt")}
              aria-label={t("bar.governorate")}
              options={GOVERNORATES.map((g) => ({
                value: g.id,
                label: getGovernorateName(g.id),
              }))}
            />
          </div>

          <div
            className={cn(FIELD_CELL, isDoctor ? "lg:col-span-2" : "lg:col-span-3")}
          >
            <Label className={FIELD_LABEL}>{t("bar.area")}</Label>
            <AppSelect
              value={areaId}
              onValueChange={setAreaId}
              emptyOption={t("bar.allAreas")}
              placeholder={t("bar.allAreas")}
              aria-label={t("bar.area")}
              disabled={!governorateId}
              options={areas.map((a) => ({ value: a.id, label: getAreaName(a.id) }))}
            />
          </div>
        </div>

        <Button
          type="submit"
          size="lg"
          className="h-11 w-full shrink-0 rounded-xl px-6 lg:w-auto"
        >
          <Search className="size-4" />
          {t("bar.submit")}
        </Button>
      </div>

      <div className="mt-4 flex items-center gap-3 border-t pt-4 sm:gap-4">
        <Label className="shrink-0 text-xs text-muted-foreground">
          {t("bar.maxPrice")}
        </Label>
        <Slider
          value={[maxPrice]}
          onValueChange={(value) => setMaxPrice(Array.isArray(value) ? value[0] : value)}
          min={PRICE_RANGE.min}
          max={PRICE_RANGE.max}
          step={50}
          aria-label={t("bar.maxPriceLabel")}
          className="flex-1"
        />
        {/*
          The cap reads as a value, not as body copy — and `ltr-nums` keeps
          "EGP 500" from being reordered by the bidi algorithm in Arabic.
        */}
        <span
          className={cn(
            "shrink-0 rounded-lg px-2 py-1 text-sm font-semibold tabular-nums transition-colors",
            isPriceCapped
              ? "ltr-nums bg-primary/10 text-primary"
              : "text-muted-foreground",
          )}
        >
          {isPriceCapped ? formatEGP(maxPrice) : t("bar.anyPrice")}
        </span>
      </div>
    </form>
  );
}
