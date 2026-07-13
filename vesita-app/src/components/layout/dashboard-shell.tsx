"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, type LucideIcon } from "lucide-react";
import { useEffect } from "react";

import { useAuth } from "@/components/providers/auth-provider";
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
import { initialsOf } from "@/lib/format";
import { ROLE_LABELS, type Role } from "@/lib/types";

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

  const isAllowed = user !== null && allow.includes(user.role);

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
        <div className="hidden w-64 border-r p-4 lg:block">
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
      <Sidebar collapsible="icon">
        <SidebarHeader className="p-4">
          <Link href="/">
            <Logo />
          </Link>
        </SidebarHeader>

        <SidebarContent>
          {nav.map((section, i) => (
            <SidebarGroup key={section.label ?? i}>
              {section.label && (
                <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu>
                  {section.items.map((item) => {
                    // Exact match for the index route; prefix match for the rest,
                    // so /admin/users/123 still highlights "Users".
                    const isActive =
                      pathname === item.href ||
                      (item.href !== "/" &&
                        pathname.startsWith(`${item.href}/`));

                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          isActive={isActive}
                          tooltip={item.label}
                          render={<Link href={item.href} />}
                        >
                          <item.icon />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>

        <SidebarFooter className="p-3">
          <div className="flex items-center gap-3 rounded-xl p-2 group-data-[collapsible=icon]:justify-center">
            <Avatar className="size-8 shrink-0">
              <AvatarImage src={user.avatar} alt={user.name} />
              <AvatarFallback className="text-xs">
                {initialsOf(user.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
              <p className="truncate text-sm font-medium">{user.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {ROLE_LABELS[user.role]}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => logout()}
              aria-label="Sign out"
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

          <div className="ml-auto flex items-center gap-1">
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
