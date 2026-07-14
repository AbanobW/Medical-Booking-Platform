"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { CHANNEL_ICONS } from "@/components/shared/notification-center";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SITE } from "@/lib/site";
import type { NotificationChannel, NotificationPreferences } from "@/lib/types";

const CHANNELS: NotificationChannel[] = ["sms", "email", "whatsapp", "browser"];

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
  const t = useTranslations("patient");

  const [preferences, setPreferences] =
    useState<NotificationPreferences>(DEFAULTS);

  function onToggle(channel: NotificationChannel, enabled: boolean) {
    setPreferences((current) => ({ ...current, [channel]: enabled }));

    const name = t(`notifications.channel.${channel}`);
    toast.success(
      enabled
        ? t("notifications.preferences.enabled", { channel: name })
        : t("notifications.preferences.disabled", { channel: name }),
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("notifications.preferences.title")}</CardTitle>
        <CardDescription>
          {t("notifications.preferences.description")}
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
                  {t(`notifications.channel.${channel}`)}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t(`notifications.preferences.${channel}`, {
                    site: SITE.name,
                  })}
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
