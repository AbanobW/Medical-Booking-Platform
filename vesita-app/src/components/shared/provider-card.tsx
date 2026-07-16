"use client";

import Link from "next/link";
import { Clock, Heart, MapPin, Stethoscope } from "lucide-react";
import { useTranslations } from "next-intl";
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
import { getSpecialtyName } from "@/lib/data/egypt";
import { todayISO } from "@/lib/time";
import { orDash } from "@/lib/i18n/format";
import { useDomain, useFormat } from "@/lib/i18n/use-format";
import { cn } from "@/lib/utils";
import type { Provider } from "@/lib/types";

/** `now()` is the fixed dataset anchor — never `new Date()`. */
function isToday(date: string): boolean {
  return date === todayISO();
}

/**
 * The label under a provider's name: specialty for doctors, type otherwise.
 *
 * English-only — kept for non-React callers (sorting, exports, tests). Inside a
 * component use `useProviderSubtitle()`, which is locale-aware.
 */
export function providerSubtitle(provider: Provider): string {
  if (provider.type === "doctor") {
    return orDash(
      provider.specialtyId && getSpecialtyName(provider.specialtyId),
    );
  }
  return provider.type === "lab" ? "Medical Laboratory" : "Radiology Center";
}

/** The locale-aware version of `providerSubtitle`, for use inside components. */
export function useProviderSubtitle(): (provider: Provider) => string {
  const t = useTranslations("common");
  const { getSpecialtyName: specialtyName } = useDomain();

  return (provider: Provider) => {
    if (provider.type === "doctor") {
      return orDash(provider.specialtyId && specialtyName(provider.specialtyId));
    }
    return provider.type === "lab"
      ? t("providerCard.labSubtitle")
      : t("providerCard.radiologySubtitle");
  };
}

/** "Area, Governorate" — whichever halves the API answered. */
function useProviderLocation(): (provider: Provider) => string {
  const { getAreaName, getGovernorateName } = useDomain();

  return (provider: Provider) =>
    orDash(
      [
        provider.areaId && getAreaName(provider.areaId),
        provider.governorateId && getGovernorateName(provider.governorateId),
      ]
        .filter(Boolean)
        .join(", "),
    );
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
  const t = useTranslations("common");
  const { formatTime, relativeDay, formatEGP, initialsOf } = useFormat();
  const { named } = useDomain();
  const subtitleOf = useProviderSubtitle();
  const locationOf = useProviderLocation();
  const [favorite, setFavorite] = useState(isFavorite);
  const [isSaving, setIsSaving] = useState(false);

  const href = providerHref(provider);
  const name = named(provider);

  const { data: slots, isLoading: slotsLoading } = useAsync(
    () => (showSlots ? getNextSlots(provider.id, 3) : Promise.resolve([])),
    [provider.id, showSlots],
  );

  async function onToggleFavorite(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();

    if (!user) {
      toast.error(t("providerCard.favoriteSignIn"));
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
        result.isFavorite
          ? t("providerCard.favoriteAdded")
          : t("providerCard.favoriteRemoved"),
      );
    } catch {
      setFavorite(!next);
      toast.error(t("providerCard.favoriteFailed"));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <HoverLift className={className}>
      <Card className="group h-full overflow-hidden border-border/60 transition-shadow duration-300 hover:shadow-lift">
        <CardContent className="flex h-full flex-col gap-4 p-5">
          <div className="flex items-start gap-3.5">
            <Link href={href} className="shrink-0">
              <Avatar className="size-16 rounded-2xl ring-1 ring-border">
                <AvatarImage
                  src={provider.photo ?? undefined}
                  alt={name}
                  className="rounded-2xl object-cover"
                />
                <AvatarFallback className="rounded-2xl text-base font-semibold">
                  {initialsOf(name)}
                </AvatarFallback>
              </Avatar>
            </Link>

            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-2">
                <Link href={href} className="min-w-0 flex-1">
                  <h3 className="font-semibold leading-snug transition-colors group-hover:text-primary line-clamp-2">
                    {name}
                  </h3>
                </Link>

                <button
                  type="button"
                  onClick={onToggleFavorite}
                  disabled={isSaving}
                  aria-label={
                    favorite
                      ? t("providerCard.removeFavorite")
                      : t("providerCard.addFavorite")
                  }
                  aria-pressed={favorite}
                  className="-mt-1 -me-1 shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50"
                >
                  <Heart
                    className={cn(
                      "size-4 transition-all",
                      favorite && "fill-destructive text-destructive",
                    )}
                  />
                </button>
              </div>

              <Link href={href} className="mt-1 block">
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Stethoscope className="size-3.5 shrink-0" />
                  <span className="line-clamp-1">{subtitleOf(provider)}</span>
                </p>
              </Link>

              {/* Stars stand for a score — with no reviews endpoint there is
                  none to draw, so the badge is omitted rather than zeroed. */}
              {provider.rating !== null && provider.reviewCount !== null && (
                <RatingBadge
                  rating={provider.rating}
                  reviewCount={provider.reviewCount}
                  className="mt-1.5"
                />
              )}
            </div>
          </div>

          <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
            <MapPin className="mt-0.5 size-3.5 shrink-0" />
            <span className="line-clamp-1">{locationOf(provider)}</span>
          </p>

          {showSlots && (
            <div className="min-h-[3.75rem]">
              {slotsLoading ? (
                <div className="space-y-2 rounded-xl bg-muted/40 p-3">
                  <Skeleton className="h-3 w-32 rounded" />
                  <div className="flex gap-1.5">
                    <Skeleton className="h-6 w-24 rounded-lg" />
                    <Skeleton className="h-6 w-24 rounded-lg" />
                  </div>
                </div>
              ) : slots && slots.length > 0 ? (
                <div className="space-y-2 rounded-xl bg-muted/40 p-3">
                  {/*
                    §4 — search availability is an optimistic hint, not a promise.
                    "Likely available" keeps the label useful without letting it
                    read as a commitment the profile page may not honour.
                  */}
                  <p className="flex items-center gap-1.5 text-xs font-medium text-foreground/70">
                    <Clock className="size-3.5 text-primary" />
                    {isToday(slots[0].date)
                      ? t("providerCard.likelyAvailableToday")
                      : t("providerCard.likelyAvailable")}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {slots.map((slot) => (
                      <Badge
                        key={slot.id}
                        variant="secondary"
                        className="border border-border/60 bg-background font-normal text-foreground"
                      >
                        <span className="ltr-nums">
                          {relativeDay(slot.date)} · {formatTime(slot.time)}
                        </span>
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2 rounded-xl bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
                  <Clock className="mt-0.5 size-3.5 shrink-0" />
                  <span className="line-clamp-2">
                    {t("providerCard.noOpenSlots")}
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="mt-auto flex items-end justify-between gap-3 border-t pt-4">
            <div>
              <p className="text-xs text-muted-foreground">
                {provider.type === "doctor"
                  ? t("providerCard.consultationFee")
                  : t("providerCard.startingFrom")}
              </p>
              <p className="text-lg font-bold text-primary">
                {formatEGP(provider.price)}
              </p>
            </div>

            <Button
              render={<Link href={`/booking/${provider.slug}`} />}
              className="h-10 rounded-xl px-4"
            >
              {t("actions.bookNow")}
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
  const t = useTranslations("common");
  const { formatEGP, initialsOf } = useFormat();
  const { named } = useDomain();
  const subtitleOf = useProviderSubtitle();

  const href = providerHref(provider);
  const name = named(provider);

  return (
    <Card className="transition-shadow hover:shadow-card">
      <CardContent className="flex items-center gap-4 p-4">
        <Link href={href} className="shrink-0">
          <Avatar className="size-14 rounded-xl ring-1 ring-border">
            <AvatarImage
              src={provider.photo ?? undefined}
              alt={name}
              className="rounded-xl object-cover"
            />
            <AvatarFallback className="rounded-xl">
              {initialsOf(name)}
            </AvatarFallback>
          </Avatar>
        </Link>

        <div className="min-w-0 flex-1">
          <Link href={href}>
            <h4 className="truncate font-medium hover:text-primary">{name}</h4>
          </Link>
          <p className="truncate text-sm text-muted-foreground">
            {subtitleOf(provider)}
          </p>
          {provider.rating !== null && provider.reviewCount !== null && (
            <RatingBadge
              rating={provider.rating}
              reviewCount={provider.reviewCount}
              className="mt-1"
            />
          )}
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
              {t("providerCard.book")}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
