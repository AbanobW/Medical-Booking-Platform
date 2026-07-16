"use client";

import { Sparkles } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import Aurora from "@/components/reactbits/Aurora";
import BlurText from "@/components/reactbits/BlurText";
import { Reveal, RevealItem } from "@/components/shared/motion";
import { SearchBar } from "@/components/shared/search-bar";
import { Badge } from "@/components/ui/badge";

/**
 * The landing hero.
 *
 * The moving parts are React Bits components (reactbits.dev): an `Aurora` WebGL
 * field behind the brand gradient, `BlurText` for the headline.
 *
 * Two things constrain how they can be used here:
 *
 *  - **Arabic is cursive.** `BlurText` can split by word or by letter; letters
 *    would cut each word into unjoined glyphs and render Arabic as nonsense, so
 *    the split is pinned to words in both languages.
 *  - **Motion is optional.** Aurora is a WebGL canvas and BlurText animates on
 *    scroll; under `prefers-reduced-motion` both are dropped for the static
 *    gradient and plain text.
 */

/** Brand blues → teal. Decorative only; the chart ramp is not for backgrounds. */
const AURORA_COLORS = ["#0EA5E9", "#2563EB", "#14B8A6"];

export function Hero() {
  const t = useTranslations("home");
  const reduceMotion = useReducedMotion();

  /*
   * `useReducedMotion` can only know the answer in the browser, so the server
   * and the first client render must not depend on it — branching on it directly
   * renders Aurora on the server and not on the client, and hydration fails.
   *
   * So the server always emits the still version: no canvas, plain heading. That
   * is also the correct no-JS output. Once mounted, a client that permits motion
   * upgrades to Aurora + BlurText, and one that doesn't simply stays as it is.
   */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const animate = mounted && !reduceMotion;

  const title = t("hero.title");

  return (
    <section className="relative isolate overflow-hidden bg-brand-gradient">
      {/*
        The gradient stays underneath as the real background: Aurora is a canvas
        that can fail to acquire a WebGL context, and the hero's white text must
        never be left sitting on a blank element.
      */}
      {animate && (
        <div className="absolute inset-0 opacity-60 mix-blend-screen" aria-hidden>
          <Aurora colorStops={AURORA_COLORS} amplitude={1.1} blend={0.55} speed={0.7} />
        </div>
      )}

      <div className="absolute inset-0 bg-grid-pattern opacity-15" aria-hidden />

      <div className="relative mx-auto w-full max-w-7xl px-4 pt-16 pb-20 sm:px-6 sm:pt-20 lg:px-8 lg:pt-24">
        <Reveal className="mx-auto max-w-3xl text-center">
          <RevealItem>
            <Badge className="mb-5 gap-1.5 rounded-full border border-white/25 bg-white/15 px-3 py-1 text-white backdrop-blur">
              <Sparkles className="size-3.5" />
              {t("hero.badge")}
            </Badge>
          </RevealItem>
        </Reveal>

        {/*
          BlurText renders a <p> of animated word spans, which can be neither an
          <h1> nor nested in one. The heading is kept as a real, unanimated <h1>
          for assistive tech and SEO; the animated copy is decorative.
        */}
        <h1 className="sr-only">{title}</h1>

        <div className="mx-auto max-w-3xl" aria-hidden>
          {!animate ? (
            <p className="text-center text-3xl font-bold tracking-tight text-balance text-white sm:text-4xl lg:text-5xl">
              {title}
            </p>
          ) : (
            <BlurText
              key={title}
              text={title}
              animateBy="words"
              direction="top"
              delay={90}
              stepDuration={0.3}
              className="justify-center text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl"
            />
          )}
        </div>

        <Reveal className="mx-auto mt-4 max-w-2xl" delay={0.15}>
          <RevealItem>
            <p className="text-center text-base text-pretty text-white/85 sm:text-lg">
              {t("hero.subtitle")}
            </p>
          </RevealItem>
        </Reveal>

        <Reveal className="mx-auto mt-9 max-w-5xl" delay={0.2}>
          <RevealItem>
            <SearchBar variant="hero" />
          </RevealItem>
        </Reveal>

        {/*
          No trust-stats counter row. It used to animate up to four invented
          numbers (12,400 providers, 1.8M bookings, 27 governorates, a 4.8
          rating) as though they were a live count — there is no analytics
          endpoint this could honestly be sourced from (see BACKEND-GAPS.md),
          and a public marketing page has no authenticated route to a real one
          even if there were. Four counters climbing to numbers nobody can
          verify is exactly the fabricated-data pattern the rest of this app
          was rebuilt to stop doing.
        */}
      </div>
    </section>
  );
}
