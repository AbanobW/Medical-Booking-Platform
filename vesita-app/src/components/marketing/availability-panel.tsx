"use client";

import { CalendarClock, CalendarX2 } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { ScheduleTable } from "@/components/marketing/schedule-table";
import { ErrorState } from "@/components/shared/states";
import { AppSelect } from "@/components/ui/app-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useAsync } from "@/hooks/use-async";
import { getAvailability } from "@/lib/api/providers";
import { todayISO } from "@/lib/data/seed";
import { useApiError } from "@/lib/i18n/use-api-error";
import { useFormat } from "@/lib/i18n/use-format";
import type { Provider, TimeSlot } from "@/lib/types";

/**
 * Live availability for the selected branch (§4).
 *
 * Search availability is an approximate hint; THIS is the honest layer. It reads
 * the branch's real schedule, holidays and capacity, and when there is nothing
 * left today it says so plainly and offers the next open day — never an error.
 */
export function AvailabilityPanel({
  provider,
  className,
}: {
  provider: Provider;
  className?: string;
}) {
  const t = useTranslations("profile");
  const { formatTime, relativeDay } = useFormat();
  const describeError = useApiError();

  const branches = useMemo(
    () => provider.branches.filter((b) => b.isActive),
    [provider.branches],
  );

  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const branch = branches.find((b) => b.id === branchId) ?? branches[0];

  const { data, error, isLoading, refetch } = useAsync(
    () =>
      branch
        ? getAvailability(provider.id, 14, branch.id)
        : Promise.resolve({} as Record<string, TimeSlot[]>),
    [provider.id, branch?.id],
  );

  const today = todayISO();

  // Days that still have a place a patient could actually take.
  const openDays = useMemo(() => {
    if (!data) return [];
    return Object.entries(data)
      .map(([date, slots]) => ({
        date,
        slots: slots.filter((slot) => slot.isAvailable),
      }))
      .filter((day) => day.slots.length > 0)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [data]);

  const todayIsOpen = openDays.some((day) => day.date === today);
  const next = openDays[0];

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="size-4 text-primary" />
            {t("availability.title")}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {t("availability.subtitle")}
          </p>
        </CardHeader>

        <CardContent className="space-y-4">
          {branches.length > 1 && (
            <div className="space-y-1.5">
              <Label htmlFor="availability-branch" className="text-xs text-muted-foreground">
                {t("availability.branch")}
              </Label>
              <AppSelect
                id="availability-branch"
                value={branch?.id ?? ""}
                onValueChange={setBranchId}
                placeholder={t("availability.selectBranch")}
                aria-label={t("availability.branch")}
                options={branches.map((b) => ({ value: b.id, label: b.name }))}
              />
            </div>
          )}

          {!branch ? (
            <p className="text-sm text-muted-foreground">
              {t("availability.noBranch")}
            </p>
          ) : isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <div className="flex flex-wrap gap-1.5">
                <Skeleton className="h-7 w-20 rounded-lg" />
                <Skeleton className="h-7 w-20 rounded-lg" />
                <Skeleton className="h-7 w-20 rounded-lg" />
              </div>
            </div>
          ) : error ? (
            <ErrorState
              title={t("availability.errorTitle")}
              description={describeError(error)}
              onRetry={refetch}
            />
          ) : openDays.length === 0 ? (
            <div className="flex items-start gap-3 rounded-xl bg-muted p-3">
              <CalendarX2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {t("availability.noneInTwoWeeks", { branch: branch.name })}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/*
                The honest answer when search said "today" and reality says
                otherwise: no error — just the truth, and the next open day.
              */}
              {!todayIsOpen && next && (
                <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">
                  {t("availability.noneTodayPrefix")}{" "}
                  <span className="font-medium text-foreground">
                    {relativeDay(next.date)}
                  </span>
                  .
                </p>
              )}

              {openDays.slice(0, 3).map((day) => (
                <div key={day.date} className="space-y-1.5">
                  <p className="flex items-center gap-2 text-xs font-medium">
                    {relativeDay(day.date)}
                    {day.date === today && (
                      <Badge variant="secondary" className="font-normal">
                        {t("availability.today")}
                      </Badge>
                    )}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {day.slots.slice(0, 6).map((slot) => (
                      <Badge
                        key={slot.id}
                        variant="outline"
                        className="font-normal tabular-nums"
                        title={
                          slot.isFull
                            ? t("availability.busyTitle")
                            : t("availability.remainingTitle", {
                                remaining: slot.remaining,
                                capacity: slot.capacity,
                              })
                        }
                      >
                        <span className="ltr-nums">{formatTime(slot.time)}</span>
                        {slot.isFull && (
                          <span className="ms-1 text-warning">
                            {t("availability.busy")}
                          </span>
                        )}
                      </Badge>
                    ))}
                    {day.slots.length > 6 && (
                      <Badge variant="secondary" className="font-normal">
                        {t("availability.moreSlots", {
                          count: day.slots.length - 6,
                        })}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}

              <Button
                render={
                  <Link
                    href={`/booking/${provider.slug}?branchId=${branch.id}`}
                  />
                }
                className="h-10 w-full rounded-xl"
              >
                {t("availability.pickTime")}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                {t("availability.holdNote")}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {branch && (
        <ScheduleTable
          className="mt-6"
          schedule={branch.schedule}
          subtitle={branch.name}
        />
      )}
    </div>
  );
}
