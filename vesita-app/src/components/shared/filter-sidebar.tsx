"use client";

import { SlidersHorizontal, X } from "lucide-react";

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
import { formatEGP } from "@/lib/site";
import { INSURANCE_ENABLED, PRICE_RANGE, type SearchFilters } from "@/lib/types";
import { cn } from "@/lib/utils";

interface FilterSidebarProps {
  filters: SearchFilters;
  onChange: (patch: Partial<SearchFilters>) => void;
  onReset: () => void;
  /** Number of filters currently applied — drives the mobile badge. */
  activeCount: number;
  className?: string;
}

const RATINGS = [
  { value: "0", label: "Any rating" },
  { value: "3", label: "3.0+" },
  { value: "3.5", label: "3.5+" },
  { value: "4", label: "4.0+" },
  { value: "4.5", label: "4.5+" },
];

/** The filter form itself — shared by the desktop rail and the mobile sheet. */
function FilterControls({ filters, onChange, onReset }: Omit<FilterSidebarProps, "activeCount" | "className">) {
  const areas = getAreasFor(filters.governorateId ?? "");
  const isDoctorSearch = filters.type === "doctor" || !filters.type;
  const subSpecialties = getSubSpecialtiesFor(filters.specialtyId ?? "");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Filters</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          className="h-8 text-xs text-muted-foreground hover:text-destructive"
        >
          <X className="size-3.5" />
          Reset
        </Button>
      </div>

      <Separator />

      {isDoctorSearch && (
        <>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Specialty</Label>
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
              emptyOption="All specialties"
              placeholder="All specialties"
              options={SPECIALTIES.map((s) => ({ value: s.id, label: s.name }))}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Subspecialty</Label>
            <AppSelect
              value={filters.subSpecialty ?? ""}
              onValueChange={(value) => onChange({ subSpecialty: value || undefined })}
              emptyOption="All subspecialties"
              placeholder={
                filters.specialtyId ? "All subspecialties" : "Pick a specialty first"
              }
              disabled={!filters.specialtyId || subSpecialties.length === 0}
              options={subSpecialties.map((s) => ({ value: s, label: s }))}
            />
            {!filters.specialtyId && (
              <p className="text-xs text-muted-foreground">
                Choose a specialty to narrow it further.
              </p>
            )}
          </div>
        </>
      )}

      <div className="space-y-2">
        <Label className="text-sm font-medium">Governorate</Label>
        <AppSelect
          value={filters.governorateId ?? ""}
          onValueChange={(value) =>
            onChange({ governorateId: value || undefined, areaId: undefined })
          }
          emptyOption="All Egypt"
          placeholder="All Egypt"
          options={GOVERNORATES.map((g) => ({ value: g.id, label: g.name }))}
        />
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">Area</Label>
        <AppSelect
          value={filters.areaId ?? ""}
          onValueChange={(value) => onChange({ areaId: value || undefined })}
          emptyOption="All areas"
          placeholder="All areas"
          disabled={!filters.governorateId}
          options={areas.map((a) => ({ value: a.id, label: a.name }))}
        />
      </div>

      {isDoctorSearch && (
        <>
          <Separator />
          <div className="space-y-3">
            <Label className="text-sm font-medium">Gender</Label>
            <RadioGroup
              value={filters.gender ?? "any"}
              onValueChange={(value: string | null) =>
                onChange({
                  gender:
                    value === "any" || value == null
                      ? undefined
                      : (value as "male" | "female"),
                })
              }
              className="flex gap-4"
            >
              {[
                { value: "any", label: "Any" },
                { value: "male", label: "Male" },
                { value: "female", label: "Female" },
              ].map((option) => (
                <div key={option.value} className="flex items-center gap-2">
                  <RadioGroupItem value={option.value} id={`gender-${option.value}`} />
                  <Label
                    htmlFor={`gender-${option.value}`}
                    className="cursor-pointer text-sm font-normal"
                  >
                    {option.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        </>
      )}

      <Separator />

      <div className="space-y-3">
        <Label className="text-sm font-medium">Minimum rating</Label>
        <RadioGroup
          value={String(filters.minRating ?? 0)}
          onValueChange={(value: string | null) =>
            onChange({ minRating: Number(value ?? 0) || undefined })
          }
          className="space-y-2"
        >
          {RATINGS.map((option) => (
            <div key={option.value} className="flex items-center gap-2">
              <RadioGroupItem value={option.value} id={`rating-${option.value}`} />
              <Label
                htmlFor={`rating-${option.value}`}
                className="cursor-pointer text-sm font-normal"
              >
                {option.label}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>

      <Separator />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Price range</Label>
          <span className="text-xs font-medium tabular-nums text-muted-foreground">
            {formatEGP(filters.minPrice ?? PRICE_RANGE.min)} –{" "}
            {(filters.maxPrice ?? PRICE_RANGE.max) >= PRICE_RANGE.max
              ? "Any"
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
          aria-label="Price range"
        />
      </div>

      <Separator />

      <div className="flex items-center justify-between gap-3">
        <div className="space-y-0.5">
          <Label htmlFor="available-today" className="text-sm font-medium">
            Available today
          </Label>
          <p className="text-xs text-muted-foreground">
            An optimistic hint. The provider&apos;s page shows the real thing.
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
          <Label className="text-sm font-medium">Insurance</Label>
          {!INSURANCE_ENABLED && (
            <Badge variant="secondary" className="font-normal">
              Coming soon
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
          emptyOption="Any insurance"
          placeholder="Any insurance"
          disabled={!INSURANCE_ENABLED}
          aria-label="Insurance plan"
          options={INSURANCE_PLANS.map((plan) => ({
            value: plan.id,
            label: plan.name,
          }))}
        />
        {!INSURANCE_ENABLED && (
          <p className="text-xs text-muted-foreground">
            Booking with insurance isn&apos;t live yet. Providers already list the
            plans they accept on their profile.
          </p>
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
  return (
    <>
      {/* Desktop: a sticky rail beside the results. */}
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
            <Button variant="outline" className="rounded-xl lg:hidden">
              <SlidersHorizontal className="size-4" />
              Filters
              {activeCount > 0 && (
                <Badge className="ml-1 size-5 justify-center rounded-full p-0 text-xs tabular-nums">
                  {activeCount}
                </Badge>
              )}
            </Button>
          }
        />
        <SheetContent side="left" className="w-full overflow-y-auto sm:max-w-sm">
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-8">
            <FilterControls filters={filters} onChange={onChange} onReset={onReset} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
