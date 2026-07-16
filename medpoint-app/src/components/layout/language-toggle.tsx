"use client";

import { Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LOCALE_LABELS,
  LOCALES,
  normalizeLocale,
  type Locale,
} from "@/i18n/config";
import { setLocale } from "@/i18n/locale";
import { cn } from "@/lib/utils";

/**
 * Switches between English and Arabic.
 *
 * The locale lives in a cookie, so the change has to go back through the server
 * for `<html lang/dir>` and the messages to update — `router.refresh()` after
 * the action re-renders the tree in the new language and writing direction.
 */
export function LanguageToggle() {
  const active = normalizeLocale(useLocale());
  const t = useTranslations("common.language");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function choose(locale: Locale) {
    if (locale === active) return;
    startTransition(async () => {
      await setLocale(locale);
      router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="rounded-xl"
            aria-label={t("change")}
            disabled={isPending}
          >
            <Languages className="size-5" />
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        {LOCALES.map((locale) => (
          <DropdownMenuItem
            key={locale}
            onClick={() => choose(locale)}
            className={cn(locale === active && "font-semibold text-primary")}
          >
            <span lang={locale}>{LOCALE_LABELS[locale]}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
