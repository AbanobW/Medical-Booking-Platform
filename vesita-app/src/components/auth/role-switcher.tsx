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

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS, type Role } from "@/lib/types";
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
 * One-click demo sign-in for every role.
 *
 * The dataset is seeded, so each button drops you into a dashboard with real
 * bookings, reviews and revenue behind it — no empty states to explain away.
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
    <div
      className={cn(
        "rounded-2xl border border-primary/20 bg-primary/5 p-4 shadow-soft",
        className,
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">Explore as…</p>
        <Badge variant="secondary" className="text-[0.7rem]">
          Demo
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
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
              className="h-10 justify-start gap-2 rounded-xl bg-background px-3"
            >
              <Icon
                className={cn("size-4 text-primary", isPending && "animate-pulse")}
              />
              <span className="truncate text-xs font-medium sm:text-sm">
                {ROLE_LABELS[role]}
              </span>
            </Button>
          );
        })}
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Signs you straight in with a seeded account for that role.
      </p>
    </div>
  );
}
