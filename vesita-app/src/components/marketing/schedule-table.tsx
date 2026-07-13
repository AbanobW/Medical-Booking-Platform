"use client";

import { Users } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatTime } from "@/lib/format";
import { TODAY } from "@/lib/data/seed";
import {
  CAPACITY_LABELS,
  WEEKDAY_NAMES,
  type DaySchedule,
  type Weekday,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const ORDER: Weekday[] = [6, 0, 1, 2, 3, 4, 5]; // Saturday-first, as in Egypt.

/**
 * Weekly working hours for ONE branch (§2).
 *
 * Schedules live on the branch, not the provider — a doctor's Maadi clinic and
 * their Nasr City clinic keep different hours. The caller passes the schedule of
 * whichever branch the patient has selected.
 */
export function ScheduleTable({
  schedule,
  title = "Weekly schedule",
  subtitle,
  className,
}: {
  schedule: DaySchedule[];
  title?: string;
  /** e.g. the branch name, so it is obvious whose hours these are. */
  subtitle?: string;
  className?: string;
}) {
  const today = TODAY.getUTCDay() as Weekday;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
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
                  {WEEKDAY_NAMES[weekday]}
                  {weekday === today && (
                    <Badge variant="secondary" className="font-normal">
                      Today
                    </Badge>
                  )}
                </span>

                {isWorking && day ? (
                  <span className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-right">
                    <span className="tabular-nums">
                      {formatTime(day.startTime)} – {formatTime(day.endTime)}
                    </span>

                    {day.breaks.length > 0 && (
                      <span className="text-xs text-muted-foreground tabular-nums">
                        Break{day.breaks.length > 1 ? "s" : ""}:{" "}
                        {day.breaks
                          .map(
                            (b) =>
                              `${formatTime(b.startTime)}–${formatTime(b.endTime)}`,
                          )
                          .join(", ")}
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
                              {day.capacity} places
                            </span>
                          }
                        />
                        <TooltipContent>
                          {CAPACITY_LABELS[day.capacityType]}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </span>
                ) : (
                  <span className="text-muted-foreground">Closed</span>
                )}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
