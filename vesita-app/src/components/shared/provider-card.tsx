"use client";

import Link from "next/link";
import {
  FlaskConical,
  Heart,
  MapPin,
  ScanLine,
  Star,
  Stethoscope,
} from "lucide-react";
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
import { orDash } from "@/lib/i18n/format";
import { useFormat } from "@/lib/i18n/use-format";
import { cn } from "@/lib/utils";
import type { Doctor, Provider, ProviderRole } from "@/lib/types";

/** Specialty and subspecialty as the API sent them — no static taxonomy lookups. */
function providerTypeIcon(type: ProviderRole) {
  if (type === "lab") return FlaskConical;
  if (type === "radiology") return ScanLine;
  return Stethoscope;
}

export function apiDoctorTaxonomy(doctor: Doctor): {
  specialty: string | null;
  subspecialty: string | null;
} {
  return {
    specialty: doctor.specialtyLabel,
    subspecialty: doctor.subSpecialties[0] ?? null,
  };
}

export function providerSubtitle(provider: Provider): string {
  if (provider.type === "doctor") {
    const { specialty, subspecialty } = apiDoctorTaxonomy(provider);
    if (specialty && subspecialty) return `${specialty} · ${subspecialty}`;
    return specialty ?? subspecialty ?? "";
  }
  return provider.type;
}

/** API-sourced subtitle for use inside components. */
export function useProviderSubtitle(): (provider: Provider) => string {
  return (provider: Provider) => orDash(providerSubtitle(provider) || null);
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

function ProviderMetaPills({ provider }: { provider: Provider }) {
  const TypeIcon = providerTypeIcon(provider.type);

  if (provider.type === "doctor") {
    const { specialty, subspecialty } = apiDoctorTaxonomy(provider);
    if (!specialty && !subspecialty) return null;

    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {specialty && (
          <Badge className="gap-1 rounded-lg bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary hover:bg-primary/10">
            <Stethoscope className="size-3 shrink-0" />
            <span className="line-clamp-1">{specialty}</span>
          </Badge>
        )}
        {subspecialty && (
          <Badge
            variant="outline"
            className="rounded-lg px-2 py-0.5 text-xs font-normal text-foreground/80"
          >
            <span className="line-clamp-1">{subspecialty}</span>
          </Badge>
        )}
      </div>
    );
  }

  return (
    <Badge
      variant="secondary"
      className="gap-1 rounded-lg px-2 py-0.5 text-xs font-medium capitalize"
    >
      <TypeIcon className="size-3 shrink-0" />
      <span>{provider.type}</span>
    </Badge>
  );
}

function ProviderRatingRow({
  rating,
  reviewCount,
  className,
}: {
  rating: number | null;
  reviewCount: number | null;
  className?: string;
}) {
  const t = useTranslations("common");

  if (reviewCount === null && rating === null) return null;

  if (rating !== null) {
    return (
      <RatingBadge
        rating={rating}
        reviewCount={reviewCount ?? 0}
        size="sm"
        className={className}
      />
    );
  }

  return (
    <div
      className={cn("flex items-center gap-2", className)}
      aria-label={t("rating.reviewCount", { count: reviewCount ?? 0 })}
    >
      <div className="flex items-center gap-0.5" aria-hidden>
        {[0, 1, 2, 3, 4].map((i) => (
          <Star key={i} className="size-3.5 text-muted-foreground/25" />
        ))}
      </div>
      <span className="text-xs tabular-nums text-muted-foreground ltr-nums">
        {reviewCount ?? 0}
      </span>
    </div>
  );
}

function FavoriteButton({
  favorite,
  isSaving,
  onToggle,
}: {
  favorite: boolean;
  isSaving: boolean;
  onToggle: (event: React.MouseEvent) => void;
}) {
  const t = useTranslations("common");

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={isSaving}
      aria-label={
        favorite ? t("providerCard.removeFavorite") : t("providerCard.addFavorite")
      }
      aria-pressed={favorite}
      className="shrink-0 rounded-xl p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50"
    >
      <Heart
        className={cn(
          "size-4 transition-all",
          favorite && "fill-destructive text-destructive",
        )}
      />
    </button>
  );
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
  const [favorite, setFavorite] = useState(isFavorite);
  const [isSaving, setIsSaving] = useState(false);

  const href = providerHref(provider);
  const address = provider.address?.trim() || null;

  const { data: slots, isLoading: slotsLoading } = useAsync(
    () => (showSlots ? getNextSlots(provider.id, 3) : Promise.resolve([])),
    [provider.id, showSlots],
  );

  const hasSlots =
    showSlots && (slotsLoading || (slots !== undefined && slots.length > 0));

  async function onToggleFavorite(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();

    if (!user) {
      toast.error(t("providerCard.favoriteSignIn"));
      return;
    }

    setIsSaving(true);
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
        <CardContent className="flex h-full flex-col gap-0 p-0">
          <div className="flex gap-4 p-5">
            <Link href={href} className="shrink-0">
              <Avatar className="size-[4.5rem] rounded-2xl ring-2 ring-border/60">
                {provider.photo && (
                  <AvatarImage
                    src={provider.photo}
                    alt={provider.name}
                    className="rounded-2xl object-cover"
                  />
                )}
                <AvatarFallback className="rounded-2xl bg-primary/5 text-base font-semibold text-primary">
                  {initialsOf(provider.name)}
                </AvatarFallback>
              </Avatar>
            </Link>

            <div className="flex min-w-0 flex-1 flex-col gap-2.5">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <Link href={href}>
                    <h3 className="text-base font-semibold leading-snug transition-colors group-hover:text-primary line-clamp-2">
                      {provider.name}
                    </h3>
                  </Link>
                </div>

                <FavoriteButton
                  favorite={favorite}
                  isSaving={isSaving}
                  onToggle={onToggleFavorite}
                />
              </div>

              <ProviderMetaPills provider={provider} />

              <ProviderRatingRow
                rating={provider.rating}
                reviewCount={provider.reviewCount}
              />

              {address && (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="size-3 shrink-0" />
                  <span className="line-clamp-1">{address}</span>
                </p>
              )}
            </div>
          </div>

          {hasSlots && (
            <div className="border-t border-border/50 bg-muted/20 px-5 py-3">
              {slotsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-3 w-36 rounded" />
                  <div className="flex gap-1.5">
                    <Skeleton className="h-7 w-24 rounded-lg" />
                    <Skeleton className="h-7 w-24 rounded-lg" />
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {slots?.map((slot) => (
                    <Badge
                      key={slot.id}
                      variant="secondary"
                      className="border border-border/60 bg-background font-normal text-foreground"
                    >
                      <span className="ltr-nums text-xs">
                        {relativeDay(slot.date)} · {formatTime(slot.time)}
                      </span>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="mt-auto flex items-center justify-between gap-3 border-t px-5 py-4">
            {provider.price !== null ? (
              <p className="text-xl font-bold tabular-nums text-primary">
                {formatEGP(provider.price)}
              </p>
            ) : (
              <span />
            )}

            <Button
              render={<Link href={`/booking/${provider.slug}`} />}
              className="h-10 rounded-xl px-5"
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

  const href = providerHref(provider);

  return (
    <Card className="overflow-hidden border-border/60 transition-shadow hover:shadow-card">
      <CardContent className="flex items-center gap-3.5 p-4">
        <Link href={href} className="shrink-0">
          <Avatar className="size-12 rounded-xl ring-1 ring-border">
            {provider.photo && (
              <AvatarImage
                src={provider.photo}
                alt={provider.name}
                className="rounded-xl object-cover"
              />
            )}
            <AvatarFallback className="rounded-xl bg-primary/5 text-sm font-semibold text-primary">
              {initialsOf(provider.name)}
            </AvatarFallback>
          </Avatar>
        </Link>

        <div className="min-w-0 flex-1 space-y-1.5">
          <Link href={href}>
            <h4 className="truncate font-semibold hover:text-primary">
              {provider.name}
            </h4>
          </Link>

          <ProviderMetaPills provider={provider} />

          <ProviderRatingRow
            rating={provider.rating}
            reviewCount={provider.reviewCount}
          />
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          {provider.price !== null && (
            <span className="text-sm font-bold tabular-nums text-primary">
              {formatEGP(provider.price)}
            </span>
          )}
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
