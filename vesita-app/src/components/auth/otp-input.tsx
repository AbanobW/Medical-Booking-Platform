"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

const LENGTH = 6;

/**
 * Six single-digit boxes behaving like one field: typing auto-advances,
 * backspace walks back, and pasting a whole code fills every box at once.
 */
export function OtpInput({
  value,
  onChange,
  onComplete,
  disabled,
  hasError,
  className,
}: {
  /** The code so far — 0 to 6 digits. */
  value: string;
  onChange: (next: string) => void;
  onComplete?: (code: string) => void;
  disabled?: boolean;
  hasError?: boolean;
  className?: string;
}) {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputs.current[0]?.focus();
  }, []);

  const digits = Array.from({ length: LENGTH }, (_, i) => value[i] ?? "");

  function focusAt(index: number) {
    const next = inputs.current[Math.min(Math.max(index, 0), LENGTH - 1)];
    next?.focus();
    next?.select();
  }

  function commit(next: string) {
    onChange(next);
    if (next.length === LENGTH) onComplete?.(next);
  }

  function handleChange(index: number, raw: string) {
    const typed = raw.replace(/\D/g, "");
    if (!typed) return;

    // Typing into a box replaces it; a multi-character value (autofill, some
    // mobile keyboards) spills forward into the boxes that follow.
    const chars = value.padEnd(LENGTH, " ").split("");
    typed.split("").forEach((char, offset) => {
      if (index + offset < LENGTH) chars[index + offset] = char;
    });

    const next = chars.join("").replace(/\s+$/, "").slice(0, LENGTH);
    commit(next);
    focusAt(index + typed.length);
  }

  function handleKeyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace") {
      event.preventDefault();

      if (digits[index]) {
        const chars = value.split("");
        chars[index] = "";
        onChange(chars.join("").replace(/\s+$/, ""));
        return;
      }

      const chars = value.split("");
      chars[index - 1] = "";
      onChange(chars.join("").slice(0, Math.max(index - 1, 0)));
      focusAt(index - 1);
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusAt(index - 1);
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      focusAt(index + 1);
    }
  }

  function handlePaste(event: React.ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    const pasted = event.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, LENGTH);
    if (!pasted) return;

    commit(pasted);
    focusAt(pasted.length);
  }

  return (
    <div
      className={cn("flex justify-between gap-2 sm:gap-3", className)}
      role="group"
      aria-label="Verification code"
    >
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            inputs.current[index] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          maxLength={LENGTH}
          value={digit.trim()}
          disabled={disabled}
          aria-label={`Digit ${index + 1}`}
          aria-invalid={hasError || undefined}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          className={cn(
            "h-14 w-full rounded-xl border bg-background text-center text-xl font-semibold tabular-nums transition-all outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 sm:h-16 sm:text-2xl",
            hasError
              ? "border-destructive ring-3 ring-destructive/20"
              : digit.trim()
                ? "border-primary"
                : "border-input",
          )}
        />
      ))}
    </div>
  );
}
