"use client";

import { Sparkles } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import Aurora from "@/components/reactbits/Aurora";
import BlurText from "@/components/reactbits/BlurText";
import CountUp from "@/components/reactbits/CountUp";
import { Reveal, RevealItem } from "@/components/shared/motion";
import { SearchBar } from "@/components/shared/search-bar";
import { Badge } from "@/components/ui/badge";
import { useIsRtl } from "@/lib/i18n/use-format";

/**
 * The landing hero.
 *
 * The moving parts are React Bits components (reactbits.dev): an `Aurora` WebGL
 * field behind the brand gradient, `BlurText` for the headline, and `CountUp`
 * for the trust figures.
 *
 * Three things constrain how they can be used here:
 *
 *  - **Arabic is cursive.** `BlurText` can split by word or by letter; letters
 *    would cut each word into unjoined glyphs and render Arabic as nonsense, so
 *    the split is pinned to words in both languages.
 *  - **The numbers stay Latin.** `CountUp` formats through `Intl` with `en-US`,
 *    which is what we want — the app pins Latin digits for Arabic too (see
 *    `INTL_LOCALES`) — but a counting number inside RTL prose still needs bidi
 *    isolation, hence `ltr-nums`.
 *  - **Motion is optional.** Aurora is a WebGL canvas and BlurText animates on
 *    scroll; under `prefers-reduced-motion` both are dropped for the static
 *    gradient and plain text.
 */

/**
 * The figures behind the counters. They are the same in every language — only
 * the suffix ("M" / "مليون") and the label are translated — so they live here
 * rather than in the message files.
 */
const TRUST_STATS: { key: string; to: number; separator?: string }[] = [
  { key: "providers", to: 12_400, separator: "," },
  { key: "bookings", to: 1.8 },
  { key: "governorates", to: 27 },
  { key: "rating", to: 4.8 },
];

/** Brand blues → teal. Decorative only; the chart ramp is not for backgrounds. */
const AURORA_COLORS = ["#0EA5E9", "#2563EB", "#14B8A6"];

export function Hero() {
  const t = useTranslations("home");
  const isRtl = useIsRtl();
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

        <Reveal className="mx-auto mt-12 grid max-w-4xl grid-cols-2 gap-6 lg:grid-cols-4">
          {TRUST_STATS.map(({ key, to, separator }) => (
            <RevealItem key={key} className="text-center">
              <p className="text-2xl font-bold text-white tabular-nums sm:text-3xl">
                {/*
                  One isolated LTR run: the counter and its suffix have to stay
                  glued together, or bidi reorders "1.8" and "مليون" around each
                  other and the figure reads as gibberish in Arabic.
                */}
                <span className="ltr-nums inline-flex items-baseline">
                  {/*
                    CountUp drives a spring, and a spring approaches its target
                    asymptotically — at the shipped default the last few units of
                    "12,400" crawl for seconds. A shorter `duration` raises both
                    stiffness and damping, so the figure lands instead of creeping.
                  */}
                  <CountUp
                    to={to}
                    separator={separator ?? ""}
                    duration={0.9}
                    delay={0.15}
                  />
                  {/*
                    `whitespace-pre` keeps the leading space in a suffix like
                    " مليون" — flex collapses it otherwise, and the figure runs
                    together as "1.8مليون". "+" and "/5" have no space to keep.
                  */}
                  <span className="whitespace-pre">
                    {t(`trust.${key}.suffix`)}
                  </span>
                </span>
              </p>
              <p
                className="mt-1 text-xs text-white/75 sm:text-sm"
                // The label reads in the page's own direction, not the number's.
                dir={isRtl ? "rtl" : "ltr"}
              >
                {t(`trust.${key}.label`)}
              </p>
            </RevealItem>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
