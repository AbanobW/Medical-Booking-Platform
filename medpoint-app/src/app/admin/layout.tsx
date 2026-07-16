"use client";

import { usePathname } from "next/navigation";
import {
  ChartColumn,
  Gift,
  LayoutDashboard,
  Percent,
  Stethoscope,
  Ticket,
  Users,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { DashboardShell, type NavSection } from "@/components/layout/dashboard-shell";

/** Page titles keyed by route — the sidebar and the top bar stay in step. */
const TITLE_KEYS: Record<string, string> = {
  "/admin": "dashboard",
  "/admin/users": "users",
  "/admin/providers": "providers",
  "/admin/coupons": "coupons",
  "/admin/cashback": "cashback",
  "/admin/commission": "commission",
  "/admin/analytics": "analytics",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const t = useTranslations("nav");

  const nav: NavSection[] = [
    {
      label: t("admin.sections.overview"),
      items: [
        {
          href: "/admin",
          label: t("admin.items.dashboard"),
          icon: LayoutDashboard,
        },
      ],
    },
    {
      label: t("admin.sections.management"),
      items: [
        { href: "/admin/users", label: t("admin.items.users"), icon: Users },
        {
          href: "/admin/providers",
          label: t("admin.items.providers"),
          icon: Stethoscope,
        },
      ],
    },
    {
      label: t("admin.sections.monetization"),
      items: [
        { href: "/admin/coupons", label: t("admin.items.coupons"), icon: Ticket },
        { href: "/admin/cashback", label: t("admin.items.cashback"), icon: Gift },
        {
          href: "/admin/commission",
          label: t("admin.items.commission"),
          icon: Percent,
        },
      ],
    },
    {
      label: t("admin.sections.insights"),
      items: [
        {
          href: "/admin/analytics",
          label: t("admin.items.analytics"),
          icon: ChartColumn,
        },
      ],
    },
  ];

  // Exact match first, then the longest matching prefix, so nested routes
  // (/admin/users/123) inherit their section's title.
  const key =
    TITLE_KEYS[pathname] ??
    Object.entries(TITLE_KEYS)
      .filter(([href]) => href !== "/admin" && pathname.startsWith(`${href}/`))
      .sort((a, b) => b[0].length - a[0].length)[0]?.[1] ??
    "fallback";

  return (
    <DashboardShell allow={["admin"]} nav={nav} title={t(`admin.titles.${key}`)}>
      {children}
    </DashboardShell>
  );
}
