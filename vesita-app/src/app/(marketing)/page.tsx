"use client";

import Link from "next/link";
import {
  BadgeCheck,
  CalendarCheck,
  CreditCard,
  Quote,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Stethoscope,
  Wallet,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Hero } from "@/components/marketing/hero";
import { ProviderRail } from "@/components/marketing/provider-rail";
import { SectionHeading } from "@/components/marketing/section-heading";
import { SpecialtiesGrid } from "@/components/marketing/specialties-grid";
import { Reveal, RevealItem } from "@/components/shared/motion";
import { RatingStars } from "@/components/shared/rating";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SITE } from "@/lib/site";

/** Message keys only — every string is resolved through the `home` namespace. */
const HOW_IT_WORKS = [
  { key: "search", icon: Search },
  { key: "slot", icon: CalendarCheck },
  { key: "confirm", icon: BadgeCheck },
  { key: "visit", icon: Wallet },
] as const;

const VALUE_PROPS = [
  { key: "verified", icon: ShieldCheck },
  { key: "pricing", icon: CreditCard },
  { key: "reviews", icon: Sparkles },
] as const;

const TESTIMONIALS = [
  { key: "mariam", rating: 5 },
  { key: "ahmed", rating: 5 },
  { key: "nourhan", rating: 4 },
  { key: "karim", rating: 5 },
  { key: "salma", rating: 5 },
  { key: "youssef", rating: 4 },
] as const;

const FAQS = [
  "free",
  "verification",
  "cancel",
  "payment",
  "cashback",
  "homeCollection",
] as const;

export default function HomePage() {
  const t = useTranslations("home");

  return (
    <>
      {/* ---------------------------------------------------------------- Hero */}
      <Hero />

      {/* --------------------------------------------------------- Value props */}
      <section className="border-b bg-card py-10">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal className="grid gap-6 md:grid-cols-3">
            {VALUE_PROPS.map(({ key, icon: Icon }) => (
              <RevealItem key={key} className="flex items-start gap-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-primary">
                  <Icon className="size-5" />
                </span>
                <div>
                  <h3 className="font-semibold">{t(`valueProps.${key}.title`)}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t(`valueProps.${key}.description`)}
                  </p>
                </div>
              </RevealItem>
            ))}
          </Reveal>
        </div>
      </section>

      {/* -------------------------------------------------------- Specialties */}
      <SpecialtiesGrid />

      {/* ------------------------------------------------------ Featured rails */}
      <div className="bg-muted/40">
        <ProviderRail
          type="doctor"
          eyebrow={t("rails.doctors.eyebrow")}
          title={t("rails.doctors.title")}
          description={t("rails.doctors.description")}
        />
      </div>

      <ProviderRail
        type="lab"
        eyebrow={t("rails.labs.eyebrow")}
        title={t("rails.labs.title")}
        description={t("rails.labs.description")}
      />

      <div className="bg-muted/40">
        <ProviderRail
          type="radiology"
          eyebrow={t("rails.radiology.eyebrow")}
          title={t("rails.radiology.title")}
          description={t("rails.radiology.description")}
        />
      </div>

      {/* ------------------------------------------------------- How it works */}
      <section className="py-14 sm:py-20">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            align="center"
            eyebrow={t("howItWorks.eyebrow")}
            title={t("howItWorks.title")}
            description={t("howItWorks.description")}
          />

          <Reveal className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {HOW_IT_WORKS.map(({ key, icon: Icon }, index) => (
              <RevealItem key={key}>
                <Card className="relative h-full border-border/60">
                  <CardContent className="space-y-3 pt-2">
                    <span className="absolute top-4 end-5 text-4xl font-bold text-muted-foreground/15 tabular-nums">
                      {index + 1}
                    </span>
                    <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Icon className="size-6" />
                    </span>
                    <h3 className="font-semibold">{t(`howItWorks.${key}.title`)}</h3>
                    <p className="text-sm text-muted-foreground">
                      {t(`howItWorks.${key}.description`)}
                    </p>
                  </CardContent>
                </Card>
              </RevealItem>
            ))}
          </Reveal>
        </div>
      </section>

      {/* -------------------------------------------------------- Testimonials */}
      <section className="bg-muted/40 py-14 sm:py-20">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            align="center"
            eyebrow={t("testimonials.eyebrow")}
            title={t("testimonials.title")}
            description={t("testimonials.description")}
          />

          <Reveal className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {TESTIMONIALS.map(({ key, rating }) => (
              <RevealItem key={key}>
                <Card className="h-full border-border/60">
                  <CardContent className="flex h-full flex-col gap-4">
                    <Quote
                      className="size-6 text-primary/30 rtl:-scale-x-100"
                      aria-hidden
                    />
                    <p className="flex-1 text-sm leading-relaxed text-foreground/90">
                      {t(`testimonials.items.${key}.quote`)}
                    </p>
                    <div className="border-t pt-4">
                      <RatingStars value={rating} size="sm" precise={false} />
                      <p className="mt-2 text-sm font-semibold">
                        {t(`testimonials.items.${key}.name`)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t(`testimonials.items.${key}.location`)}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </RevealItem>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ----------------------------------------------------------------- FAQ */}
      <section className="py-14 sm:py-20">
        <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            align="center"
            eyebrow={t("faq.eyebrow")}
            title={t("faq.title")}
            description={t("faq.description", { phone: SITE.supportPhone })}
          />

          <Reveal>
            <RevealItem>
              <div className="rounded-2xl border bg-card px-5 shadow-soft">
                <Accordion>
                  {FAQS.map((key) => (
                    <AccordionItem key={key} value={key}>
                      <AccordionTrigger className="py-4 text-base font-medium">
                        {t(`faq.items.${key}.q`)}
                      </AccordionTrigger>
                      <AccordionContent className="pe-8 pb-4 text-sm leading-relaxed text-muted-foreground">
                        {t(`faq.items.${key}.a`)}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            </RevealItem>
          </Reveal>
        </div>
      </section>

      {/* ----------------------------------------------------------- Final CTA */}
      <section className="pb-20">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal>
            <RevealItem>
              <div className="relative overflow-hidden rounded-3xl bg-brand-gradient px-6 py-14 text-center shadow-lift sm:px-12">
                <div
                  className="absolute inset-0 bg-grid-pattern opacity-20"
                  aria-hidden
                />
                <div className="relative mx-auto max-w-2xl">
                  <Star className="mx-auto mb-4 size-8 fill-white/90 text-white/90" />
                  <h2 className="text-2xl font-bold text-balance text-white sm:text-3xl">
                    {t("cta.title")}
                  </h2>
                  <p className="mt-3 text-pretty text-white/85">{t("cta.description")}</p>
                  <div className="mt-7 flex flex-wrap justify-center gap-3">
                    <Button
                      render={<Link href="/search?type=doctor" />}
                      className="h-11 rounded-xl bg-white px-6 text-primary hover:bg-white/90"
                    >
                      <Stethoscope className="size-4" />
                      {t("cta.findDoctor")}
                    </Button>
                    <Button
                      render={<Link href="/search?type=lab" />}
                      variant="outline"
                      className="h-11 rounded-xl border-white/40 bg-white/10 px-6 text-white backdrop-blur hover:bg-white/20 hover:text-white"
                    >
                      <Search className="size-4" />
                      {t("cta.bookTest")}
                    </Button>
                  </div>
                </div>
              </div>
            </RevealItem>
          </Reveal>
        </div>
      </section>
    </>
  );
}
