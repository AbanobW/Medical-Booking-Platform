"use client";

import { Building2, CalendarOff, Info, Plus, Save, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { CancelSessionDialog } from "@/components/provider/cancel-session-dialog";
import { ConfirmDialog } from "@/components/provider/confirm-dialog";
import { ScheduleCalendar } from "@/components/provider/schedule-calendar";
import { useCurrentProvider } from "@/components/provider/use-current-provider";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/shared/states";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AppSelect } from "@/components/ui/app-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useAsync, useMutation } from "@/hooks/use-async";
import { getBookings } from "@/lib/api/bookings";
import {
  addHoliday,
  getHolidays,
  getSchedule,
  removeHoliday,
  updateSchedule,
} from "@/lib/api/provider-admin";
import { now, toISODate, todayISO } from "@/lib/time";
import { useApiError } from "@/lib/i18n/use-api-error";
import { useFormat } from "@/lib/i18n/use-format";
import { useLabels } from "@/lib/i18n/use-labels";
import {
  schedulingModeFor,
  type CapacityType,
  type DaySchedule,
  type SchedulingMode,
  type Weekday,
} from "@/lib/types";

const WEEKDAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6];

/** `Weekday` is an index; the `domain.weekday.*` messages are keyed by name. */
const WEEKDAY_KEYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

const SLOT_MINUTES = [15, 20, 30, 45, 60];

/** Guarantees all seven days exist, so the editor never renders a hole. */
function normalize(schedule: DaySchedule[]): DaySchedule[] {
  return WEEKDAYS.map(
    (weekday) =>
      schedule.find((d) => d.weekday === weekday) ?? {
        weekday,
        isWorkingDay: false,
        startTime: "09:00",
        endTime: "17:00",
        slotDurationMinutes: 30,
        breaks: [],
        capacity: 10,
        capacityType: "comfort" as CapacityType,
      },
  );
}

export default function ProviderSchedulePage() {
  const t = useTranslations("provider");
  const tDomain = useTranslations("domain");
  const tCommon = useTranslations("common");
  const describeError = useApiError();
  const { formatDate } = useFormat();
  const L = useLabels();

  const { providerId, provider, isLoading: providerLoading } = useCurrentProvider();

  const [branchId, setBranchId] = useState("");

  // Availability is always resolved at the branch level (§2), so the editor
  // works on one branch at a time.
  useEffect(() => {
    if (provider && !branchId && provider.branches.length > 0) {
      setBranchId(provider.branches[0].id);
    }
  }, [provider, branchId]);

  const scheduleState = useAsync(
    () =>
      branchId
        ? getSchedule(providerId, branchId)
        : Promise.resolve<DaySchedule[]>([]),
    [providerId, branchId],
  );
  const holidaysState = useAsync(() => getHolidays(providerId), [providerId]);
  const bookingsState = useAsync(
    () => getBookings({ providerId, page: 1, pageSize: 500 }),
    [providerId],
  );

  const [draft, setDraft] = useState<DaySchedule[]>([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (scheduleState.data) {
      setDraft(normalize(scheduleState.data));
      setDirty(false);
    }
  }, [scheduleState.data]);

  const save = useMutation(updateSchedule);
  const create = useMutation(addHoliday);
  const destroy = useMutation(removeHoliday);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [date, setDate] = useState(toISODate(now()));
  const [reason, setReason] = useState("");

  const mode: SchedulingMode = provider
    ? schedulingModeFor(provider.type)
    : "slot";
  const branch = provider?.branches.find((b) => b.id === branchId);

  /** Doctors run sessions; labs and radiology centers run slots (§5). */
  const isSession = mode === "session";
  const slotLabel = isSession
    ? t("schedule.slotLabelSession")
    : t("schedule.slotLabelSlot");
  const slotHint = isSession
    ? t("schedule.slotHintSession")
    : t("schedule.slotHintSlot");
  const capacityLabel = isSession
    ? t("schedule.capacityLabelSession")
    : t("schedule.capacityLabelSlot");
  const capacityHint = isSession
    ? t("schedule.capacityHintSession")
    : t("schedule.capacityHintSlot");

  const slotOptions = SLOT_MINUTES.map((n) => ({
    value: String(n),
    label: t("schedule.slotMinutes", { count: n }),
  }));

  const capacityTypeOptions: { value: CapacityType; label: string }[] = [
    { value: "comfort", label: L.capacity("comfort") },
    { value: "strict", label: L.capacity("strict") },
  ];

  const weekdayName = (weekday: Weekday) =>
    tDomain(`weekday.${WEEKDAY_KEYS[weekday]}`);

  const capacityBadge = (day: DaySchedule) =>
    isSession
      ? t("schedule.capacityBadgeSession", { count: day.capacity })
      : t("schedule.capacityBadgeSlot", { count: day.capacity });

  function patchDay(weekday: Weekday, patch: Partial<DaySchedule>) {
    setDraft((current) =>
      current.map((day) => (day.weekday === weekday ? { ...day, ...patch } : day)),
    );
    setDirty(true);
  }

  async function onSave() {
    try {
      const saved = await save.mutate(providerId, draft, branchId);
      scheduleState.setData(saved);
      setDirty(false);
      toast.success(
        t("schedule.saved", { branch: branch?.name ?? t("shared.thisBranch") }),
      );
    } catch (error) {
      toast.error(describeError(error));
    }
  }

  async function onAddHoliday() {
    if (!date) {
      toast.error(t("schedule.pickDateFirst"));
      return;
    }
    try {
      await create.mutate(
        providerId,
        date,
        reason.trim() || t("schedule.holidayDefaultReason"),
      );
      setDialogOpen(false);
      setReason("");
      holidaysState.refetch();
      toast.success(t("schedule.holidayAdded"));
    } catch (error) {
      toast.error(describeError(error));
    }
  }

  async function onRemoveHoliday(id: string) {
    try {
      await destroy.mutate(id);
      holidaysState.refetch();
      toast.success(t("schedule.holidayRemoved"));
    } catch (error) {
      toast.error(describeError(error));
    }
  }

  if (providerLoading && !provider) return <ListSkeleton count={5} />;

  if (!provider) {
    return (
      <EmptyState
        title={t("shared.noProfileTitle")}
        description={t("shared.noProfileDescription")}
      />
    );
  }

  if (provider.branches.length === 0) {
    return (
      <EmptyState
        icon={Building2}
        title={t("schedule.noBranchesTitle")}
        description={t("schedule.noBranchesDescription")}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------- branch switcher */}
      <Card>
        <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="w-full space-y-1.5 lg:max-w-sm">
            <Label htmlFor="branch">{t("schedule.branch")}</Label>
            <AppSelect
              id="branch"
              value={branchId}
              onValueChange={(value) => setBranchId(value)}
              options={provider.branches.map((b) => ({
                value: b.id,
                label: b.isActive
                  ? b.name
                  : t("schedule.branchInactive", { name: b.name }),
              }))}
              placeholder={t("schedule.branchPlaceholder")}
              className="h-10"
            />
            <p className="text-xs text-muted-foreground">
              {t("schedule.branchHint", {
                branch: branch?.name ?? t("shared.thisBranch"),
              })}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {branch?.address && (
              <Badge variant="outline" className="font-normal">
                {branch.address}
              </Badge>
            )}
            <CancelSessionDialog
              provider={provider}
              bookings={bookingsState.data?.items ?? []}
              today={todayISO()}
              onCancelled={bookingsState.refetch}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        {/* ------------------------------------------------- working hours */}
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <CardTitle className="text-base">
                {branch
                  ? t("schedule.workingHoursAt", { branch: branch.name })
                  : t("schedule.workingHours")}
              </CardTitle>
              <CardDescription>
                {isSession
                  ? t("schedule.workingHoursDescriptionSession")
                  : t("schedule.workingHoursDescriptionSlot")}
              </CardDescription>
            </div>
            <Button
              onClick={onSave}
              disabled={!dirty || save.isPending || scheduleState.isLoading}
              className="h-10 rounded-xl px-4"
            >
              <Save className="size-4" />
              {save.isPending
                ? tCommon("states.saving")
                : tCommon("actions.saveChanges")}
            </Button>
          </CardHeader>

          <CardContent className="space-y-4">
            <Alert>
              <Info className="size-4" />
              <AlertTitle>{t("schedule.limitsAlertTitle")}</AlertTitle>
              <AlertDescription>
                {t.rich("schedule.limitsAlertBody", {
                  strong: (chunks) => <strong>{chunks}</strong>,
                })}
              </AlertDescription>
            </Alert>

            {scheduleState.isLoading && !scheduleState.data ? (
              <div className="space-y-3">
                {Array.from({ length: 7 }, (_, i) => (
                  <Skeleton key={i} className="h-28 w-full rounded-2xl" />
                ))}
              </div>
            ) : scheduleState.error ? (
              <ErrorState
                title={t("schedule.scheduleError")}
                description={describeError(scheduleState.error)}
                onRetry={scheduleState.refetch}
              />
            ) : (
              <div className="space-y-3">
                {draft.map((day) => (
                  <div
                    key={day.weekday}
                    className="space-y-4 rounded-2xl border bg-card p-4"
                  >
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex items-center gap-3">
                        <Switch
                          id={`working-${day.weekday}`}
                          checked={day.isWorkingDay}
                          onCheckedChange={(checked: boolean) =>
                            patchDay(day.weekday, { isWorkingDay: checked })
                          }
                        />
                        <Label
                          htmlFor={`working-${day.weekday}`}
                          className="w-24 font-medium"
                        >
                          {weekdayName(day.weekday)}
                        </Label>
                      </div>

                      {day.isWorkingDay ? (
                        <Badge
                          variant="secondary"
                          className={
                            day.capacityType === "strict"
                              ? "bg-destructive/10 text-destructive"
                              : "bg-info/10 text-info"
                          }
                        >
                          {capacityBadge(day)} ·{" "}
                          {day.capacityType === "strict"
                            ? t("schedule.limitShortStrict")
                            : t("schedule.limitShortComfort")}
                        </Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          {t("schedule.closedAllDay")}
                        </span>
                      )}
                    </div>

                    {day.isWorkingDay && (
                      <>
                        <div className="grid gap-3 sm:grid-cols-3">
                          <div className="space-y-1.5">
                            <Label htmlFor={`start-${day.weekday}`}>
                              {t("schedule.opens")}
                            </Label>
                            <Input
                              id={`start-${day.weekday}`}
                              type="time"
                              value={day.startTime}
                              onChange={(e) =>
                                patchDay(day.weekday, { startTime: e.target.value })
                              }
                              className="h-10 rounded-xl"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor={`end-${day.weekday}`}>
                              {t("schedule.closes")}
                            </Label>
                            <Input
                              id={`end-${day.weekday}`}
                              type="time"
                              value={day.endTime}
                              onChange={(e) =>
                                patchDay(day.weekday, { endTime: e.target.value })
                              }
                              className="h-10 rounded-xl"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor={`slot-${day.weekday}`}>
                              {slotLabel}
                            </Label>
                            <AppSelect
                              id={`slot-${day.weekday}`}
                              value={String(day.slotDurationMinutes)}
                              onValueChange={(value) =>
                                patchDay(day.weekday, {
                                  slotDurationMinutes: Number(value) || 30,
                                })
                              }
                              options={slotOptions}
                              className="h-10"
                              aria-label={t("schedule.slotAria", {
                                label: slotLabel,
                                day: weekdayName(day.weekday),
                              })}
                            />
                            <p className="text-xs text-muted-foreground">
                              {slotHint}
                            </p>
                          </div>
                        </div>

                        {/* ------------------------------------- capacity */}
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <Label htmlFor={`capacity-${day.weekday}`}>
                              {capacityLabel}
                            </Label>
                            <Input
                              id={`capacity-${day.weekday}`}
                              type="number"
                              min={1}
                              step={1}
                              value={String(day.capacity)}
                              onChange={(e) =>
                                patchDay(day.weekday, {
                                  capacity: Math.max(
                                    1,
                                    Math.round(Number(e.target.value) || 1),
                                  ),
                                })
                              }
                              className="h-10 rounded-xl"
                            />
                            <p className="text-xs text-muted-foreground">
                              {capacityHint}
                            </p>
                          </div>

                          <div className="space-y-1.5">
                            <Label htmlFor={`captype-${day.weekday}`}>
                              {t("schedule.capacityTypeLabel")}
                            </Label>
                            <AppSelect
                              id={`captype-${day.weekday}`}
                              value={day.capacityType}
                              onValueChange={(value) =>
                                patchDay(day.weekday, {
                                  capacityType: (value || "comfort") as CapacityType,
                                })
                              }
                              options={capacityTypeOptions}
                              className="h-10"
                              aria-label={t("schedule.capacityTypeAria", {
                                day: weekdayName(day.weekday),
                              })}
                            />
                            <p className="text-xs text-muted-foreground">
                              {day.capacityType === "strict"
                                ? t("schedule.capacityTypeHintStrict")
                                : t("schedule.capacityTypeHintComfort")}
                            </p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label>{t("schedule.breaks")}</Label>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                patchDay(day.weekday, {
                                  breaks: [
                                    ...day.breaks,
                                    { startTime: "13:00", endTime: "14:00" },
                                  ],
                                })
                              }
                            >
                              <Plus className="size-3.5" />
                              {t("schedule.addBreak")}
                            </Button>
                          </div>

                          {day.breaks.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                              {t("schedule.noBreaks")}
                            </p>
                          ) : (
                            day.breaks.map((slot, index) => (
                              <div
                                key={index}
                                className="flex flex-wrap items-center gap-2"
                              >
                                <Input
                                  type="time"
                                  aria-label={t("schedule.breakStarts")}
                                  value={slot.startTime}
                                  onChange={(e) =>
                                    patchDay(day.weekday, {
                                      breaks: day.breaks.map((b, i) =>
                                        i === index
                                          ? { ...b, startTime: e.target.value }
                                          : b,
                                      ),
                                    })
                                  }
                                  className="h-10 w-32 rounded-xl"
                                />
                                <span className="text-muted-foreground">–</span>
                                <Input
                                  type="time"
                                  aria-label={t("schedule.breakEnds")}
                                  value={slot.endTime}
                                  onChange={(e) =>
                                    patchDay(day.weekday, {
                                      breaks: day.breaks.map((b, i) =>
                                        i === index
                                          ? { ...b, endTime: e.target.value }
                                          : b,
                                      ),
                                    })
                                  }
                                  className="h-10 w-32 rounded-xl"
                                />
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={t("schedule.removeBreak")}
                                  onClick={() =>
                                    patchDay(day.weekday, {
                                      breaks: day.breaks.filter(
                                        (_, i) => i !== index,
                                      ),
                                    })
                                  }
                                >
                                  <Trash2 className="size-4 text-destructive" />
                                </Button>
                              </div>
                            ))
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ----------------------------------------------------- calendar */}
        <div className="space-y-6">
          {scheduleState.isLoading && !scheduleState.data ? (
            <Skeleton className="h-[420px] w-full rounded-2xl" />
          ) : (
            <ScheduleCalendar
              schedule={draft}
              holidays={holidaysState.data ?? []}
              branchName={branch?.name}
              mode={mode}
            />
          )}

          {/* -------------------------------------------------- holidays */}
          <Card>
            <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
              <div>
                <CardTitle className="text-base">
                  {t("schedule.holidays")}
                </CardTitle>
                <CardDescription>
                  {t("schedule.holidaysDescription")}
                </CardDescription>
              </div>

              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <Button size="sm" onClick={() => setDialogOpen(true)}>
                  <Plus className="size-3.5" />
                  {tCommon("actions.add")}
                </Button>

                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t("schedule.addHolidayTitle")}</DialogTitle>
                    <DialogDescription>
                      {t("schedule.addHolidayDescription")}
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="holiday-date">
                        {t("schedule.holidayDate")}
                      </Label>
                      <Input
                        id="holiday-date"
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="h-10 rounded-xl"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="holiday-reason">
                        {t("schedule.holidayReason")}
                      </Label>
                      <Input
                        id="holiday-reason"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder={t("schedule.holidayReasonPlaceholder")}
                        className="h-10 rounded-xl"
                      />
                    </div>
                  </div>

                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setDialogOpen(false)}
                      className="h-10 rounded-xl px-4"
                    >
                      {tCommon("actions.cancel")}
                    </Button>
                    <Button
                      onClick={onAddHoliday}
                      disabled={create.isPending}
                      className="h-10 rounded-xl px-4"
                    >
                      {create.isPending
                        ? t("schedule.addingHoliday")
                        : t("schedule.addHoliday")}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>

            <CardContent>
              {holidaysState.isLoading && !holidaysState.data ? (
                <ListSkeleton count={3} />
              ) : holidaysState.error ? (
                <ErrorState
                  title={t("schedule.holidaysError")}
                  description={describeError(holidaysState.error)}
                  onRetry={holidaysState.refetch}
                />
              ) : (holidaysState.data ?? []).length === 0 ? (
                <EmptyState
                  icon={CalendarOff}
                  title={t("schedule.noHolidaysTitle")}
                  description={t("schedule.noHolidaysDescription")}
                />
              ) : (
                <ul className="space-y-2">
                  {(holidaysState.data ?? []).map((holiday) => (
                    <li
                      key={holiday.id}
                      className="flex items-center gap-3 rounded-xl border bg-card p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {formatDate(holiday.date)}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {holiday.reason}
                        </p>
                      </div>

                      <ConfirmDialog
                        trigger={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={t("schedule.removeHolidayAria", {
                              date: formatDate(holiday.date),
                            })}
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        }
                        title={t("schedule.removeHolidayTitle")}
                        description={t("schedule.removeHolidayDescription", {
                          date: formatDate(holiday.date),
                        })}
                        confirmLabel={tCommon("actions.remove")}
                        isPending={destroy.isPending}
                        onConfirm={() => onRemoveHoliday(holiday.id)}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
