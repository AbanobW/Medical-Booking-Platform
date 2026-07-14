"use client";

import { AlertTriangle, RefreshCw, SearchX, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Empty, error and loading states — the three every data surface needs. */

export function EmptyState({
  icon: Icon = SearchX,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed bg-card/50 px-6 py-16 text-center",
        className,
      )}
    >
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-muted">
        <Icon className="size-7 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title,
  description,
  onRetry,
  className,
}: {
  /** Defaults to the shared "Something went wrong" copy. */
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  const t = useTranslations("common");

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-destructive/20 bg-destructive/5 px-6 py-16 text-center",
        className,
      )}
    >
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-destructive/10">
        <AlertTriangle className="size-7 text-destructive" />
      </div>
      <h3 className="text-lg font-semibold">{title ?? t("states.error")}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        {description ?? t("states.errorDescription")}
      </p>
      {onRetry && (
        <Button variant="outline" onClick={onRetry} className="mt-6">
          <RefreshCw className="size-4" />
          {t("actions.retry")}
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeletons — shaped like the content they stand in for.
// ---------------------------------------------------------------------------

export function ProviderCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row items-start gap-4">
        <Skeleton className="size-20 shrink-0 rounded-2xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-20 rounded-lg" />
          <Skeleton className="h-8 w-20 rounded-lg" />
          <Skeleton className="h-8 w-20 rounded-lg" />
        </div>
        <Skeleton className="h-10 w-full rounded-xl" />
      </CardContent>
    </Card>
  );
}

export function ProviderListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <ProviderCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-3 w-20" />
      </CardContent>
    </Card>
  );
}

export function StatGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 8, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="space-y-3 rounded-2xl border bg-card p-4">
      <div className="flex gap-4">
        {Array.from({ length: columns }, (_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex gap-4 border-t pt-3">
          {Array.from({ length: columns }, (_, c) => (
            <Skeleton key={c} className="h-8 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function ChartSkeleton({ className }: { className?: string }) {
  return (
    <Card className={className}>
      <CardHeader>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-3 w-56" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[280px] w-full rounded-xl" />
      </CardContent>
    </Card>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-52 w-full rounded-2xl" />
      <div className="flex gap-6">
        <Skeleton className="size-32 shrink-0 rounded-2xl" />
        <div className="flex-1 space-y-3 pt-4">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-52" />
        </div>
      </div>
      <Skeleton className="h-40 w-full rounded-2xl" />
    </div>
  );
}

export function ListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-4 rounded-2xl border bg-card p-4">
          <Skeleton className="size-12 shrink-0 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>
      ))}
    </div>
  );
}
