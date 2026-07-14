"use client";

import Link from "next/link";
import {
  BadgeCheck,
  CalendarCheck,
  Clock,
  MapPin,
  Phone,
  Share2,
  Star,
  Timer,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import CountUp from "@/components/reactbits/CountUp";
import SpotlightCard from "@/components/reactbits/SpotlightCard";
import { RatingStars } from "@/components/shared/rating";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDomain, useFormat } from "@/lib/i18n/use-format";
import type { Provider } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Cover + identity + booking CTA. Shared by the doctor, lab and radiology
 * profiles.
 *
 * Everything sits inside one elevated card that overlaps the cover, rather than
 * as separate blocks floating on it. Previously the price and the CTA drifted to
 * the far edge of a full-width row, so on a wide screen they read as unrelated to
 * the doctor they belonged to — and the price was then repeated by the sticky
 * booking card a few hundred pixels below.
 *
 * The React Bits pieces (reactbits.dev): `SpotlightCard` for the booking panel,
 * and `CountUp` for the figures in the trust strip.
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
  const t = useTranslations("profile");
  const tCommon = useTranslations("common");
  const { formatDuration, formatEGP, initialsOf, formatNumber } = useFormat();
  const { named, getAreaName, getGovernorateName } = useDomain();

  const name = named(provider);
  const isDoctor = provider.type === "doctor";

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
      {/* Cover — a local SVG API route, so next/image optimization is pointless. */}
      <div className="relative h-40 w-full overflow-hidden bg-muted sm:h-52 lg:h-64">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={provider.coverImage}
          alt=""
          aria-hidden
          className="size-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
      </div>

      {/* `relative` is load-bearing: the cover above is positioned, so without it
          the cover paints over this block and hides the card pulled under it. */}
      <div className="relative z-10 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="-mt-20 rounded-3xl border bg-card/95 p-5 shadow-lift backdrop-blur sm:-mt-24 sm:p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
            {/* Identity */}
            <div className="flex min-w-0 flex-1 flex-col gap-5 sm:flex-row">
              <div className="size-24 shrink-0 overflow-hidden rounded-2xl border-4 border-background bg-muted shadow-lift sm:size-32">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={provider.photo}
                  alt={name}
                  className="size-full object-cover"
                  onError={(event) => {
                    event.currentTarget.style.display = "none";
                  }}
                />
                <span className="sr-only">{initialsOf(name)}</span>
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                    {name}
                  </h1>
                  {provider.status === "approved" && (
                    <Badge
                      variant="secondary"
                      className="gap-1 rounded-full font-normal text-success"
                    >
                      <BadgeCheck className="size-3.5" />
                      {t("hero.verified")}
                    </Badge>
                  )}
                </div>

                <p className="mt-1 text-sm text-muted-foreground sm:text-base">
                  {subtitle}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="size-3.5 shrink-0" />
                    {getAreaName(provider.areaId)},{" "}
                    {getGovernorateName(provider.governorateId)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="size-3.5 shrink-0" />
                    {t("hero.wait", {
                      duration: formatDuration(provider.waitingTimeMinutes),
                    })}
                  </span>
                </div>

                {chips && chips.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {chips.map((chip) => (
                      <Badge
                        key={chip}
                        variant="secondary"
                        className="font-normal"
                      >
                        {chip}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/*
              Booking — the mobile half of a pair.

              The page also has a `lg:sticky` booking card in its sidebar. Both
              used to render at once, so the price and "Book now" appeared twice
              on screen, one under the other. They are now mutually exclusive:
              this one carries the CTA below `lg`, where the sidebar stacks far
              below the tab content and is useless above the fold; from `lg` up
              the sticky card takes over, because it follows the reader down a
              long page and this one would not.
            */}
            <SpotlightCard
              spotlightColor="rgba(56, 148, 255, 0.16)"
              className="w-full shrink-0 rounded-2xl border-border bg-muted/40 p-5 lg:hidden"
            >
              <p className="text-xs text-muted-foreground">{priceLabel}</p>
              <p className="mt-0.5 text-3xl font-bold text-primary ltr-nums">
                {formatEGP(provider.price)}
              </p>

              <Button
                render={<Link href={`/booking/${provider.slug}`} />}
                className="mt-4 h-11 w-full rounded-xl shadow-glow"
              >
                <CalendarCheck className="size-4" />
                {tCommon("actions.bookNow")}
              </Button>

              <div className="mt-2 flex gap-2">
                <Button
                  render={<a href={`tel:${provider.phone}`} />}
                  variant="outline"
                  className="h-10 flex-1 rounded-xl"
                >
                  <Phone className="size-4" />
                  {t("hero.call")}
                </Button>
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

              <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Timer className="size-3.5 shrink-0" />
                {t("hero.freeCancellation")}
              </p>
            </SpotlightCard>
          </div>

          {/*
            Trust strip. The figures count up, but they are also the page's key
            facts, so each is rendered as text a screen reader can read straight
            through — the counter is decorative motion over a real number.
          */}
          <dl className="mt-6 grid grid-cols-2 gap-4 border-t pt-5 sm:grid-cols-4">
            <Stat label={t("hero.stats.rating")}>
              <span className="flex items-center gap-2">
                <span className="ltr-nums text-xl font-bold tabular-nums sm:text-2xl">
                  <CountUp to={provider.rating} duration={0.9} />
                </span>
                <RatingStars value={provider.rating} size="sm" />
              </span>
            </Stat>

            <Stat label={t("hero.stats.reviews")}>
              <span className="ltr-nums text-xl font-bold tabular-nums sm:text-2xl">
                <CountUp to={provider.reviewCount} separator="," duration={0.9} />
              </span>
            </Stat>

            {isDoctor && (
              <Stat label={t("hero.stats.experience")}>
                <span className="ltr-nums text-xl font-bold tabular-nums sm:text-2xl">
                  <CountUp to={provider.yearsOfExperience} duration={0.9} />
                </span>
              </Stat>
            )}

            <Stat
              label={t("hero.stats.bookings")}
              className={cn(!isDoctor && "sm:col-span-2")}
            >
              <span className="flex items-center gap-1.5">
                <Star className="size-4 shrink-0 fill-warning text-warning" />
                <span className="ltr-nums text-xl font-bold tabular-nums sm:text-2xl">
                  <CountUp
                    to={provider.bookingCount}
                    separator=","
                    duration={0.9}
                  />
                </span>
              </span>
              <span className="sr-only">
                {formatNumber(provider.bookingCount)}
              </span>
            </Stat>
          </dl>
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
