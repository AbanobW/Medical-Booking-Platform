import type { Metadata, Viewport } from "next";
import { JetBrains_Mono } from "next/font/google";

import { AppProviders } from "@/components/providers/app-providers";
import { SITE } from "@/lib/site";

import "./globals.css";

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} — Book Doctors, Labs & Radiology in Egypt`,
    template: `%s | ${SITE.name}`,
  },
  description: SITE.description,
  keywords: [
    "book a doctor Egypt",
    "medical labs Cairo",
    "radiology centers Egypt",
    "online doctor booking",
    "حجز طبيب",
  ],
  authors: [{ name: SITE.name }],
  openGraph: {
    type: "website",
    locale: "en_EG",
    url: SITE.url,
    siteName: SITE.name,
    title: `${SITE.name} — Book Doctors, Labs & Radiology in Egypt`,
    description: SITE.description,
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE.name} — Book Doctors, Labs & Radiology in Egypt`,
    description: SITE.description,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F8FAFC" },
    { media: "(prefers-color-scheme: dark)", color: "#0F172A" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={mono.variable}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
