"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const OPTIONS = [
  { value: "light", key: "light", icon: Sun },
  { value: "dark", key: "dark", icon: Moon },
  { value: "system", key: "system", icon: Monitor },
] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const t = useTranslations("common");

  // The resolved theme isn't known until after hydration; render a stable
  // placeholder until then so the server and client markup match.
  useEffect(() => setMounted(true), []);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="rounded-xl"
            aria-label={t("theme.change")}
          >
            {mounted && theme === "dark" ? (
              <Moon className="size-5" />
            ) : (
              <Sun className="size-5" />
            )}
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        {OPTIONS.map(({ value, key, icon: Icon }) => (
          <DropdownMenuItem key={value} onClick={() => setTheme(value)}>
            <Icon className="size-4" />
            {t(`theme.${key}`)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
