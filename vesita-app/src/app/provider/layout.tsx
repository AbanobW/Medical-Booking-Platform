"use client";

import { usePathname } from "next/navigation";
import {
  CalendarClock,
  ClipboardList,
  LayoutDashboard,
  Settings,
  Star,
  Stethoscope,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { DashboardShell, type NavSection } from "@/components/layout/dashboard-shell";

const ITEMS = [
  { href: "/provider", key: "dashboard", icon: LayoutDashboard },
  { href: "/provider/schedule", key: "schedule", icon: CalendarClock },
  { href: "/provider/services", key: "services", icon: Stethoscope },
  { href: "/provider/bookings", key: "bookings", icon: ClipboardList },
  { href: "/provider/reviews", key: "reviews", icon: Star },
  { href: "/provider/settings", key: "settings", icon: Settings },
] as const;

export default function ProviderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const t = useTranslations("nav");

  const nav: NavSection[] = [
    {
      label: t("provider.sections.manage"),
      items: ITEMS.map(({ href, key, icon }) => ({
        href,
        label: t(`provider.items.${key}`),
        icon,
      })),
    },
  ];

  // Longest matching nav href wins, so /provider/schedule doesn't fall back to
  // the /provider index entry.
  const active = ITEMS.filter(
    (item) =>
      pathname === item.href ||
      (item.href !== "/provider" && pathname.startsWith(`${item.href}/`)),
  ).sort((a, b) => b.href.length - a.href.length)[0];

  return (
    <DashboardShell
      allow={["doctor", "lab", "radiology"]}
      nav={nav}
      title={t(`provider.items.${active?.key ?? "dashboard"}`)}
    >
      {children}
    </DashboardShell>
  );
}
