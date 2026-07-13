"use client";

import Link from "next/link";
import {
  Bell,
  BellOff,
  CalendarCheck,
  CalendarX,
  Check,
  Clock,
  Mail,
  MessageCircle,
  MessageSquare,
  Star,
  Tag,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/components/providers/auth-provider";
import { EmptyState } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useAsync } from "@/hooks/use-async";
import {
  deleteNotification,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/api/engagement";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AppNotification, NotificationChannel, NotificationKind } from "@/lib/types";

const KIND_ICONS: Record<NotificationKind, LucideIcon> = {
  booking_confirmed: CalendarCheck,
  booking_cancelled: CalendarX,
  booking_reminder: Clock,
  review_request: Star,
  promo: Tag,
  system: Bell,
};

const KIND_TONES: Record<NotificationKind, string> = {
  booking_confirmed: "bg-success/10 text-success",
  booking_cancelled: "bg-destructive/10 text-destructive",
  booking_reminder: "bg-info/10 text-info",
  review_request: "bg-warning/15 text-warning",
  promo: "bg-primary/10 text-primary",
  system: "bg-muted text-muted-foreground",
};

/** The delivery channel each notification went out on. */
export const CHANNEL_ICONS: Record<NotificationChannel, LucideIcon> = {
  sms: MessageSquare,
  email: Mail,
  whatsapp: MessageCircle,
  browser: Bell,
};

export const CHANNEL_LABELS: Record<NotificationChannel, string> = {
  sms: "SMS",
  email: "Email",
  whatsapp: "WhatsApp",
  browser: "Browser",
};

export function NotificationItem({
  notification,
  onRead,
  onDelete,
  showChannel = true,
}: {
  notification: AppNotification;
  onRead?: (id: string) => void;
  onDelete?: (id: string) => void;
  showChannel?: boolean;
}) {
  const Icon = KIND_ICONS[notification.kind];
  const ChannelIcon = CHANNEL_ICONS[notification.channel];

  const body = (
    <div
      className={cn(
        "flex gap-3 rounded-xl p-3 transition-colors",
        notification.isRead ? "opacity-70" : "bg-accent/40",
      )}
    >
      <div
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg",
          KIND_TONES[notification.kind],
        )}
      >
        <Icon className="size-4" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium leading-snug">{notification.title}</p>
          {!notification.isRead && (
            <span
              className="mt-1.5 size-2 shrink-0 rounded-full bg-primary"
              aria-label="Unread"
            />
          )}
        </div>

        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
          {notification.body}
        </p>

        <div className="mt-1.5 flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {timeAgo(notification.createdAt)}
          </span>
          {showChannel && (
            <Badge
              variant="secondary"
              className="h-5 gap-1 px-1.5 text-[10px] font-normal"
            >
              <ChannelIcon className="size-2.5" />
              {CHANNEL_LABELS[notification.channel]}
            </Badge>
          )}
        </div>
      </div>

      {(onRead || onDelete) && (
        <div className="flex shrink-0 flex-col gap-1">
          {onRead && !notification.isRead && (
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={(e) => {
                e.preventDefault();
                onRead(notification.id);
              }}
              aria-label="Mark as read"
            >
              <Check className="size-3.5" />
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-destructive"
              onClick={(e) => {
                e.preventDefault();
                onDelete(notification.id);
              }}
              aria-label="Delete notification"
            >
              <Trash2 className="size-3.5" />
            </Button>
          )}
        </div>
      )}
    </div>
  );

  return notification.actionUrl ? (
    <Link href={notification.actionUrl} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}

/** The bell + dropdown in the header. */
export function NotificationCenter() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  const { data, isLoading, setData } = useAsync(
    () => (user ? getNotifications(user.id) : Promise.resolve([])),
    [user?.id],
  );

  const notifications = data ?? [];
  const unread = notifications.filter((n) => !n.isRead).length;

  async function onRead(id: string) {
    setData((current) =>
      (current ?? []).map((n) => (n.id === id ? { ...n, isRead: true } : n)),
    );
    await markNotificationRead(id);
  }

  async function onDelete(id: string) {
    setData((current) => (current ?? []).filter((n) => n.id !== id));
    await deleteNotification(id);
  }

  async function onMarkAll() {
    if (!user) return;

    setData((current) => (current ?? []).map((n) => ({ ...n, isRead: true })));
    const result = await markAllNotificationsRead(user.id);
    toast.success(`Marked ${result.count} notifications as read.`);
  }

  if (!user) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="relative rounded-xl"
            aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
          >
            <Bell className="size-5" />
            {unread > 0 && (
              <span className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground tabular-nums">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Button>
        }
      />

      <PopoverContent align="end" className="w-[22rem] p-0">
        <div className="flex items-center justify-between border-b p-3">
          <p className="font-semibold">Notifications</p>
          {unread > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onMarkAll}
              className="h-7 text-xs"
            >
              Mark all read
            </Button>
          )}
        </div>

        <ScrollArea className="max-h-96">
          <div className="p-2">
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }, (_, i) => (
                  <div key={i} className="flex gap-3 p-3">
                    <Skeleton className="size-9 shrink-0 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3.5 w-3/4" />
                      <Skeleton className="h-3 w-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <EmptyState
                icon={BellOff}
                title="You're all caught up"
                description="New booking updates will show up here."
                className="border-0 bg-transparent py-10"
              />
            ) : (
              <div className="space-y-1">
                {notifications.slice(0, 8).map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onRead={onRead}
                    onDelete={onDelete}
                    showChannel={false}
                  />
                ))}
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="border-t p-2">
          <Button
            render={<Link href="/patient/notifications" />}
            variant="ghost"
            className="w-full"
            onClick={() => setOpen(false)}
          >
            View all notifications
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
