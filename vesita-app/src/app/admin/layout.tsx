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

import { DashboardShell, type NavSection } from "@/components/layout/dashboard-shell";

const NAV: NavSection[] = [
  {
    label: "Overview",
    items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Management",
    items: [
      { href: "/admin/users", label: "Users", icon: Users },
      { href: "/admin/providers", label: "Providers", icon: Stethoscope },
    ],
  },
  {
    label: "Monetization",
    items: [
      { href: "/admin/coupons", label: "Coupons", icon: Ticket },
      { href: "/admin/cashback", label: "Cashback", icon: Gift },
      { href: "/admin/commission", label: "Commission", icon: Percent },
    ],
  },
  {
    label: "Insights",
    items: [{ href: "/admin/analytics", label: "Analytics", icon: ChartColumn }],
  },
];

/** Page titles keyed by route — the sidebar and the top bar stay in step. */
const TITLES: Record<string, string> = {
  "/admin": "Dashboard",
  "/admin/users": "Users Management",
  "/admin/providers": "Providers Management",
  "/admin/coupons": "Coupons",
  "/admin/cashback": "Cashback Campaigns",
  "/admin/commission": "Commission Settings",
  "/admin/analytics": "Analytics",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Exact match first, then the longest matching prefix, so nested routes
  // (/admin/users/123) inherit their section's title.
  const title =
    TITLES[pathname] ??
    Object.entries(TITLES)
      .filter(([href]) => href !== "/admin" && pathname.startsWith(`${href}/`))
      .sort((a, b) => b[0].length - a[0].length)[0]?.[1] ??
    "Admin";

  return (
    <DashboardShell allow={["admin"]} nav={NAV} title={title}>
      {children}
    </DashboardShell>
  );
}
