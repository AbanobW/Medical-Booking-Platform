"use client";

import { useTranslations } from "next-intl";
import {
  Ban,
  CircleCheck,
  CircleSlash,
  CircleX,
  Hourglass,
  Microscope,
  PauseCircle,
  Radiation,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { useLabels } from "@/lib/i18n/use-labels";
import { cn } from "@/lib/utils";
import type {
  CampaignStatus,
  ProviderRole,
  ProviderStatus,
  Role,
  Suspension,
  UserStatus,
} from "@/lib/types";

/**
 * Status vocabulary for the admin console.
 *
 * Colour is never the only signal — every badge pairs a hue with an icon and a
 * word, so the states stay legible for colour-vision-deficient users. The word
 * itself comes from the message catalogue, so the vocabulary reads the same in
 * both languages.
 */

type Tone = "success" | "warning" | "destructive" | "muted" | "info";

const TONE_CLASS: Record<Tone, string> = {
  success: "bg-success/10 text-success",
  warning: "bg-warning/15 text-warning",
  destructive: "bg-destructive/10 text-destructive",
  muted: "bg-muted text-muted-foreground",
  info: "bg-info/10 text-info",
};

function ToneBadge({
  tone,
  icon: Icon,
  label,
  className,
}: {
  tone: Tone;
  icon: LucideIcon;
  label: string;
  className?: string;
}) {
  return (
    <Badge
      variant="secondary"
      className={cn("gap-1 border-0", TONE_CLASS[tone], className)}
    >
      <Icon aria-hidden />
      {label}
    </Badge>
  );
}

const USER_STATUS: Record<UserStatus, { tone: Tone; icon: LucideIcon }> = {
  active: { tone: "success", icon: CircleCheck },
  pending: { tone: "warning", icon: Hourglass },
  suspended: { tone: "destructive", icon: Ban },
};

export function UserStatusBadge({ status }: { status: UserStatus }) {
  const L = useLabels();
  const { tone, icon } = USER_STATUS[status];
  return <ToneBadge tone={tone} icon={icon} label={L.userStatus(status)} />;
}

const PROVIDER_STATUS: Record<ProviderStatus, { tone: Tone; icon: LucideIcon }> = {
  approved: { tone: "success", icon: CircleCheck },
  pending: { tone: "warning", icon: Hourglass },
  rejected: { tone: "muted", icon: CircleX },
  suspended: { tone: "destructive", icon: Ban },
};

export function ProviderStatusBadge({ status }: { status: ProviderStatus }) {
  const t = useTranslations("admin");
  const { tone, icon } = PROVIDER_STATUS[status];
  return (
    <ToneBadge tone={tone} icon={icon} label={t(`badges.providerStatus.${status}`)} />
  );
}

/**
 * A suspension is never just "suspended" (§13) — the form it takes decides what
 * happened to the patients who had already booked, so the badge says which.
 */
export function SuspensionBadge({ suspension }: { suspension: Suspension }) {
  const t = useTranslations("admin");

  return (
    <ToneBadge
      tone={suspension.type === "hard" ? "destructive" : "warning"}
      icon={suspension.type === "hard" ? Ban : PauseCircle}
      label={t(`badges.suspension.${suspension.type}`)}
    />
  );
}

/** The icon each provider type wears. The word comes from `useLabels()`. */
export const PROVIDER_TYPE_META: Record<ProviderRole, { icon: LucideIcon }> = {
  doctor: { icon: Stethoscope },
  lab: { icon: Microscope },
  radiology: { icon: Radiation },
};

export function ProviderTypeBadge({ type }: { type: ProviderRole }) {
  const L = useLabels();
  const { icon: Icon } = PROVIDER_TYPE_META[type];

  return (
    <Badge variant="outline" className="gap-1">
      <Icon aria-hidden />
      {L.providerType(type)}
    </Badge>
  );
}

export function RoleBadge({ role }: { role: Role }) {
  const L = useLabels();

  return (
    <Badge variant={role === "admin" ? "default" : "outline"} className="gap-1">
      {L.role(role)}
    </Badge>
  );
}

const CAMPAIGN_STATUS: Record<CampaignStatus, { tone: Tone; icon: LucideIcon }> = {
  active: { tone: "success", icon: CircleCheck },
  scheduled: { tone: "info", icon: Hourglass },
  ended: { tone: "muted", icon: CircleSlash },
};

export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  const t = useTranslations("admin");
  const { tone, icon } = CAMPAIGN_STATUS[status];
  return (
    <ToneBadge tone={tone} icon={icon} label={t(`badges.campaignStatus.${status}`)} />
  );
}

/** Coupons carry two independent signals: the switch, and the expiry date. */
export function CouponStateBadge({
  isActive,
  expiresAt,
  now,
}: {
  isActive: boolean;
  /** Null = never expires, so it can never be in the expired state. */
  expiresAt: string | null;
  now: string;
}) {
  const t = useTranslations("admin");

  if (expiresAt !== null && expiresAt < now) {
    return (
      <ToneBadge
        tone="muted"
        icon={CircleSlash}
        label={t("badges.couponState.expired")}
      />
    );
  }

  return isActive ? (
    <ToneBadge
      tone="success"
      icon={CircleCheck}
      label={t("badges.couponState.active")}
    />
  ) : (
    <ToneBadge tone="warning" icon={Ban} label={t("badges.couponState.paused")} />
  );
}

/** Renders `appliesTo` — an empty array means "every service type". */
export function AppliesToBadges({ appliesTo }: { appliesTo: ProviderRole[] }) {
  const t = useTranslations("admin");

  if (appliesTo.length === 0) {
    return <Badge variant="secondary">{t("badges.allServices")}</Badge>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {appliesTo.map((type) => (
        <ProviderTypeBadge key={type} type={type} />
      ))}
    </div>
  );
}
