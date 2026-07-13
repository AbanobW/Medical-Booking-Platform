"use client";

import { Clock, ListChecks, MapPin, Phone } from "lucide-react";

import { MapPlaceholder } from "@/components/shared/map-placeholder";
import { EmptyState } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getAreaName, getGovernorateName } from "@/lib/data/egypt";
import { TODAY } from "@/lib/data/seed";
import { formatTime } from "@/lib/format";
import { WEEKDAY_NAMES, type Branch, type Weekday } from "@/lib/types";

const ORDER: Weekday[] = [6, 0, 1, 2, 3, 4, 5]; // Saturday-first, as in Egypt.

/** A compact "Sat–Thu 10:00 AM – 6:00 PM" style summary of a branch's week. */
function openDaysOf(branch: Branch): string[] {
  return ORDER.filter(
    (weekday) =>
      branch.schedule.find((d) => d.weekday === weekday)?.isWorkingDay ?? false,
  ).map((weekday) => WEEKDAY_NAMES[weekday].slice(0, 3));
}

/**
 * Every branch, with the things that actually differ between them (§2):
 * its own opening hours, its own slice of the service catalogue, its own
 * address, phone and map.
 */
export function BranchesSection({
  branches,
  emptyDescription = "This provider operates from its main location only.",
}: {
  branches: Branch[];
  emptyDescription?: string;
}) {
  const today = TODAY.getUTCDay() as Weekday;

  if (branches.length === 0) {
    return (
      <EmptyState
        icon={MapPin}
        title="No branches listed"
        description={emptyDescription}
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
                        Temporarily closed
                      </Badge>
                    ) : todaySchedule ? (
                      <Badge
                        variant="secondary"
                        className="bg-success/10 font-normal text-success tabular-nums"
                      >
                        Open today · {formatTime(todaySchedule.startTime)} –{" "}
                        {formatTime(todaySchedule.endTime)}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="font-normal">
                        Closed today
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
                    <span className="truncate tabular-nums">{branch.phone}</span>
                  </a>

                  <p className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2">
                    <Clock className="size-3.5 shrink-0 text-primary" />
                    <span className="truncate">{branch.openingHours}</span>
                  </p>

                  <p className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2">
                    <ListChecks className="size-3.5 shrink-0 text-primary" />
                    <span className="truncate">
                      {branch.serviceIds.length}{" "}
                      {branch.serviceIds.length === 1 ? "service" : "services"}{" "}
                      offered here
                    </span>
                  </p>

                  <p className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2">
                    <Clock className="size-3.5 shrink-0 text-primary" />
                    <span className="truncate">
                      {days.length > 0 ? days.join(" · ") : "No working days"}
                    </span>
                  </p>
                </div>

                {Object.keys(branch.priceOverrides).length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Some services are priced differently at this branch — the price
                    you see when you pick this branch is the price you pay.
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
