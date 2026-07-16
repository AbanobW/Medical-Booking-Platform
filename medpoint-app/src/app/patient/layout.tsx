"use client";

import { usePathname } from "next/navigation";
import {
  Bell,
  CalendarDays,
  Heart,
  LayoutDashboard,
  Star,
  User,
  Users,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { DashboardShell, type NavSection } from "@/components/layout/dashboard-shell";

/**
 * The shell can't read the page's own metadata, so the title is derived from the
 * pathname — longest matching prefix wins, which keeps nested routes labelled.
 */
const TITLES = [
  { prefix: "/patient/bookings", key: "bookings" },
  { prefix: "/patient/favorites", key: "favorites" },
  { prefix: "/patient/reviews", key: "reviews" },
  { prefix: "/patient/notifications", key: "notifications" },
  { prefix: "/patient/profiles", key: "profiles" },
  { prefix: "/patient/profile", key: "profile" },
  { prefix: "/patient", key: "dashboard" },
] as const;

export default function PatientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const t = useTranslations("nav");

  const nav: NavSection[] = [
    {
      label: t("patient.sections.overview"),
      items: [
        {
          href: "/patient",
          label: t("patient.items.dashboard"),
          icon: LayoutDashboard,
        },
        {
          href: "/patient/bookings",
          label: t("patient.items.bookings"),
          icon: CalendarDays,
        },
      ],
    },
    {
      label: t("patient.sections.activity"),
      items: [
        {
          href: "/patient/favorites",
          label: t("patient.items.favorites"),
          icon: Heart,
        },
        {
          href: "/patient/reviews",
          label: t("patient.items.reviews"),
          icon: Star,
        },
        {
          href: "/patient/notifications",
          label: t("patient.items.notifications"),
          icon: Bell,
        },
      ],
    },
    {
      label: t("patient.sections.account"),
      items: [
        {
          href: "/patient/profiles",
          label: t("patient.items.profiles"),
          icon: Users,
        },
        {
          href: "/patient/profile",
          label: t("patient.items.profile"),
          icon: User,
        },
      ],
    },
  ];

  const match = TITLES.find(
    (entry) =>
      pathname === entry.prefix || pathname.startsWith(`${entry.prefix}/`),
  );
  const title = t(`patient.titles.${match?.key ?? "dashboard"}`);

  return (
    <DashboardShell allow={["patient"]} nav={nav} title={title}>
      {children}
    </DashboardShell>
  );
}
