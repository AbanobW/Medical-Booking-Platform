"use client";

import { BellOff, CheckCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { NotificationPreferencesCard } from "@/components/patient/notification-preferences";
import { useAuth } from "@/components/providers/auth-provider";
import {
  CHANNEL_ICONS,
  CHANNEL_LABELS,
  NotificationItem,
} from "@/components/shared/notification-center";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAsync } from "@/hooks/use-async";
import {
  deleteNotification,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/api/engagement";
import type { AppNotification, NotificationChannel } from "@/lib/types";

type ChannelTab = "all" | NotificationChannel;
type ReadFilter = "all" | "unread" | "read";

const CHANNEL_TABS: ChannelTab[] = ["all", "sms", "email", "whatsapp", "browser"];

const READ_FILTERS: { value: ReadFilter; label: string }[] = [
  { value: "all", label: "Everything" },
  { value: "unread", label: "Unread" },
  { value: "read", label: "Read" },
];

export default function PatientNotificationsPage() {
  const { user } = useAuth();
  const patientId = user?.id ?? "";

  const { data, error, isLoading, refetch, setData } = useAsync(
    () => getNotifications(patientId),
    [patientId],
  );

  const [channel, setChannel] = useState<ChannelTab>("all");
  const [readFilter, setReadFilter] = useState<ReadFilter>("all");

  const notifications = data ?? [];
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  function matches(notification: AppNotification, tab: ChannelTab): boolean {
    if (tab !== "all" && notification.channel !== tab) return false;
    if (readFilter === "unread" && notification.isRead) return false;
    if (readFilter === "read" && !notification.isRead) return false;
    return true;
  }

  const countFor = (tab: ChannelTab) =>
    tab === "all"
      ? notifications.length
      : notifications.filter((n) => n.channel === tab).length;

  async function onRead(id: string) {
    setData((current) =>
      (current ?? []).map((n) => (n.id === id ? { ...n, isRead: true } : n)),
    );

    try {
      await markNotificationRead(id);
    } catch {
      toast.error("Couldn't mark that as read.");
      refetch();
    }
  }

  async function onDelete(id: string) {
    setData((current) => (current ?? []).filter((n) => n.id !== id));

    try {
      await deleteNotification(id);
      toast.success("Notification deleted.");
    } catch {
      toast.error("Couldn't delete that notification.");
      refetch();
    }
  }

  async function onMarkAllRead() {
    if (!patientId || unreadCount === 0) return;

    setData((current) => (current ?? []).map((n) => ({ ...n, isRead: true })));

    try {
      const result = await markAllNotificationsRead(patientId);
      toast.success(`Marked ${result.count} notifications as read.`);
    } catch {
      toast.error("Couldn't mark everything as read.");
      refetch();
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Notifications</h2>
            <p className="text-sm text-muted-foreground">
              {unreadCount > 0
                ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}.`
                : "You're all caught up."}
            </p>
          </div>

          <Button
            variant="outline"
            onClick={onMarkAllRead}
            disabled={unreadCount === 0}
            className="h-10 rounded-xl px-4"
          >
            <CheckCheck className="size-4" />
            Mark all read
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {READ_FILTERS.map((filter) => (
            <Button
              key={filter.value}
              variant={readFilter === filter.value ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setReadFilter(filter.value)}
              className="rounded-lg"
            >
              {filter.label}
              {filter.value === "unread" && unreadCount > 0 && (
                <Badge variant="default" className="ml-1">
                  {unreadCount}
                </Badge>
              )}
            </Button>
          ))}
        </div>

        <Tabs
          value={channel}
          onValueChange={(value) => setChannel(String(value) as ChannelTab)}
          className="space-y-4"
        >
          <TabsList className="w-full flex-wrap sm:w-auto">
            {CHANNEL_TABS.map((tab) => {
              const Icon = tab === "all" ? null : CHANNEL_ICONS[tab];

              return (
                <TabsTrigger key={tab} value={tab}>
                  {Icon && <Icon />}
                  {tab === "all" ? "All" : CHANNEL_LABELS[tab]}
                  <span className="ml-1 text-xs tabular-nums text-muted-foreground">
                    {countFor(tab)}
                  </span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {CHANNEL_TABS.map((tab) => {
            const visible = notifications.filter((n) => matches(n, tab));

            return (
              <TabsContent key={tab} value={tab}>
                {isLoading ? (
                  <ListSkeleton count={5} />
                ) : error ? (
                  <ErrorState
                    title="Couldn't load your notifications"
                    description={error.message}
                    onRetry={refetch}
                  />
                ) : visible.length === 0 ? (
                  <EmptyState
                    icon={BellOff}
                    title="Nothing here"
                    description={
                      readFilter === "unread"
                        ? "No unread notifications on this channel."
                        : "New booking updates and offers will show up here."
                    }
                  />
                ) : (
                  <Card>
                    <CardContent className="space-y-1 p-2">
                      {visible.map((notification) => (
                        <NotificationItem
                          key={notification.id}
                          notification={notification}
                          onRead={onRead}
                          onDelete={onDelete}
                        />
                      ))}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      </div>

      <div className="xl:sticky xl:top-24 xl:self-start">
        <NotificationPreferencesCard />
      </div>
    </div>
  );
}
