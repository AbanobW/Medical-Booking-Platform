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

import { DashboardShell, type NavSection } from "@/components/layout/dashboard-shell";

const NAV: NavSection[] = [
  {
    label: "Overview",
    items: [
      { href: "/patient", label: "Dashboard", icon: LayoutDashboard },
      { href: "/patient/bookings", label: "My Bookings", icon: CalendarDays },
    ],
  },
  {
    label: "Activity",
    items: [
      { href: "/patient/favorites", label: "Favorites", icon: Heart },
      { href: "/patient/reviews", label: "Reviews", icon: Star },
      { href: "/patient/notifications", label: "Notifications", icon: Bell },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/patient/profiles", label: "Patient profiles", icon: Users },
      { href: "/patient/profile", label: "Profile", icon: User },
    ],
  },
];

/**
 * The shell can't read the page's own metadata, so the title is derived from the
 * pathname — longest matching prefix wins, which keeps nested routes labelled.
 */
const TITLES: { prefix: string; title: string }[] = [
  { prefix: "/patient/bookings", title: "My Bookings" },
  { prefix: "/patient/favorites", title: "Favorites" },
  { prefix: "/patient/reviews", title: "My Reviews" },
  { prefix: "/patient/notifications", title: "Notifications" },
  { prefix: "/patient/profiles", title: "Patient Profiles" },
  { prefix: "/patient/profile", title: "Profile" },
  { prefix: "/patient", title: "Dashboard" },
];

function titleFor(pathname: string): string {
  return (
    TITLES.find(
      (entry) =>
        pathname === entry.prefix || pathname.startsWith(`${entry.prefix}/`),
    )?.title ?? "Dashboard"
  );
}

export default function PatientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <DashboardShell allow={["patient"]} nav={NAV} title={titleFor(pathname)}>
      {children}
    </DashboardShell>
  );
}
