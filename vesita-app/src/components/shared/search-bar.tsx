"use client";

import { useRouter } from "next/navigation";
import { FlaskConical, ScanLine, Search, Stethoscope } from "lucide-react";
import { useMemo, useState } from "react";

import { AppSelect } from "@/components/ui/app-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { GOVERNORATES, SPECIALTIES, getAreasFor } from "@/lib/data/egypt";
import { PRICE_RANGE, type ProviderRole } from "@/lib/types";
import { formatEGP } from "@/lib/site";
import { cn } from "@/lib/utils";

const SERVICE_TYPES: { value: ProviderRole; label: string; icon: typeof Stethoscope }[] = [
  { value: "doctor", label: "Doctors", icon: Stethoscope },
  { value: "lab", label: "Labs", icon: FlaskConical },
  { value: "radiology", label: "Radiology", icon: ScanLine },
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
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search doctors, tests, scans…"
          aria-label="Search"
          className="h-10 rounded-xl pl-10"
        />
      </form>
    );
  }

  return (
    <form
      onSubmit={submit}
      className={cn(
        "rounded-3xl border bg-card/95 p-4 shadow-lift backdrop-blur sm:p-5",
        className,
      )}
    >
      {/* Service type — the switch that reframes the whole search. */}
      <div
        role="tablist"
        aria-label="Service type"
        className="mb-4 flex gap-1 rounded-2xl bg-muted p-1"
      >
        {SERVICE_TYPES.map(({ value, label, icon: Icon }) => (
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
              "flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
              type === value
                ? "bg-card text-primary shadow-soft"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-12">
        <div className="space-y-1.5 lg:col-span-4">
          <Label htmlFor="search-q" className="text-xs text-muted-foreground">
            {type === "doctor" ? "Doctor name or symptom" : "Test, scan or center"}
          </Label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="search-q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={
                type === "doctor" ? "e.g. Cardiology, Dr. Ahmed" : "e.g. MRI Brain, CBC"
              }
              className="h-11 rounded-xl pl-9"
            />
          </div>
        </div>

        {type === "doctor" && (
          <div className="space-y-1.5 lg:col-span-3">
            <Label className="text-xs text-muted-foreground">Specialty</Label>
            <AppSelect
              value={specialtyId}
              onValueChange={setSpecialtyId}
              emptyOption="All specialties"
              placeholder="All specialties"
              aria-label="Specialty"
              options={SPECIALTIES.map((s) => ({ value: s.id, label: s.name }))}
            />
          </div>
        )}

        <div
          className={cn("space-y-1.5", type === "doctor" ? "lg:col-span-2" : "lg:col-span-3")}
        >
          <Label className="text-xs text-muted-foreground">Governorate</Label>
          <AppSelect
            value={governorateId}
            onValueChange={(value) => {
              setGovernorateId(value);
              setAreaId(""); // areas are scoped to a governorate
            }}
            emptyOption="All Egypt"
            placeholder="All Egypt"
            aria-label="Governorate"
            options={GOVERNORATES.map((g) => ({ value: g.id, label: g.name }))}
          />
        </div>

        <div
          className={cn("space-y-1.5", type === "doctor" ? "lg:col-span-2" : "lg:col-span-3")}
        >
          <Label className="text-xs text-muted-foreground">Area</Label>
          <AppSelect
            value={areaId}
            onValueChange={setAreaId}
            emptyOption="All areas"
            placeholder="All areas"
            aria-label="Area"
            disabled={!governorateId}
            options={areas.map((a) => ({ value: a.id, label: a.name }))}
          />
        </div>

        <div className="flex items-end lg:col-span-1">
          <Button type="submit" size="lg" className="h-11 w-full rounded-xl">
            <Search className="size-4" />
            <span className="lg:sr-only xl:not-sr-only">Search</span>
          </Button>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-4 border-t pt-4">
        <Label className="shrink-0 text-xs text-muted-foreground">
          Max price
        </Label>
        <Slider
          value={[maxPrice]}
          onValueChange={(value) => setMaxPrice(Array.isArray(value) ? value[0] : value)}
          min={PRICE_RANGE.min}
          max={PRICE_RANGE.max}
          step={50}
          aria-label="Maximum price"
          className="flex-1"
        />
        <span className="w-24 shrink-0 text-right text-sm font-medium tabular-nums">
          {maxPrice >= PRICE_RANGE.max ? "Any" : formatEGP(maxPrice)}
        </span>
      </div>
    </form>
  );
}
