"use client";

import { ExternalLink, MapPin, Navigation } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { GeoPoint } from "@/lib/types";

/**
 * Google Maps placeholder.
 *
 * Renders a styled static map surface with real pin geometry derived from the
 * mock coordinates, plus a working "Open in Google Maps" deep link. Dropping in
 * the real embed later means swapping the inner <div> for an <iframe> with an
 * API key — the props already carry everything it needs.
 */

interface MapMarker {
  id: string;
  label: string;
  location: GeoPoint;
  /** Highlights this marker (the provider you're looking at). */
  isPrimary?: boolean;
  href?: string;
}

export function MapPlaceholder({
  center,
  markers = [],
  address,
  zoom = 14,
  height = 280,
  className,
}: {
  center: GeoPoint;
  markers?: MapMarker[];
  address?: string;
  zoom?: number;
  height?: number;
  className?: string;
}) {
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${center.lat},${center.lng}`;
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${center.lat},${center.lng}`;

  const all: MapMarker[] =
    markers.length > 0
      ? markers
      : [{ id: "center", label: address ?? "Location", location: center, isPrimary: true }];

  // Project lat/lng onto the box. The span widens as zoom decreases.
  const span = 0.08 / Math.max(1, zoom / 14);

  const project = (point: GeoPoint) => ({
    // Latitude increases northward, but CSS `top` increases downward — invert.
    top: `${Math.max(6, Math.min(94, 50 - ((point.lat - center.lat) / span) * 50))}%`,
    left: `${Math.max(6, Math.min(94, 50 + ((point.lng - center.lng) / span) * 50))}%`,
  });

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-muted shadow-soft",
        className,
      )}
      style={{ height }}
    >
      {/* Stylized map surface: a street grid + landmasses. */}
      <div
        className="absolute inset-0 bg-[oklch(0.93_0.02_200)] dark:bg-[oklch(0.26_0.02_240)]"
        aria-hidden
      >
        <svg className="size-full" preserveAspectRatio="xMidYMid slice">
          <defs>
            <pattern
              id="map-grid"
              width="48"
              height="48"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 48 0 L 0 0 0 48"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                className="text-foreground/[0.07]"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#map-grid)" />

          {/* A river and two arterial roads, so it reads as a city. */}
          <path
            d="M -20 60 Q 120 140 200 100 T 460 190 T 720 140"
            fill="none"
            stroke="oklch(0.72 0.09 230)"
            strokeOpacity="0.35"
            strokeWidth="14"
            strokeLinecap="round"
          />
          <path
            d="M 0 200 L 700 160"
            stroke="currentColor"
            strokeOpacity="0.12"
            strokeWidth="8"
            className="text-foreground"
          />
          <path
            d="M 240 -20 L 300 320"
            stroke="currentColor"
            strokeOpacity="0.12"
            strokeWidth="8"
            className="text-foreground"
          />
        </svg>
      </div>

      {all.map((marker) => {
        const position = project(marker.location);

        return (
          <div
            key={marker.id}
            className="absolute -translate-x-1/2 -translate-y-full"
            style={position}
          >
            <div className="group relative flex flex-col items-center">
              <div
                className={cn(
                  "flex size-8 items-center justify-center rounded-full border-2 border-background shadow-lift transition-transform group-hover:scale-110",
                  marker.isPrimary
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground",
                )}
              >
                <MapPin className="size-4" />
              </div>

              {/* Label appears on hover, so dense pins don't collide. */}
              <span className="pointer-events-none absolute top-9 max-w-[10rem] truncate rounded-md bg-popover px-2 py-1 text-xs font-medium text-popover-foreground opacity-0 shadow-lift ring-1 ring-border transition-opacity group-hover:opacity-100">
                {marker.label}
              </span>
            </div>
          </div>
        );
      })}

      {address && (
        <div className="absolute inset-x-3 bottom-3 flex items-center gap-2 rounded-xl bg-card/95 p-3 shadow-lift backdrop-blur">
          <MapPin className="size-4 shrink-0 text-primary" />
          <p className="min-w-0 flex-1 truncate text-sm">{address}</p>

          <Button
            render={
              <a href={directionsUrl} target="_blank" rel="noopener noreferrer" />
            }
            size="sm"
            variant="outline"
            className="shrink-0 rounded-lg"
          >
            <Navigation className="size-3.5" />
            Directions
          </Button>
        </div>
      )}

      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-lg bg-card/95 px-2.5 py-1.5 text-xs font-medium shadow-soft backdrop-blur transition-colors hover:bg-card"
      >
        <ExternalLink className="size-3" />
        Google Maps
      </a>
    </div>
  );
}
