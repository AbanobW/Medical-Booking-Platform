import Link from "next/link";
import { Home, Search } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { SITE } from "@/lib/site";

export default async function NotFound() {
  const t = await getTranslations("nav");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <Link href="/" className="mb-10">
        <Logo />
      </Link>

      <p className="text-7xl font-bold text-brand-gradient">404</p>
      <h1 className="mt-4 text-2xl font-bold">{t("notFound.title")}</h1>
      <p className="mt-2 max-w-md text-muted-foreground">
        {t("notFound.description", { site: SITE.name })}
      </p>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button render={<Link href="/" />} className="h-11 rounded-xl px-5">
          <Home className="size-4" />
          {t("actions.backHome")}
        </Button>
        <Button
          render={<Link href="/search?type=doctor" />}
          variant="outline"
          className="h-11 rounded-xl px-5"
        >
          <Search className="size-4" />
          {t("actions.findDoctor")}
        </Button>
      </div>
    </div>
  );
}
