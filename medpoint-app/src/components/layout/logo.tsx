"use client";

import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import { SITE } from "@/lib/site";

/** The MedPoint wordmark: a blue cross-in-pulse glyph plus the name. */
export function Logo({
  className,
  textClassName,
  showText = true,
}: {
  className?: string;
  textClassName?: string;
  showText?: boolean;
}) {
  const t = useTranslations("nav");

  return (
    <span className={cn("flex items-center gap-2", className)}>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-gradient shadow-glow">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="size-5 text-white"
          aria-hidden
        >
          <path
            d="M3 12h3.5l2-5 3 10 2.5-7 1.5 2H21"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>

      {showText && (
        <span
          className={cn(
            "text-xl font-bold tracking-tight whitespace-nowrap",
            textClassName,
          )}
        >
          {SITE.name}
        </span>
      )}
      <span className="sr-only">{t("logo.home", { site: SITE.name })}</span>
    </span>
  );
}
