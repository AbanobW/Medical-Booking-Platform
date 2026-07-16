"use client";

import { BellOff, CheckCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { NotificationPreferencesCard } from "@/components/patient/notification-preferences";
import { useAuth } from "@/components/providers/auth-provider";
import {
  CHANNEL_ICONS,
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
import { useApiError } from "@/lib/i18n/use-api-error";
import type { AppNotification, NotificationChannel } from "@/lib/types";

type ChannelTab = "all" | NotificationChannel;
type ReadFilter = "all" | "unread" | "read";

const CHANNEL_TABS: ChannelTab[] = ["all", "sms", "email", "whatsapp", "browser"];

const READ_FILTERS: ReadFilter[] = ["all", "unread", "read"];

export default function PatientNotificationsPage() {
  const t = useTranslations("patient");
  const describeError = useApiError();

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
      toast.error(t("notifications.readFailed"));
      refetch();
    }
  }

  async function onDelete(id: string) {
    setData((current) => (current ?? []).filter((n) => n.id !== id));

    try {
      await deleteNotification(id);
      toast.success(t("notifications.deleted"));
    } catch {
      toast.error(t("notifications.deleteFailed"));
      refetch();
    }
  }

  async function onMarkAllRead() {
    if (!patientId || unreadCount === 0) return;

    setData((current) => (current ?? []).map((n) => ({ ...n, isRead: true })));

    try {
      const result = await markAllNotificationsRead(patientId);
      toast.success(t("notifications.markedAllRead", { count: result.count }));
    } catch {
      toast.error(t("notifications.markAllFailed"));
      refetch();
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              {t("notifications.title")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {unreadCount > 0
                ? t("notifications.unread", { count: unreadCount })
                : t("notifications.caughtUp")}
            </p>
          </div>

          <Button
            variant="outline"
            onClick={onMarkAllRead}
            disabled={unreadCount === 0}
            className="h-10 rounded-xl px-4"
          >
            <CheckCheck className="size-4" />
            {t("notifications.markAllRead")}
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {READ_FILTERS.map((filter) => (
            <Button
              key={filter}
              variant={readFilter === filter ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setReadFilter(filter)}
              className="rounded-lg"
            >
              {t(`notifications.filters.${filter}`)}
              {filter === "unread" && unreadCount > 0 && (
                <Badge variant="default" className="ms-1">
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
                  {tab === "all"
                    ? t("notifications.all")
                    : t(`notifications.channel.${tab}`)}
                  <span className="ms-1 text-xs tabular-nums text-muted-foreground">
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
                    title={t("notifications.error")}
                    description={describeError(error)}
                    onRetry={refetch}
                  />
                ) : visible.length === 0 ? (
                  <EmptyState
                    icon={BellOff}
                    title={t("notifications.emptyTitle")}
                    description={
                      readFilter === "unread"
                        ? t("notifications.emptyUnread")
                        : t("notifications.emptyDescription")
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
