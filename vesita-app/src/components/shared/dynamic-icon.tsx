"use client";

import * as Lucide from "lucide-react";
import { Stethoscope, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Renders a Lucide icon looked up by name at runtime.
 *
 * The specialty taxonomy stores icons as strings (as a backend would), so the
 * name can't be checked at compile time. Anything missing from the installed
 * Lucide version falls back to a stethoscope rather than crashing the page.
 */
export function DynamicIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const registry = Lucide as unknown as Record<string, LucideIcon | undefined>;
  const Icon = registry[name] ?? Stethoscope;

  return <Icon className={cn("size-5", className)} aria-hidden />;
}
