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

import { DashboardShell, type NavSection } from "@/components/layout/dashboard-shell";

const NAV: NavSection[] = [
  {
    label: "Manage",
    items: [
      { href: "/provider", label: "Dashboard", icon: LayoutDashboard },
      { href: "/provider/schedule", label: "Schedule", icon: CalendarClock },
      { href: "/provider/services", label: "Services", icon: Stethoscope },
      { href: "/provider/bookings", label: "Bookings", icon: ClipboardList },
      { href: "/provider/reviews", label: "Reviews", icon: Star },
      { href: "/provider/settings", label: "Settings", icon: Settings },
    ],
  },
];

export default function ProviderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // Longest matching nav href wins, so /provider/schedule doesn't fall back to
  // the /provider index entry.
  const active = NAV[0].items
    .filter(
      (item) =>
        pathname === item.href ||
        (item.href !== "/provider" && pathname.startsWith(`${item.href}/`)),
    )
    .sort((a, b) => b.href.length - a.href.length)[0];

  return (
    <DashboardShell
      allow={["doctor", "lab", "radiology"]}
      nav={NAV}
      title={active?.label ?? "Dashboard"}
    >
      {children}
    </DashboardShell>
  );
}
