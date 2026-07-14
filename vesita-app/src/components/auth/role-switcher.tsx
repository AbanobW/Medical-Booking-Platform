"use client";

import {
  FlaskConical,
  Scan,
  ShieldCheck,
  Stethoscope,
  User as UserIcon,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useLabels } from "@/lib/i18n/use-labels";
import { type Role } from "@/lib/types";
import { cn } from "@/lib/utils";

const ROLE_ICONS: Record<Role, LucideIcon> = {
  patient: UserIcon,
  doctor: Stethoscope,
  lab: FlaskConical,
  radiology: Scan,
  admin: ShieldCheck,
};

const ROLES: Role[] = ["patient", "doctor", "lab", "radiology", "admin"];

/**
 * One-click demo sign-in for every role. The dataset is seeded, so each chip
 * drops you into a dashboard with real bookings and revenue behind it.
 *
 * Renders bare — a row of chips, with no panel of its own. It used to carry a
 * titled, bordered card with its own badge and footnote, which put the *demo*
 * shortcut visually above the sign-in form it is meant to sit behind. The login
 * page now owns that framing and tucks this inside a disclosure.
 */
export function RoleSwitcher({
  onSelect,
  disabled,
  className,
}: {
  onSelect: (role: Role) => Promise<void> | void;
  disabled?: boolean;
  className?: string;
}) {
  const L = useLabels();
  const [pending, setPending] = useState<Role | null>(null);

  async function handle(role: Role) {
    setPending(role);
    try {
      await onSelect(role);
    } finally {
      setPending(null);
    }
  }

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {ROLES.map((role) => {
        const Icon = ROLE_ICONS[role];
        const isPending = pending === role;

        return (
          <Button
            key={role}
            type="button"
            variant="outline"
            onClick={() => void handle(role)}
            disabled={disabled || pending !== null}
            className="h-9 gap-1.5 rounded-full px-3"
          >
            <Icon
              className={cn("size-3.5 text-primary", isPending && "animate-pulse")}
            />
            <span className="text-xs font-medium">{L.role(role)}</span>
          </Button>
        );
      })}
    </div>
  );
}
