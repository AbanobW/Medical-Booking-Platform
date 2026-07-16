"use client";

import { DirectionProvider as BaseDirectionProvider } from "@base-ui/react/direction-provider";

import { useIsRtl } from "@/lib/i18n/use-format";

/**
 * Tells Base UI which way the page reads.
 *
 * `dir="rtl"` on `<html>` is enough for CSS, but not for Base UI: its components
 * read the direction from a React context, and `useDirection()` falls back to
 * `'ltr'` when no provider is mounted. Nothing warns about this — the components
 * simply keep doing left-to-right maths under a right-to-left layout.
 *
 * The Slider was the visible casualty. Its control resolves a pointer position with
 *
 *     direction === 'rtl' ? right - fingerX : fingerX - left
 *
 * so in Arabic the track painted mirrored while the drag was still measured from
 * the left edge — dragging the thumb moved the value the wrong way. The same
 * context also drives menu/popover alignment and the arrow-key direction on every
 * Base UI control, so this is a fix for all of them, not just the one slider.
 *
 * Mounted once, in `AppProviders`, from the same locale the `<html dir>` uses.
 */
export function DirectionProvider({ children }: { children: React.ReactNode }) {
  const isRtl = useIsRtl();

  return (
    <BaseDirectionProvider direction={isRtl ? "rtl" : "ltr"}>
      {children}
    </BaseDirectionProvider>
  );
}
