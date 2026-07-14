"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FlaskConical,
  Heart,
  LayoutDashboard,
  LogOut,
  Menu,
  ScanLine,
  Stethoscope,
  User as UserIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useAuth } from "@/components/providers/auth-provider";
import { Logo } from "@/components/layout/logo";
import { LanguageToggle } from "@/components/layout/language-toggle";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { NotificationCenter } from "@/components/shared/notification-center";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { HOME_FOR_ROLE } from "@/lib/api/auth";
import { useFormat, useIsRtl } from "@/lib/i18n/use-format";
import { useLabels } from "@/lib/i18n/use-labels";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/search?type=doctor", key: "doctors", icon: Stethoscope },
  { href: "/search?type=lab", key: "labs", icon: FlaskConical },
  { href: "/search?type=radiology", key: "radiology", icon: ScanLine },
] as const;

export function SiteHeader() {
  const { user, isAuthenticated, logout } = useAuth();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const t = useTranslations("nav");
  const tc = useTranslations("common");
  // The sheet's `side` is physical, so it has to be mirrored by hand in Arabic.
  const isRtl = useIsRtl();
  const { initialsOf } = useFormat();
  const L = useLabels();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="shrink-0">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map(({ href, key, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-muted",
                pathname === "/search" && "text-foreground",
              )}
            >
              <Icon className="size-4" />
              {t(`header.${key}`)}
            </Link>
          ))}
        </nav>

        <div className="ms-auto flex items-center gap-1">
          <LanguageToggle />
          <ThemeToggle />

          {isAuthenticated && <NotificationCenter />}

          {isAuthenticated && user ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    className="ms-1 flex items-center gap-2 rounded-xl p-1 transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    aria-label={t("header.accountMenu")}
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
                <DropdownMenuGroup>
                  <DropdownMenuLabel>
                    <p className="truncate font-medium">{user.name}</p>
                    <p className="truncate text-xs font-normal text-muted-foreground">
                      {L.role(user.role)}
                    </p>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />

                <DropdownMenuItem
                  render={<Link href={HOME_FOR_ROLE[user.role]} />}
                >
                  <LayoutDashboard className="size-4" />
                  {t("header.dashboard")}
                </DropdownMenuItem>

                {user.role === "patient" && (
                  <>
                    <DropdownMenuItem render={<Link href="/patient/favorites" />}>
                      <Heart className="size-4" />
                      {t("header.favorites")}
                    </DropdownMenuItem>
                    <DropdownMenuItem render={<Link href="/patient/profile" />}>
                      <UserIcon className="size-4" />
                      {t("header.myProfile")}
                    </DropdownMenuItem>
                  </>
                )}

                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => logout()}>
                  <LogOut className="size-4" />
                  {tc("actions.signOut")}
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
                {tc("actions.signIn")}
              </Button>
              <Button
                render={<Link href="/register" />}
                className="h-9 rounded-xl px-4"
              >
                {tc("actions.signUp")}
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
                  aria-label={t("header.openMenu")}
                >
                  <Menu className="size-5" />
                </Button>
              }
            />
            <SheetContent side={isRtl ? "left" : "right"} className="w-72">
              <SheetHeader>
                <SheetTitle>
                  <Logo />
                </SheetTitle>
              </SheetHeader>

              <nav className="flex flex-col gap-1 px-4">
                {NAV.map(({ href, key, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors hover:bg-muted"
                  >
                    <Icon className="size-4" />
                    {t(`header.${key}`)}
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
                      {tc("actions.signIn")}
                    </Button>
                    <Button
                      render={<Link href="/register" />}
                      className="h-10 w-full rounded-xl"
                      onClick={() => setMobileOpen(false)}
                    >
                      {tc("actions.signUp")}
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
