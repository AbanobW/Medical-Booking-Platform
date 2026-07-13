"use client";

import { Building2, CalendarOff, Info, Plus, Save, Trash2 } from "lucide-react";
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
import { TODAY, todayISO, toISODate } from "@/lib/data/seed";
import { formatDate } from "@/lib/format";
import {
  CAPACITY_LABELS,
  schedulingModeFor,
  WEEKDAY_NAMES,
  type CapacityType,
  type DaySchedule,
  type SchedulingMode,
  type Weekday,
} from "@/lib/types";

const WEEKDAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6];

const SLOT_OPTIONS = [15, 20, 30, 45, 60].map((n) => ({
  value: String(n),
  label: `${n} minutes`,
}));

const CAPACITY_TYPE_OPTIONS: { value: CapacityType; label: string }[] = [
  { value: "comfort", label: CAPACITY_LABELS.comfort },
  { value: "strict", label: CAPACITY_LABELS.strict },
];

/** Doctors run sessions; labs and radiology centers run slots (§5). */
const COPY: Record<
  SchedulingMode,
  {
    capacityLabel: (n: number) => string;
    capacityHint: string;
    slotLabel: string;
    slotHint: string;
  }
> = {
  session: {
    capacityLabel: (n) => `Session capacity: ${n} patient${n === 1 ? "" : "s"}`,
    capacityHint:
      "Patients join the session and get a queue number with an estimated time — not an exact minute.",
    slotLabel: "Minutes per patient",
    slotHint: "Used to estimate when each queue number will be seen.",
  },
  slot: {
    capacityLabel: (n) => `Places per slot: ${n}`,
    capacityHint:
      "Each slot is a real appointment time. Capacity is how many patients can be handled in the same slot.",
    slotLabel: "Slot length",
    slotHint: "The gap between one appointment and the next.",
  },
};

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
  const [date, setDate] = useState(toISODate(TODAY));
  const [reason, setReason] = useState("");

  const mode: SchedulingMode = provider
    ? schedulingModeFor(provider.type)
    : "slot";
  const copy = COPY[mode];
  const branch = provider?.branches.find((b) => b.id === branchId);

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
      toast.success(`Working hours saved for ${branch?.name ?? "this branch"}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save your schedule.");
    }
  }

  async function onAddHoliday() {
    if (!date) {
      toast.error("Pick a date first.");
      return;
    }
    try {
      await create.mutate(providerId, date, reason.trim() || "Closed");
      setDialogOpen(false);
      setReason("");
      holidaysState.refetch();
      toast.success("Holiday added.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't add that holiday.");
    }
  }

  async function onRemoveHoliday(id: string) {
    try {
      await destroy.mutate(id);
      holidaysState.refetch();
      toast.success("Holiday removed.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't remove that holiday.");
    }
  }

  if (providerLoading && !provider) return <ListSkeleton count={5} />;

  if (!provider) {
    return (
      <EmptyState
        title="No provider profile"
        description="This account isn't linked to a provider listing yet."
      />
    );
  }

  if (provider.branches.length === 0) {
    return (
      <EmptyState
        icon={Building2}
        title="No branches yet"
        description="Schedules live on branches. Contact the Vesita team to add your first branch."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------- branch switcher */}
      <Card>
        <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="w-full space-y-1.5 lg:max-w-sm">
            <Label htmlFor="branch">Branch</Label>
            <AppSelect
              id="branch"
              value={branchId}
              onValueChange={(value) => setBranchId(value)}
              options={provider.branches.map((b) => ({
                value: b.id,
                label: b.isActive ? b.name : `${b.name} (inactive)`,
              }))}
              placeholder="Pick a branch"
              className="h-10"
            />
            <p className="text-xs text-muted-foreground">
              Each branch keeps its own working hours, capacity and services —
              editing here changes {branch?.name ?? "this branch"} only.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {branch && (
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
                Weekly working hours{branch ? ` · ${branch.name}` : ""}
              </CardTitle>
              <CardDescription>
                {mode === "session"
                  ? "Each working day is one session. Patients join it and receive a queue number."
                  : "Slots are generated from these windows, minus your breaks."}
              </CardDescription>
            </div>
            <Button
              onClick={onSave}
              disabled={!dirty || save.isPending || scheduleState.isLoading}
              className="h-10 rounded-xl px-4"
            >
              <Save className="size-4" />
              {save.isPending ? "Saving…" : "Save changes"}
            </Button>
          </CardHeader>

          <CardContent className="space-y-4">
            <Alert>
              <Info className="size-4" />
              <AlertTitle>Comfort limits and strict limits</AlertTitle>
              <AlertDescription>
                A <strong>comfort limit</strong> is a soft one: you can knowingly
                see one more patient — it just means a longer evening, and the
                patient is warned about the wait before they take the place. A{" "}
                <strong>strict limit</strong> is physical — how many scans a
                machine can do, say — and is <strong>never exceeded</strong>, even
                when two patients try to take the last place at once.
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
                title="Couldn't load this branch's schedule"
                description={scheduleState.error.message}
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
                          {WEEKDAY_NAMES[day.weekday]}
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
                          {copy.capacityLabel(day.capacity)} ·{" "}
                          {day.capacityType === "strict" ? "strict" : "comfort"}
                        </Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          Closed all day
                        </span>
                      )}
                    </div>

                    {day.isWorkingDay && (
                      <>
                        <div className="grid gap-3 sm:grid-cols-3">
                          <div className="space-y-1.5">
                            <Label htmlFor={`start-${day.weekday}`}>Opens</Label>
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
                            <Label htmlFor={`end-${day.weekday}`}>Closes</Label>
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
                              {copy.slotLabel}
                            </Label>
                            <AppSelect
                              id={`slot-${day.weekday}`}
                              value={String(day.slotDurationMinutes)}
                              onValueChange={(value) =>
                                patchDay(day.weekday, {
                                  slotDurationMinutes: Number(value) || 30,
                                })
                              }
                              options={SLOT_OPTIONS}
                              className="h-10"
                              aria-label={`${copy.slotLabel} on ${WEEKDAY_NAMES[day.weekday]}`}
                            />
                            <p className="text-xs text-muted-foreground">
                              {copy.slotHint}
                            </p>
                          </div>
                        </div>

                        {/* ------------------------------------- capacity */}
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <Label htmlFor={`capacity-${day.weekday}`}>
                              {mode === "session"
                                ? "Session capacity (patients)"
                                : "Places per slot"}
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
                              {copy.capacityHint}
                            </p>
                          </div>

                          <div className="space-y-1.5">
                            <Label htmlFor={`captype-${day.weekday}`}>
                              How firm is that limit?
                            </Label>
                            <AppSelect
                              id={`captype-${day.weekday}`}
                              value={day.capacityType}
                              onValueChange={(value) =>
                                patchDay(day.weekday, {
                                  capacityType: (value || "comfort") as CapacityType,
                                })
                              }
                              options={CAPACITY_TYPE_OPTIONS}
                              className="h-10"
                              aria-label={`Capacity type on ${WEEKDAY_NAMES[day.weekday]}`}
                            />
                            <p className="text-xs text-muted-foreground">
                              {day.capacityType === "strict"
                                ? "Never exceeded — the last place is the last place."
                                : "May run over knowingly: the patient is told the wait is longer and chooses."}
                            </p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label>Breaks</Label>
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
                              Add break
                            </Button>
                          </div>

                          {day.breaks.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                              No breaks — slots run straight through.
                            </p>
                          ) : (
                            day.breaks.map((slot, index) => (
                              <div
                                key={index}
                                className="flex flex-wrap items-center gap-2"
                              >
                                <Input
                                  type="time"
                                  aria-label="Break starts"
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
                                  aria-label="Break ends"
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
                                  aria-label="Remove break"
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
                <CardTitle className="text-base">Holidays</CardTitle>
                <CardDescription>
                  Dates you are closed, overriding the week at every branch.
                </CardDescription>
              </div>

              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <Button size="sm" onClick={() => setDialogOpen(true)}>
                  <Plus className="size-3.5" />
                  Add
                </Button>

                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add a holiday</DialogTitle>
                    <DialogDescription>
                      Bookings can&apos;t be made on this date.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="holiday-date">Date</Label>
                      <Input
                        id="holiday-date"
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="h-10 rounded-xl"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="holiday-reason">Reason</Label>
                      <Input
                        id="holiday-reason"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Eid al-Adha, annual leave…"
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
                      Cancel
                    </Button>
                    <Button
                      onClick={onAddHoliday}
                      disabled={create.isPending}
                      className="h-10 rounded-xl px-4"
                    >
                      {create.isPending ? "Adding…" : "Add holiday"}
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
                  title="Couldn't load your holidays"
                  description={holidaysState.error.message}
                  onRetry={holidaysState.refetch}
                />
              ) : (holidaysState.data ?? []).length === 0 ? (
                <EmptyState
                  icon={CalendarOff}
                  title="No holidays yet"
                  description="Add the dates you'll be closed so patients can't book them."
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
                            aria-label={`Remove holiday on ${holiday.date}`}
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        }
                        title="Remove this holiday?"
                        description={`${formatDate(holiday.date)} will become bookable again if it falls on a working day.`}
                        confirmLabel="Remove"
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
