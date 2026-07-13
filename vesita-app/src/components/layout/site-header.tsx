"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FlaskConical,
  LayoutDashboard,
  LogOut,
  Menu,
  ScanLine,
  Stethoscope,
  User as UserIcon,
} from "lucide-react";
import { useState } from "react";

import { useAuth } from "@/components/providers/auth-provider";
import { Logo } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { NotificationCenter } from "@/components/shared/notification-center";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { HOME_FOR_ROLE } from "@/lib/api/auth";
import { initialsOf } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/search?type=doctor", label: "Doctors", icon: Stethoscope },
  { href: "/search?type=lab", label: "Labs", icon: FlaskConical },
  { href: "/search?type=radiology", label: "Radiology", icon: ScanLine },
];

export function SiteHeader() {
  const { user, isAuthenticated, logout } = useAuth();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="shrink-0">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-muted",
                pathname === "/search" && "text-foreground",
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />

          {isAuthenticated && <NotificationCenter />}

          {isAuthenticated && user ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    className="ml-1 flex items-center gap-2 rounded-xl p-1 transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    aria-label="Account menu"
                  >
                    <Avatar className="size-8">
                      <AvatarImage src={user.avatar} alt={user.name} />
                      <AvatarFallback className="text-xs">
                        {initialsOf(user.name)}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                }
              />

              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <p className="truncate font-medium">{user.name}</p>
                  <p className="truncate text-xs font-normal text-muted-foreground">
                    {ROLE_LABELS[user.role]}
                  </p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />

                <DropdownMenuItem
                  render={<Link href={HOME_FOR_ROLE[user.role]} />}
                >
                  <LayoutDashboard className="size-4" />
                  Dashboard
                </DropdownMenuItem>

                {user.role === "patient" && (
                  <DropdownMenuItem render={<Link href="/patient/profile" />}>
                    <UserIcon className="size-4" />
                    My profile
                  </DropdownMenuItem>
                )}

                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => logout()}>
                  <LogOut className="size-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <Button
                render={<Link href="/login" />}
                variant="ghost"
                className="h-9 rounded-xl px-4"
              >
                Sign in
              </Button>
              <Button
                render={<Link href="/register" />}
                className="h-9 rounded-xl px-4"
              >
                Create account
              </Button>
            </div>
          )}

          {/* Mobile navigation */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-xl md:hidden"
                  aria-label="Open menu"
                >
                  <Menu className="size-5" />
                </Button>
              }
            />
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle>
                  <Logo />
                </SheetTitle>
              </SheetHeader>

              <nav className="flex flex-col gap-1 px-4">
                {NAV.map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors hover:bg-muted"
                  >
                    <Icon className="size-4" />
                    {label}
                  </Link>
                ))}

                {!isAuthenticated && (
                  <div className="mt-4 flex flex-col gap-2 border-t pt-4">
                    <Button
                      render={<Link href="/login" />}
                      variant="outline"
                      className="h-10 w-full rounded-xl"
                      onClick={() => setMobileOpen(false)}
                    >
                      Sign in
                    </Button>
                    <Button
                      render={<Link href="/register" />}
                      className="h-10 w-full rounded-xl"
                      onClick={() => setMobileOpen(false)}
                    >
                      Create account
                    </Button>
                  </div>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
