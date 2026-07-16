import type { Metadata, Viewport } from "next";
import { Cairo, JetBrains_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { AppProviders } from "@/components/providers/app-providers";
import { directionOf } from "@/i18n/config";
import { getLocale } from "@/i18n/locale";
import { SITE } from "@/lib/site";

import "./globals.css";

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

/*
 * The system sans stack has no Arabic coverage, so Arabic would fall back to
 * whatever the OS happens to pick — usually a mismatched, poorly-hinted face.
 * Cairo is loaded for both scripts and swapped in for `--font-sans` under
 * `[dir="rtl"]` (see globals.css), leaving the English typography untouched.
 */
const cairo = Cairo({
  variable: "--font-arabic",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("common.meta");
  const locale = await getLocale();

  const title = t("title", { site: SITE.name });
  const description = t("description");

  return {
    metadataBase: new URL(SITE.url),
    title: { default: title, template: `%s | ${SITE.name}` },
    description,
    keywords: [
      "book a doctor Egypt",
      "medical labs Cairo",
      "radiology centers Egypt",
      "online doctor booking",
      "حجز طبيب",
      "معامل تحاليل",
      "مراكز أشعة",
    ],
    authors: [{ name: SITE.name }],
    openGraph: {
      type: "website",
      locale: locale === "ar" ? "ar_EG" : "en_EG",
      alternateLocale: locale === "ar" ? "en_EG" : "ar_EG",
      url: SITE.url,
      siteName: SITE.name,
      title,
      description,
    },
    twitter: { card: "summary_large_image", title, description },
    robots: { index: true, follow: true },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F8FAFC" },
    { media: "(prefers-color-scheme: dark)", color: "#0F172A" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();

  return (
    /*
     * The font variables go on <html>, not <body>. The RTL rule in globals.css
     * swaps the sans face on `html[dir="rtl"]`, and a custom property is only
     * visible to the element it is declared on and its descendants — declared on
     * <body>, `var(--font-arabic)` is undefined at <html>, which makes the whole
     * `font-family` declaration invalid and silently drops the page to Times.
     */
    <html
      lang={locale}
      dir={directionOf(locale)}
      className={`${mono.variable} ${cairo.variable}`}
      suppressHydrationWarning
    >
      <body>
        <NextIntlClientProvider>
          <AppProviders>{children}</AppProviders>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
