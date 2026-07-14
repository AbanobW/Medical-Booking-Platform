"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { AppSelect } from "@/components/ui/app-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  GOVERNORATES,
  INSURANCE_PLANS,
  SPECIALTIES,
  getAreasFor,
  getSubSpecialtiesFor,
} from "@/lib/data/egypt";
import { useDomain, useFormat } from "@/lib/i18n/use-format";
import { useLabels } from "@/lib/i18n/use-labels";
import { INSURANCE_ENABLED, PRICE_RANGE, type Gender, type SearchFilters } from "@/lib/types";
import { cn } from "@/lib/utils";

interface FilterSidebarProps {
  filters: SearchFilters;
  onChange: (patch: Partial<SearchFilters>) => void;
  onReset: () => void;
  /** Number of filters currently applied — drives the mobile badge. */
  activeCount: number;
  className?: string;
}

/** Rating thresholds. The numeral is language-neutral; only "any" is copy. */
const RATINGS = ["0", "3", "3.5", "4", "4.5"] as const;

/** Displayed as `3.0+`, `4.5+` — the whole numbers get a trailing `.0`. */
function ratingValue(value: string): string {
  return Number.isInteger(Number(value)) ? `${Number(value).toFixed(1)}` : value;
}

const GENDERS = ["any", "male", "female"] as const;

/** The filter form itself — shared by the desktop rail and the mobile sheet. */
function FilterControls({ filters, onChange, onReset }: Omit<FilterSidebarProps, "activeCount" | "className">) {
  const t = useTranslations("search");
  const L = useLabels();
  const { formatEGP } = useFormat();
  const { getSpecialtyName, getGovernorateName, getAreaName, getInsurancePlanName } =
    useDomain();

  const areas = getAreasFor(filters.governorateId ?? "");
  const isDoctorSearch = filters.type === "doctor" || !filters.type;
  const subSpecialties = getSubSpecialtiesFor(filters.specialtyId ?? "");

  // Subspecialties are stored as their English string (the identifier), so they
  // are translated at render — falling back to the raw value if a new one lands
  // in the dataset before its copy does.
  const subSpecialtyLabel = (value: string): string => {
    const key = `subSpecialty.${value}`;
    return t.has(key) ? t(key) : value;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{t("filters.title")}</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          className="h-8 text-xs text-muted-foreground hover:text-destructive"
        >
          <X className="size-3.5" />
          {t("filters.reset")}
        </Button>
      </div>

      <Separator />

      {isDoctorSearch && (
        <>
          <div className="space-y-2">
            <Label className="text-sm font-medium">{t("filters.specialty")}</Label>
            <AppSelect
              value={filters.specialtyId ?? ""}
              onValueChange={(value) =>
                // A subspecialty only means anything inside its parent specialty,
                // so changing the specialty always clears it.
                onChange({
                  specialtyId: value || undefined,
                  subSpecialty: undefined,
                })
              }
              emptyOption={t("filters.allSpecialties")}
              placeholder={t("filters.allSpecialties")}
              aria-label={t("filters.specialty")}
              options={SPECIALTIES.map((s) => ({
                value: s.id,
                label: getSpecialtyName(s.id),
              }))}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">{t("filters.subSpecialty")}</Label>
            <AppSelect
              value={filters.subSpecialty ?? ""}
              onValueChange={(value) => onChange({ subSpecialty: value || undefined })}
              emptyOption={t("filters.allSubSpecialties")}
              placeholder={
                filters.specialtyId
                  ? t("filters.allSubSpecialties")
                  : t("filters.pickSpecialtyFirst")
              }
              aria-label={t("filters.subSpecialty")}
              disabled={!filters.specialtyId || subSpecialties.length === 0}
              options={subSpecialties.map((s) => ({
                value: s,
                label: subSpecialtyLabel(s),
              }))}
            />
            {!filters.specialtyId && (
              <p className="text-xs text-muted-foreground">
                {t("filters.pickSpecialtyHint")}
              </p>
            )}
          </div>
        </>
      )}

      <div className="space-y-2">
        <Label className="text-sm font-medium">{t("filters.governorate")}</Label>
        <AppSelect
          value={filters.governorateId ?? ""}
          onValueChange={(value) =>
            onChange({ governorateId: value || undefined, areaId: undefined })
          }
          emptyOption={t("filters.allEgypt")}
          placeholder={t("filters.allEgypt")}
          aria-label={t("filters.governorate")}
          options={GOVERNORATES.map((g) => ({
            value: g.id,
            label: getGovernorateName(g.id),
          }))}
        />
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">{t("filters.area")}</Label>
        <AppSelect
          value={filters.areaId ?? ""}
          onValueChange={(value) => onChange({ areaId: value || undefined })}
          emptyOption={t("filters.allAreas")}
          placeholder={t("filters.allAreas")}
          aria-label={t("filters.area")}
          disabled={!filters.governorateId}
          options={areas.map((a) => ({ value: a.id, label: getAreaName(a.id) }))}
        />
      </div>

      {isDoctorSearch && (
        <>
          <Separator />
          <div className="space-y-3">
            <Label className="text-sm font-medium">{t("filters.gender")}</Label>
            <RadioGroup
              value={filters.gender ?? "any"}
              onValueChange={(value: string | null) =>
                onChange({
                  gender:
                    value === "any" || value == null
                      ? undefined
                      : (value as Gender),
                })
              }
              className="flex gap-4"
            >
              {GENDERS.map((option) => (
                <div key={option} className="flex items-center gap-2">
                  <RadioGroupItem value={option} id={`gender-${option}`} />
                  <Label
                    htmlFor={`gender-${option}`}
                    className="cursor-pointer text-sm font-normal"
                  >
                    {option === "any"
                      ? t("filters.genderAny")
                      : L.gender(option as Gender)}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        </>
      )}

      <Separator />

      <div className="space-y-3">
        <Label className="text-sm font-medium">{t("filters.minRating")}</Label>
        <RadioGroup
          value={String(filters.minRating ?? 0)}
          onValueChange={(value: string | null) =>
            onChange({ minRating: Number(value ?? 0) || undefined })
          }
          className="space-y-2"
        >
          {RATINGS.map((option) => (
            <div key={option} className="flex items-center gap-2">
              <RadioGroupItem value={option} id={`rating-${option}`} />
              <Label
                htmlFor={`rating-${option}`}
                className="cursor-pointer text-sm font-normal"
              >
                {option === "0" ? (
                  t("filters.anyRating")
                ) : (
                  <span className="ltr-nums">
                    {t("filters.ratingAtLeast", { value: ratingValue(option) })}
                  </span>
                )}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>

      <Separator />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">{t("filters.priceRange")}</Label>
          <span className="ltr-nums text-xs font-medium tabular-nums text-muted-foreground">
            {formatEGP(filters.minPrice ?? PRICE_RANGE.min)} –{" "}
            {(filters.maxPrice ?? PRICE_RANGE.max) >= PRICE_RANGE.max
              ? t("filters.anyPrice")
              : formatEGP(filters.maxPrice!)}
          </span>
        </div>
        <Slider
          value={[
            filters.minPrice ?? PRICE_RANGE.min,
            filters.maxPrice ?? PRICE_RANGE.max,
          ]}
          onValueChange={(value) => {
            const [min, max] = value as number[];
            onChange({
              minPrice: min > PRICE_RANGE.min ? min : undefined,
              maxPrice: max < PRICE_RANGE.max ? max : undefined,
            });
          }}
          min={PRICE_RANGE.min}
          max={PRICE_RANGE.max}
          step={50}
          aria-label={t("filters.priceRange")}
        />
      </div>

      <Separator />

      <div className="flex items-center justify-between gap-3">
        <div className="space-y-0.5">
          <Label htmlFor="available-today" className="text-sm font-medium">
            {t("filters.availableToday")}
          </Label>
          <p className="text-xs text-muted-foreground">
            {t("filters.availableTodayHint")}
          </p>
        </div>
        <Switch
          id="available-today"
          checked={filters.availableToday ?? false}
          onCheckedChange={(checked: boolean) =>
            onChange({ availableToday: checked || undefined })
          }
        />
      </div>

      <Separator />

      {/*
        Insurance is a future phase (§14). The filter is reserved rather than
        hidden — operations and patients can see it is coming — but it is inert
        while `INSURANCE_ENABLED` is false and never narrows the results.
      */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-sm font-medium">{t("filters.insurance")}</Label>
          {!INSURANCE_ENABLED && (
            <Badge variant="secondary" className="font-normal">
              {t("filters.comingSoon")}
            </Badge>
          )}
        </div>
        <AppSelect
          value={INSURANCE_ENABLED ? (filters.insurancePlanId ?? "") : ""}
          onValueChange={(value) =>
            INSURANCE_ENABLED
              ? onChange({ insurancePlanId: value || undefined })
              : undefined
          }
          emptyOption={t("filters.anyInsurance")}
          placeholder={t("filters.anyInsurance")}
          disabled={!INSURANCE_ENABLED}
          aria-label={t("filters.insurancePlan")}
          options={INSURANCE_PLANS.map((plan) => ({
            value: plan.id,
            label: getInsurancePlanName(plan.id),
          }))}
        />
        {!INSURANCE_ENABLED && (
          <p className="text-xs text-muted-foreground">{t("filters.insuranceHint")}</p>
        )}
      </div>
    </div>
  );
}

export function FilterSidebar({
  filters,
  onChange,
  onReset,
  activeCount,
  className,
}: FilterSidebarProps) {
  const t = useTranslations("search");
  const { locale } = useFormat();

  return (
    <>
      {/* Desktop: a sticky rail beside the results. Flex order mirrors under RTL. */}
      <aside
        className={cn(
          "hidden lg:block lg:w-72 lg:shrink-0",
          className,
        )}
      >
        <div className="sticky top-24 rounded-2xl border bg-card p-5 shadow-soft">
          <FilterControls filters={filters} onChange={onChange} onReset={onReset} />
        </div>
      </aside>

      {/* Mobile: the same form inside a sheet. */}
      <Sheet>
        <SheetTrigger
          render={
            <Button
              variant="outline"
              className="rounded-xl lg:hidden"
              aria-label={t("filters.activeCount", { count: activeCount })}
            >
              <SlidersHorizontal className="size-4" />
              {t("filters.title")}
              {activeCount > 0 && (
                <Badge className="ms-1 size-5 justify-center rounded-full p-0 text-xs tabular-nums">
                  {activeCount}
                </Badge>
              )}
            </Button>
          }
        />
        {/* The sheet enters from the reading-start edge, which flips under RTL. */}
        <SheetContent
          side={locale === "ar" ? "right" : "left"}
          className="w-full overflow-y-auto sm:max-w-sm"
        >
          <SheetHeader>
            <SheetTitle>{t("filters.title")}</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-8">
            <FilterControls filters={filters} onChange={onChange} onReset={onReset} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
