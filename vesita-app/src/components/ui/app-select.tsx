"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface AppSelectProps {
  value: string | null;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  /** Rendered as the first item and maps to `""`, e.g. "All governorates". */
  emptyOption?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  "aria-label"?: string;
}

/**
 * A single-prop wrapper around Base UI's compound Select.
 *
 * Base UI's `onValueChange` passes `(value, eventDetails)` and permits `null`,
 * which is easy to get wrong at every call site. This normalizes it to a plain
 * `(value: string) => void` and drives the options from an array — so the rest
 * of the app never touches the primitive directly.
 */
export function AppSelect({
  value,
  onValueChange,
  options,
  placeholder = "Select…",
  emptyOption,
  disabled,
  className,
  id,
  "aria-label": ariaLabel,
}: AppSelectProps) {
  const ALL = "__all__";

  // Base UI treats `null` as "no selection"; we model that as the empty string.
  const selected = value === "" || value == null ? (emptyOption ? ALL : null) : value;

  const items = [
    ...(emptyOption ? [{ value: ALL, label: emptyOption }] : []),
    ...options,
  ];

  return (
    <Select
      value={selected}
      onValueChange={(next: string | null) => {
        onValueChange(next === ALL || next == null ? "" : next);
      }}
      disabled={disabled}
      items={items}
    >
      <SelectTrigger
        id={id}
        aria-label={ariaLabel}
        className={cn("h-11 w-full rounded-xl", className)}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {items.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            disabled={"disabled" in option ? option.disabled : undefined}
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
