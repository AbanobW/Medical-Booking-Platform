"use client";

import Link from "next/link";
import { Clock, Heart, MapPin, Stethoscope } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { RatingBadge } from "@/components/shared/rating";
import { HoverLift } from "@/components/shared/motion";
import { useAuth } from "@/components/providers/auth-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAsync } from "@/hooks/use-async";
import { getNextSlots } from "@/lib/api/providers";
import { toggleFavorite } from "@/lib/api/engagement";
import { getAreaName, getGovernorateName, getSpecialtyName } from "@/lib/data/egypt";
import { todayISO } from "@/lib/data/seed";
import { formatTime, initialsOf, relativeDay } from "@/lib/format";
import { formatEGP } from "@/lib/site";
import { cn } from "@/lib/utils";
import type { Provider } from "@/lib/types";

/** `TODAY` is the fixed dataset anchor — never `new Date()`. */
function isToday(date: string): boolean {
  return date === todayISO();
}

/** The label under a provider's name: specialty for doctors, type otherwise. */
export function providerSubtitle(provider: Provider): string {
  if (provider.type === "doctor") return getSpecialtyName(provider.specialtyId);
  return provider.type === "lab" ? "Medical Laboratory" : "Radiology Center";
}

export function providerHref(provider: Provider): string {
  const segment =
    provider.type === "doctor"
      ? "doctors"
      : provider.type === "lab"
        ? "labs"
        : "radiology";
  return `/${segment}/${provider.slug}`;
}

interface ProviderCardProps {
  provider: Provider;
  /** Fetches and shows the next few open slots. Off in dense grids. */
  showSlots?: boolean;
  isFavorite?: boolean;
  onFavoriteChange?: (providerId: string, isFavorite: boolean) => void;
  className?: string;
}

export function ProviderCard({
  provider,
  showSlots = true,
  isFavorite = false,
  onFavoriteChange,
  className,
}: ProviderCardProps) {
  const { user } = useAuth();
  const [favorite, setFavorite] = useState(isFavorite);
  const [isSaving, setIsSaving] = useState(false);

  const href = providerHref(provider);

  const { data: slots, isLoading: slotsLoading } = useAsync(
    () => (showSlots ? getNextSlots(provider.id, 3) : Promise.resolve([])),
    [provider.id, showSlots],
  );

  async function onToggleFavorite(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();

    if (!user) {
      toast.error("Sign in to save providers to your favorites.");
      return;
    }

    setIsSaving(true);
    // Optimistic — revert if the call fails.
    const next = !favorite;
    setFavorite(next);

    try {
      const result = await toggleFavorite(user.id, provider.id);
      setFavorite(result.isFavorite);
      onFavoriteChange?.(provider.id, result.isFavorite);
      toast.success(
        result.isFavorite ? "Added to favorites" : "Removed from favorites",
      );
    } catch {
      setFavorite(!next);
      toast.error("Couldn't update your favorites. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <HoverLift className={className}>
      <Card className="group h-full overflow-hidden border-border/60 transition-shadow duration-300 hover:shadow-lift">
        <CardContent className="flex h-full flex-col gap-4 p-5">
          <div className="flex items-start gap-4">
            <Link href={href} className="shrink-0">
              <Avatar className="size-20 rounded-2xl ring-1 ring-border">
                <AvatarImage
                  src={provider.photo}
                  alt={provider.name}
                  className="rounded-2xl object-cover"
                />
                <AvatarFallback className="rounded-2xl text-lg font-semibold">
                  {initialsOf(provider.name)}
                </AvatarFallback>
              </Avatar>
            </Link>

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <Link href={href} className="min-w-0">
                  <h3 className="truncate font-semibold leading-tight transition-colors group-hover:text-primary">
                    {provider.name}
                  </h3>
                  <p className="mt-0.5 flex items-center gap-1 truncate text-sm text-muted-foreground">
                    <Stethoscope className="size-3.5 shrink-0" />
                    {providerSubtitle(provider)}
                  </p>
                </Link>

                <button
                  type="button"
                  onClick={onToggleFavorite}
                  disabled={isSaving}
                  aria-label={
                    favorite ? "Remove from favorites" : "Add to favorites"
                  }
                  aria-pressed={favorite}
                  className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50"
                >
                  <Heart
                    className={cn(
                      "size-4 transition-all",
                      favorite && "fill-destructive text-destructive",
                    )}
                  />
                </button>
              </div>

              <RatingBadge
                rating={provider.rating}
                reviewCount={provider.reviewCount}
                className="mt-1.5"
              />
            </div>
          </div>

          <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
            <MapPin className="mt-0.5 size-3.5 shrink-0" />
            <span className="line-clamp-1">
              {getAreaName(provider.areaId)}, {getGovernorateName(provider.governorateId)}
            </span>
          </p>

          {showSlots && (
            <div className="min-h-[3.25rem]">
              {slotsLoading ? (
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-24 rounded-lg" />
                  <Skeleton className="h-8 w-24 rounded-lg" />
                </div>
              ) : slots && slots.length > 0 ? (
                <div className="space-y-1.5">
                  {/*
                    §4 — search availability is an optimistic hint, not a promise.
                    "Likely available" keeps the label useful without letting it
                    read as a commitment the profile page may not honour.
                  */}
                  <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                    <Clock className="size-3" />
                    {isToday(slots[0].date)
                      ? "Likely available today"
                      : "Likely available"}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {slots.map((slot) => (
                      <Badge
                        key={slot.id}
                        variant="secondary"
                        className="bg-accent font-normal text-accent-foreground"
                      >
                        {relativeDay(slot.date)} · {formatTime(slot.time)}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Likely nothing open in the next 2 weeks — check the profile to be
                  sure.
                </p>
              )}
            </div>
          )}

          <div className="mt-auto flex items-end justify-between gap-3 border-t pt-4">
            <div>
              <p className="text-xs text-muted-foreground">
                {provider.type === "doctor" ? "Consultation fee" : "Starting from"}
              </p>
              <p className="text-lg font-bold text-primary">
                {formatEGP(provider.price)}
              </p>
            </div>

            <Button
              render={<Link href={`/booking/${provider.slug}`} />}
              className="h-10 rounded-xl px-4"
            >
              Book Now
            </Button>
          </div>
        </CardContent>
      </Card>
    </HoverLift>
  );
}

/** Compact horizontal variant — used in favorites lists and "nearby" rails. */
export function ProviderCardCompact({
  provider,
  action,
}: {
  provider: Provider;
  action?: React.ReactNode;
}) {
  const href = providerHref(provider);

  return (
    <Card className="transition-shadow hover:shadow-card">
      <CardContent className="flex items-center gap-4 p-4">
        <Link href={href} className="shrink-0">
          <Avatar className="size-14 rounded-xl ring-1 ring-border">
            <AvatarImage
              src={provider.photo}
              alt={provider.name}
              className="rounded-xl object-cover"
            />
            <AvatarFallback className="rounded-xl">
              {initialsOf(provider.name)}
            </AvatarFallback>
          </Avatar>
        </Link>

        <div className="min-w-0 flex-1">
          <Link href={href}>
            <h4 className="truncate font-medium hover:text-primary">
              {provider.name}
            </h4>
          </Link>
          <p className="truncate text-sm text-muted-foreground">
            {providerSubtitle(provider)}
          </p>
          <RatingBadge
            rating={provider.rating}
            reviewCount={provider.reviewCount}
            className="mt-1"
          />
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <span className="font-semibold text-primary">
            {formatEGP(provider.price)}
          </span>
          {action ?? (
            <Button
              render={<Link href={`/booking/${provider.slug}`} />}
              size="sm"
              variant="outline"
              className="rounded-lg"
            >
              Book
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
