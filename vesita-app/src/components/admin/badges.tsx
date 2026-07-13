"use client";

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
import { cn } from "@/lib/utils";
import {
  ROLE_LABELS,
  type CampaignStatus,
  type ProviderRole,
  type ProviderStatus,
  type Role,
  type Suspension,
  type UserStatus,
} from "@/lib/types";

/**
 * Status vocabulary for the admin console.
 *
 * Colour is never the only signal — every badge pairs a hue with an icon and a
 * word, so the states stay legible for colour-vision-deficient users.
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

const USER_STATUS: Record<UserStatus, { tone: Tone; icon: LucideIcon; label: string }> = {
  active: { tone: "success", icon: CircleCheck, label: "Active" },
  pending: { tone: "warning", icon: Hourglass, label: "Pending" },
  suspended: { tone: "destructive", icon: Ban, label: "Suspended" },
};

export function UserStatusBadge({ status }: { status: UserStatus }) {
  const { tone, icon, label } = USER_STATUS[status];
  return <ToneBadge tone={tone} icon={icon} label={label} />;
}

const PROVIDER_STATUS: Record<
  ProviderStatus,
  { tone: Tone; icon: LucideIcon; label: string }
> = {
  approved: { tone: "success", icon: CircleCheck, label: "Approved" },
  pending: { tone: "warning", icon: Hourglass, label: "Pending" },
  rejected: { tone: "muted", icon: CircleX, label: "Rejected" },
  suspended: { tone: "destructive", icon: Ban, label: "Suspended" },
};

export function ProviderStatusBadge({ status }: { status: ProviderStatus }) {
  const { tone, icon, label } = PROVIDER_STATUS[status];
  return <ToneBadge tone={tone} icon={icon} label={label} />;
}

/**
 * A suspension is never just "suspended" (§13) — the form it takes decides what
 * happened to the patients who had already booked, so the badge says which.
 */
export function SuspensionBadge({ suspension }: { suspension: Suspension }) {
  return (
    <ToneBadge
      tone={suspension.type === "hard" ? "destructive" : "warning"}
      icon={suspension.type === "hard" ? Ban : PauseCircle}
      label={suspension.type === "hard" ? "Hard" : "Soft"}
    />
  );
}

export const PROVIDER_TYPE_META: Record<
  ProviderRole,
  { icon: LucideIcon; label: string }
> = {
  doctor: { icon: Stethoscope, label: "Doctor" },
  lab: { icon: Microscope, label: "Lab" },
  radiology: { icon: Radiation, label: "Radiology" },
};

export function ProviderTypeBadge({ type }: { type: ProviderRole }) {
  const { icon: Icon, label } = PROVIDER_TYPE_META[type];
  return (
    <Badge variant="outline" className="gap-1">
      <Icon aria-hidden />
      {label}
    </Badge>
  );
}

export function RoleBadge({ role }: { role: Role }) {
  return (
    <Badge variant={role === "admin" ? "default" : "outline"} className="gap-1">
      {ROLE_LABELS[role]}
    </Badge>
  );
}

const CAMPAIGN_STATUS: Record<
  CampaignStatus,
  { tone: Tone; icon: LucideIcon; label: string }
> = {
  active: { tone: "success", icon: CircleCheck, label: "Active" },
  scheduled: { tone: "info", icon: Hourglass, label: "Scheduled" },
  ended: { tone: "muted", icon: CircleSlash, label: "Ended" },
};

export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  const { tone, icon, label } = CAMPAIGN_STATUS[status];
  return <ToneBadge tone={tone} icon={icon} label={label} />;
}

/** Coupons carry two independent signals: the switch, and the expiry date. */
export function CouponStateBadge({
  isActive,
  expiresAt,
  now,
}: {
  isActive: boolean;
  expiresAt: string;
  now: string;
}) {
  if (expiresAt < now) {
    return <ToneBadge tone="muted" icon={CircleSlash} label="Expired" />;
  }
  return isActive ? (
    <ToneBadge tone="success" icon={CircleCheck} label="Active" />
  ) : (
    <ToneBadge tone="warning" icon={Ban} label="Paused" />
  );
}

/** Renders `appliesTo` — an empty array means "every service type". */
export function AppliesToBadges({ appliesTo }: { appliesTo: ProviderRole[] }) {
  if (appliesTo.length === 0) {
    return <Badge variant="secondary">All services</Badge>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {appliesTo.map((type) => (
        <ProviderTypeBadge key={type} type={type} />
      ))}
    </div>
  );
}
