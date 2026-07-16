"use client";

import Link from "next/link";
import { Home, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";

/** Root error boundary — catches anything a route throws during render. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("nav");
  const tc = useTranslations("common");

  useEffect(() => {
    // A real app would ship this to Sentry / a logging backend.
    console.error("Unhandled application error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <Link href="/" className="mb-10">
        <Logo />
      </Link>

      <h1 className="text-2xl font-bold">{t("error.title")}</h1>
      <p className="mt-2 max-w-md text-muted-foreground">
        {t("error.description")}
      </p>

      {error.digest && (
        <p className="mt-3 font-mono text-xs text-muted-foreground">
          {t("error.reference", { digest: error.digest })}
        </p>
      )}

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button onClick={reset} className="h-11 rounded-xl px-5">
          <RefreshCw className="size-4" />
          {tc("actions.retry")}
        </Button>
        <Button
          render={<Link href="/" />}
          variant="outline"
          className="h-11 rounded-xl px-5"
        >
          <Home className="size-4" />
          {t("actions.backHome")}
        </Button>
      </div>
    </div>
  );
}
