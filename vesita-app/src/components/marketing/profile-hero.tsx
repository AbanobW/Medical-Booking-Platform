"use client";

import Link from "next/link";
import {
  CalendarCheck,
  MapPin,
  Phone,
  Share2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import CountUp from "@/components/reactbits/CountUp";
import SpotlightCard from "@/components/reactbits/SpotlightCard";
import { RatingStars } from "@/components/shared/rating";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useFormat } from "@/lib/i18n/use-format";
import type { Provider } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Cover + identity + booking CTA. Shared by doctor, lab and radiology profiles.
 *
 * Renders only fields the API answered — no static taxonomy lookups, no invented
 * subtitles, and no stats the wire does not carry.
 */
export function ProfileHero({
  provider,
  subtitle,
  chips,
}: {
  provider: Provider;
  /** API-sourced line under the name (specialty, provider_type, …). */
  subtitle?: string | null;
  /** Extra API strings — additional subspecialties, accreditations, etc. */
  chips?: string[];
}) {
  const t = useTranslations("profile");
  const tCommon = useTranslations("common");
  const { formatEGP, initialsOf } = useFormat();

  const name = provider.name;
  const address = provider.address?.trim() || null;
  const hasRating = provider.rating !== null || provider.reviewCount !== null;
  const apiChips = chips?.filter(Boolean) ?? [];

  async function share() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: name, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success(t("hero.shareCopied"));
    } catch {
      toast.error(t("hero.shareFailed"));
    }
  }

  return (
    <section className="relative">
      <div className="relative h-40 w-full overflow-hidden bg-muted sm:h-52 lg:h-64">
        {provider.coverImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={provider.coverImage}
            alt=""
            aria-hidden
            className="size-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="-mt-20 rounded-3xl border bg-card/95 p-5 shadow-lift backdrop-blur sm:-mt-24 sm:p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
            <div className="flex min-w-0 flex-1 flex-col gap-5 sm:flex-row">
              <div className="size-24 shrink-0 overflow-hidden rounded-2xl border-4 border-background bg-muted shadow-lift sm:size-32">
                {provider.photo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={provider.photo}
                    alt={name}
                    className="size-full object-cover"
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                    }}
                  />
                )}
                <span className="sr-only">{initialsOf(name)}</span>
              </div>

              <div className="min-w-0">
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  {name}
                </h1>

                {subtitle && (
                  <p className="mt-1 text-sm text-muted-foreground sm:text-base">
                    {subtitle}
                  </p>
                )}

                {address && (
                  <p className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="size-3.5 shrink-0" />
                    {address}
                  </p>
                )}

                {apiChips.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {apiChips.map((chip) => (
                      <Badge
                        key={chip}
                        variant="outline"
                        className="font-normal"
                      >
                        {chip}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {(provider.price !== null || provider.phone) && (
              <SpotlightCard
                spotlightColor="rgba(56, 148, 255, 0.16)"
                className="w-full shrink-0 rounded-2xl border-border bg-muted/40 p-5 lg:hidden"
              >
                {provider.price !== null && (
                  <p className="text-3xl font-bold text-primary tabular-nums ltr-nums">
                    {formatEGP(provider.price)}
                  </p>
                )}

                <Button
                  render={<Link href={`/booking/${provider.slug}`} />}
                  className={cn(
                    "h-11 w-full rounded-xl shadow-glow",
                    provider.price !== null && "mt-4",
                  )}
                >
                  <CalendarCheck className="size-4" />
                  {tCommon("actions.bookNow")}
                </Button>

                <div className="mt-2 flex gap-2">
                  {provider.phone && (
                    <Button
                      render={<a href={`tel:${provider.phone}`} />}
                      variant="outline"
                      className="h-10 flex-1 rounded-xl"
                    >
                      <Phone className="size-4" />
                      {t("hero.call")}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={share}
                    aria-label={t("hero.share")}
                    className="size-10 shrink-0 rounded-xl"
                  >
                    <Share2 className="size-4" />
                  </Button>
                </div>
              </SpotlightCard>
            )}
          </div>

          {hasRating && (
            <dl className="mt-6 grid grid-cols-2 gap-4 border-t pt-5">
              <Stat label={t("hero.stats.rating")}>
                <span className="flex items-center gap-2">
                  <span className="text-xl font-bold tabular-nums ltr-nums sm:text-2xl">
                    {provider.rating !== null ? (
                      <CountUp to={provider.rating} duration={0.9} />
                    ) : (
                      "—"
                    )}
                  </span>
                  {provider.rating !== null && (
                    <RatingStars value={provider.rating} size="sm" />
                  )}
                </span>
              </Stat>

              <Stat label={t("hero.stats.reviews")}>
                <span className="text-xl font-bold tabular-nums ltr-nums sm:text-2xl">
                  {provider.reviewCount !== null ? (
                    <CountUp
                      to={provider.reviewCount}
                      separator=","
                      duration={0.9}
                    />
                  ) : (
                    "—"
                  )}
                </span>
              </Stat>
            </dl>
          )}
        </div>
      </div>
    </section>
  );
}

function Stat({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <dd className="flex items-center">{children}</dd>
      <dt className="mt-0.5 truncate text-xs text-muted-foreground">{label}</dt>
    </div>
  );
}
