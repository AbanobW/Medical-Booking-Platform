"use client";

import { useState } from "react";
import { toast } from "sonner";

import {
  CHANNEL_ICONS,
  CHANNEL_LABELS,
} from "@/components/shared/notification-center";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { NotificationChannel, NotificationPreferences } from "@/lib/types";

const CHANNELS: NotificationChannel[] = ["sms", "email", "whatsapp", "browser"];

const DESCRIPTIONS: Record<NotificationChannel, string> = {
  sms: "Appointment reminders sent as a text message.",
  email: "Booking confirmations, receipts and offers.",
  whatsapp: "Reminders and updates on WhatsApp.",
  browser: "Live alerts while you're using Vesita.",
};

const DEFAULTS: NotificationPreferences = {
  sms: true,
  email: true,
  whatsapp: false,
  browser: true,
};

/**
 * There is no preferences endpoint yet, so this is component state — the toast
 * stands in for the save round-trip.
 */
export function NotificationPreferencesCard() {
  const [preferences, setPreferences] =
    useState<NotificationPreferences>(DEFAULTS);

  function onToggle(channel: NotificationChannel, enabled: boolean) {
    setPreferences((current) => ({ ...current, [channel]: enabled }));
    toast.success(
      `${CHANNEL_LABELS[channel]} notifications ${enabled ? "enabled" : "disabled"}.`,
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification preferences</CardTitle>
        <CardDescription>
          Choose how you&apos;d like to hear about your appointments.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-1">
        {CHANNELS.map((channel) => {
          const Icon = CHANNEL_ICONS[channel];
          const id = `pref-${channel}`;

          return (
            <div
              key={channel}
              className="flex items-center gap-3 rounded-xl p-3 transition-colors hover:bg-muted/50"
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-4" />
              </div>

              <div className="min-w-0 flex-1">
                <Label htmlFor={id} className="cursor-pointer">
                  {CHANNEL_LABELS[channel]}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {DESCRIPTIONS[channel]}
                </p>
              </div>

              <Switch
                id={id}
                checked={preferences[channel]}
                onCheckedChange={(checked: boolean) => onToggle(channel, checked)}
              />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
