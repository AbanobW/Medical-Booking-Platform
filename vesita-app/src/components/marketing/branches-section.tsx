"use client";

import { Clock, ListChecks, MapPin, Phone } from "lucide-react";
import { useTranslations } from "next-intl";

import { WEEKDAY_KEYS } from "@/components/marketing/schedule-table";
import { MapPlaceholder } from "@/components/shared/map-placeholder";
import { EmptyState } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { TODAY } from "@/lib/data/seed";
import { useDomain, useFormat } from "@/lib/i18n/use-format";
import { type Branch, type Weekday } from "@/lib/types";

const ORDER: Weekday[] = [6, 0, 1, 2, 3, 4, 5]; // Saturday-first, as in Egypt.

/**
 * Every branch, with the things that actually differ between them (§2):
 * its own opening hours, its own slice of the service catalogue, its own
 * address, phone and map.
 */
export function BranchesSection({
  branches,
  emptyDescription,
}: {
  branches: Branch[];
  emptyDescription?: string;
}) {
  const t = useTranslations("profile");
  const tDomain = useTranslations("domain");
  const { formatTime, locale } = useFormat();
  const { getAreaName, getGovernorateName } = useDomain();

  const today = TODAY.getUTCDay() as Weekday;

  /** A compact "Sat · Sun · Mon" style summary of a branch's week. */
  const openDaysOf = (branch: Branch): string[] =>
    ORDER.filter(
      (weekday) =>
        branch.schedule.find((d) => d.weekday === weekday)?.isWorkingDay ?? false,
    ).map((weekday) => {
      const name = tDomain(`weekday.${WEEKDAY_KEYS[weekday]}`);
      // Arabic weekday names are already short; English abbreviates to three.
      return locale === "ar" ? name : name.slice(0, 3);
    });

  if (branches.length === 0) {
    return (
      <EmptyState
        icon={MapPin}
        title={t("branches.emptyTitle")}
        description={emptyDescription ?? t("branches.emptyGeneric")}
      />
    );
  }

  return (
    <ul className="grid gap-5 xl:grid-cols-2">
      {branches.map((branch) => {
        const todaySchedule = branch.schedule.find(
          (d) => d.weekday === today && d.isWorkingDay,
        );
        const days = openDaysOf(branch);

        return (
          <li key={branch.id}>
            <Card className="h-full">
              <CardContent className="space-y-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-semibold">{branch.name}</h4>
                    {!branch.isActive ? (
                      <Badge variant="secondary" className="font-normal">
                        {t("branches.temporarilyClosed")}
                      </Badge>
                    ) : todaySchedule ? (
                      <Badge
                        variant="secondary"
                        className="bg-success/10 font-normal text-success tabular-nums"
                      >
                        <span className="ltr-nums">
                          {t("branches.openToday", {
                            from: formatTime(todaySchedule.startTime),
                            to: formatTime(todaySchedule.endTime),
                          })}
                        </span>
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="font-normal">
                        {t("branches.closedToday")}
                      </Badge>
                    )}
                  </div>

                  <p className="mt-1 flex items-start gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="mt-0.5 size-3.5 shrink-0" />
                    <span>
                      {branch.address} — {getAreaName(branch.areaId)},{" "}
                      {getGovernorateName(branch.governorateId)}
                    </span>
                  </p>
                </div>

                {/* Hours, services and contact are all branch-level facts. */}
                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  <a
                    href={`tel:${branch.phone}`}
                    className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2 transition-colors hover:bg-accent"
                  >
                    <Phone className="size-3.5 shrink-0 text-primary" />
                    <span className="truncate tabular-nums ltr-nums">
                      {branch.phone}
                    </span>
                  </a>

                  <p className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2">
                    <Clock className="size-3.5 shrink-0 text-primary" />
                    <span className="truncate">{branch.openingHours}</span>
                  </p>

                  <p className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2">
                    <ListChecks className="size-3.5 shrink-0 text-primary" />
                    <span className="truncate">
                      {t("branches.servicesOffered", {
                        count: branch.serviceIds.length,
                      })}
                    </span>
                  </p>

                  <p className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2">
                    <Clock className="size-3.5 shrink-0 text-primary" />
                    <span className="truncate">
                      {days.length > 0
                        ? days.join(" · ")
                        : t("branches.noWorkingDays")}
                    </span>
                  </p>
                </div>

                {Object.keys(branch.priceOverrides).length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {t("branches.priceOverrides")}
                  </p>
                )}

                <MapPlaceholder
                  center={branch.location}
                  address={branch.address}
                  height={220}
                  markers={[
                    {
                      id: branch.id,
                      label: branch.name,
                      location: branch.location,
                      isPrimary: true,
                    },
                  ]}
                />
              </CardContent>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
