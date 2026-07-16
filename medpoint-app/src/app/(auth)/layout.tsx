import Link from "next/link";
import { CalendarCheck, ShieldCheck, Wallet } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { LanguageToggle } from "@/components/layout/language-toggle";
import { Logo } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";

const HIGHLIGHTS = [
  { key: "instant", icon: CalendarCheck },
  { key: "pricing", icon: Wallet },
  { key: "verified", icon: ShieldCheck },
] as const;

/** Split layout for auth screens: the form on one side, the pitch on the other. */
export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getTranslations("nav");

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col px-6 py-8 sm:px-10">
        <div className="flex items-center justify-between">
          <Link href="/">
            <Logo />
          </Link>

          {/*
            The auth pages sit outside SiteHeader, so they had no language switch
            at all — an Arabic speaker landing straight on /login had no way to
            change it. Every other toggle in the app lives beside the theme one.
          */}
          <div className="flex items-center gap-1">
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-md">{children}</div>
        </div>
      </div>

      {/* Decorative panel — hidden on mobile, where it would only add scroll. */}
      <div className="relative hidden overflow-hidden bg-brand-gradient lg:block">
        <div className="absolute inset-0 bg-grid-pattern opacity-20" aria-hidden />

        <div className="relative flex h-full flex-col justify-center px-14 text-white">
          <h2 className="max-w-md text-4xl font-bold leading-tight">
            {t("authPanel.headline")}
          </h2>
          <p className="mt-4 max-w-md text-lg text-white/80">
            {t("authPanel.subhead")}
          </p>

          <ul className="mt-12 space-y-6">
            {HIGHLIGHTS.map(({ key, icon: Icon }) => (
              <li key={key} className="flex gap-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
                  <Icon className="size-5" />
                </span>
                <div>
                  <p className="font-semibold">
                    {t(`authPanel.highlights.${key}.title`)}
                  </p>
                  <p className="mt-0.5 max-w-sm text-sm text-white/75">
                    {t(`authPanel.highlights.${key}.body`)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
