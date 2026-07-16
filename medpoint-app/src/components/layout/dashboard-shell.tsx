"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { useAuth } from "@/components/providers/auth-provider";
import { LanguageToggle } from "@/components/layout/language-toggle";
import { Logo } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { NotificationCenter } from "@/components/shared/notification-center";
import { PageTransition } from "@/components/shared/motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useFormat, useIsRtl } from "@/lib/i18n/use-format";
import { useLabels } from "@/lib/i18n/use-labels";
import { type Role } from "@/lib/types";

export interface NavSection {
  label?: string;
  items: { href: string; label: string; icon: LucideIcon }[];
}

interface DashboardShellProps {
  /** Roles allowed here — anyone else is redirected to /login. */
  allow: Role[];
  nav: NavSection[];
  title: string;
  children: React.ReactNode;
}

/**
 * The shared chrome for the patient, provider and admin dashboards: a
 * collapsible sidebar, a sticky top bar, and a client-side role guard.
 *
 * The guard is presentational only — a real app must enforce authorization on
 * the server. It exists here so the mock flows behave correctly.
 */
export function DashboardShell({
  allow,
  nav,
  title,
  children,
}: DashboardShellProps) {
  const { user, isLoading, isAuthenticated, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("common");
  const { initialsOf } = useFormat();
  const L = useLabels();
  const isRtl = useIsRtl();

  const isAllowed = user !== null && allow.includes(user.role);

  /**
   * The active item is the *longest* href that matches the current path — a
   * plain prefix test would light up the index route (/patient) on every one
   * of its children, so two items would read as active at once. The trailing
   * slash keeps /patient/profile from claiming /patient/profiles.
   */
  const activeHref = nav
    .flatMap((section) => section.items)
    .filter(
      (item) =>
        pathname === item.href || pathname.startsWith(`${item.href}/`),
    )
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    } else if (!isAllowed) {
      // Signed in, but this dashboard isn't theirs.
      router.replace("/");
    }
  }, [isLoading, isAuthenticated, isAllowed, router, pathname]);

  if (isLoading || !isAllowed || !user) {
    return (
      <div className="flex min-h-screen">
        <div className="hidden w-64 border-e p-4 lg:block">
          <Skeleton className="mb-8 h-9 w-32" />
          <div className="space-y-2">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-xl" />
            ))}
          </div>
        </div>
        <div className="flex-1 space-y-6 p-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      {/*
        `side` is physical in the primitive — the rail is `position: fixed`, so
        it pins to left-0/right-0 rather than following the flex direction. In
        Arabic the content sits on the left, so the rail has to be told to move
        to the right or it would overlap it.
      */}
      <Sidebar collapsible="icon" side={isRtl ? "right" : "left"}>
        <SidebarHeader className="p-4 group-data-[collapsible=icon]:p-2">
          <Link
            href="/"
            className="block overflow-hidden group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center"
          >
            <Logo textClassName="group-data-[collapsible=icon]:hidden" />
          </Link>
        </SidebarHeader>

        <SidebarContent className="gap-1 px-2 py-2">
          {nav.map((section, i) => (
            <SidebarGroup key={section.label ?? i} className="px-0 py-1">
              {section.label && (
                <SidebarGroupLabel className="px-3 text-[11px] font-semibold tracking-wider text-muted-foreground/70 uppercase">
                  {section.label}
                </SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu className="gap-1">
                  {section.items.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        isActive={item.href === activeHref}
                        tooltip={item.label}
                        render={<Link href={item.href} />}
                        className={cn(
                          "h-10 gap-3 rounded-xl px-3 font-normal text-sidebar-foreground/80",
                          "[&_svg]:size-[18px] [&_svg]:text-muted-foreground",
                          "hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                          // Active reads as a tinted pill with a bar on the
                          // inline-start edge — hover alone must never look like it.
                          "data-active:bg-primary/10 data-active:font-semibold data-active:text-primary",
                          "data-active:[&_svg]:text-primary",
                          "relative data-active:before:absolute data-active:before:inset-y-2 data-active:before:start-0 data-active:before:w-1 data-active:before:rounded-e-full data-active:before:bg-primary",
                          // Collapsed to a 32px icon rail, the bar is just noise.
                          "group-data-[collapsible=icon]:before:hidden",
                        )}
                      >
                        <item.icon />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>

        <SidebarFooter className="p-3">
          <div className="flex items-center gap-3 rounded-xl border bg-sidebar-accent/40 p-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:border-transparent group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:p-0">
            <Avatar className="size-8 shrink-0">
              <AvatarImage src={user.avatar ?? undefined} alt={user.name} />
              <AvatarFallback className="text-xs">
                {initialsOf(user.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
              <p className="truncate text-sm font-medium">{user.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {L.role(user.role)}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => logout()}
              aria-label={t("actions.signOut")}
              className="shrink-0 group-data-[collapsible=icon]:hidden"
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur-lg sm:px-6">
          <SidebarTrigger />
          <h1 className="truncate text-lg font-semibold">{title}</h1>

          <div className="ms-auto flex items-center gap-1">
            <LanguageToggle />
            <ThemeToggle />
            <NotificationCenter />
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6">
          <PageTransition>{children}</PageTransition>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
