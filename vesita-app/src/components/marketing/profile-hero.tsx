"use client";

import Link from "next/link";
import { CalendarCheck, Clock, MapPin, Phone, Share2, Star } from "lucide-react";
import { toast } from "sonner";

import { RatingStars } from "@/components/shared/rating";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getAreaName, getGovernorateName } from "@/lib/data/egypt";
import { formatDuration, initialsOf } from "@/lib/format";
import { formatEGP } from "@/lib/site";
import type { Provider } from "@/lib/types";

/**
 * Cover image + profile photo + identity block + booking CTA.
 * Shared by the doctor, lab and radiology profiles.
 */
export function ProfileHero({
  provider,
  subtitle,
  chips,
  priceLabel,
}: {
  provider: Provider;
  /** Specialty for doctors, "Medical Laboratory" / "Radiology Center" otherwise. */
  subtitle: string;
  /** Small pills under the subtitle (degrees, accreditations, flags). */
  chips?: string[];
  priceLabel: string;
}) {
  async function share() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: provider.name, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success("Profile link copied to your clipboard.");
    } catch {
      toast.error("Couldn't share this profile.");
    }
  }

  return (
    <section className="relative">
      {/* Cover — a local SVG API route, so next/image optimization is pointless. */}
      <div className="relative h-44 w-full overflow-hidden bg-muted sm:h-60 lg:h-72">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={provider.coverImage}
          alt=""
          aria-hidden
          className="size-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background/85 via-background/25 to-transparent" />
      </div>

      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="-mt-16 flex flex-col gap-6 sm:-mt-20 lg:flex-row lg:items-end">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
            <div className="size-28 shrink-0 overflow-hidden rounded-2xl border-4 border-background bg-muted shadow-lift sm:size-36">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={provider.photo}
                alt={provider.name}
                className="size-full object-cover"
                onError={(event) => {
                  event.currentTarget.style.display = "none";
                }}
              />
              <span className="sr-only">{initialsOf(provider.name)}</span>
            </div>

            <div className="min-w-0 pb-1">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                {provider.name}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground sm:text-base">
                {subtitle}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                <span className="flex items-center gap-1.5">
                  <RatingStars value={provider.rating} size="sm" />
                  <span className="font-semibold tabular-nums">
                    {provider.rating.toFixed(1)}
                  </span>
                  <span className="text-muted-foreground">
                    ({provider.reviewCount.toLocaleString()} reviews)
                  </span>
                </span>
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <MapPin className="size-3.5" />
                  {getAreaName(provider.areaId)},{" "}
                  {getGovernorateName(provider.governorateId)}
                </span>
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="size-3.5" />
                  ~{formatDuration(provider.waitingTimeMinutes)} wait
                </span>
              </div>

              {chips && chips.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {chips.map((chip) => (
                    <Badge key={chip} variant="secondary" className="font-normal">
                      {chip}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3 pb-1 lg:ml-auto lg:items-end">
            <div className="flex items-baseline gap-2 lg:justify-end">
              <span className="text-xs text-muted-foreground">{priceLabel}</span>
              <span className="text-2xl font-bold text-primary">
                {formatEGP(provider.price)}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                render={<Link href={`/booking/${provider.slug}`} />}
                className="h-11 rounded-xl px-6 shadow-glow"
              >
                <CalendarCheck className="size-4" />
                Book Now
              </Button>
              <Button
                render={<a href={`tel:${provider.phone}`} />}
                variant="outline"
                className="h-11 rounded-xl px-4"
              >
                <Phone className="size-4" />
                Call
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={share}
                aria-label="Share this profile"
                className="size-11 rounded-xl"
              >
                <Share2 className="size-4" />
              </Button>
            </div>

            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Star className="size-3 fill-warning text-warning" />
              {provider.bookingCount.toLocaleString()} bookings on Vesita
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
