"use client";

import { Users } from "lucide-react";
import { useTranslations } from "next-intl";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useFormat } from "@/lib/i18n/use-format";
import { useLabels } from "@/lib/i18n/use-labels";
import { now } from "@/lib/time";
import { type DaySchedule, type Weekday } from "@/lib/types";
import { cn } from "@/lib/utils";

const ORDER: Weekday[] = [6, 0, 1, 2, 3, 4, 5]; // Saturday-first, as in Egypt.

/** `Weekday` index → the key it lives under in the shared `domain` messages. */
export const WEEKDAY_KEYS: Record<Weekday, string> = {
  0: "sunday",
  1: "monday",
  2: "tuesday",
  3: "wednesday",
  4: "thursday",
  5: "friday",
  6: "saturday",
};

/**
 * Weekly working hours for ONE branch (§2).
 *
 * Schedules live on the branch, not the provider — a doctor's Maadi clinic and
 * their Nasr City clinic keep different hours. The caller passes the schedule of
 * whichever branch the patient has selected.
 */
export function ScheduleTable({
  schedule,
  title,
  subtitle,
  className,
}: {
  schedule: DaySchedule[];
  title?: string;
  /** e.g. the branch name, so it is obvious whose hours these are. */
  subtitle?: string;
  className?: string;
}) {
  const t = useTranslations("profile");
  const tDomain = useTranslations("domain");
  const L = useLabels();
  const { formatTime } = useFormat();

  const today = now().getUTCDay() as Weekday;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base">{title ?? t("schedule.title")}</CardTitle>
        {subtitle && (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y">
          {ORDER.map((weekday) => {
            const day = schedule.find((d) => d.weekday === weekday);
            const isWorking = Boolean(day?.isWorkingDay);

            return (
              <li
                key={weekday}
                className={cn(
                  "flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm",
                  weekday === today && "bg-accent/50",
                )}
              >
                <span className="flex items-center gap-2 font-medium">
                  {tDomain(`weekday.${WEEKDAY_KEYS[weekday]}`)}
                  {weekday === today && (
                    <Badge variant="secondary" className="font-normal">
                      {t("schedule.today")}
                    </Badge>
                  )}
                </span>

                {isWorking && day ? (
                  <span className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-end">
                    <span className="tabular-nums ltr-nums">
                      {formatTime(day.startTime)} – {formatTime(day.endTime)}
                    </span>

                    {day.breaks.length > 0 && (
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {t("schedule.breaks", {
                          count: day.breaks.length,
                          times: day.breaks
                            .map(
                              (b) =>
                                `${formatTime(b.startTime)}–${formatTime(b.endTime)}`,
                            )
                            .join(", "),
                        })}
                      </span>
                    )}

                    {/*
                      Capacity is a real constraint (§5): a comfort limit may run
                      over with a longer wait, a strict limit never does.
                    */}
                    <TooltipProvider delay={200}>
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <span className="inline-flex cursor-help items-center gap-1 text-xs text-muted-foreground tabular-nums">
                              <Users className="size-3" aria-hidden />
                              {t("schedule.places", { count: day.capacity })}
                            </span>
                          }
                        />
                        <TooltipContent>
                          {L.capacity(day.capacityType)}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </span>
                ) : (
                  <span className="text-muted-foreground">
                    {t("schedule.closed")}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
