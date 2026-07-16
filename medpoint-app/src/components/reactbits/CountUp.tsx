"use client";

/*
 * Vendored from React Bits (reactbits.dev) via the shadcn registry.
 *
 * Two deliberate edits to what the registry ships:
 *  - `motion/react` -> `framer-motion`. They are the same library (motion v12
 *    is framer-motion v12 renamed); the project already depends on
 *    framer-motion, and installing both would ship the animation engine twice.
 *  - `"use client"`, since these use hooks / WebGL and this app renders the
 *    marketing page on the server.
 */

import { useInView, useMotionValue, useSpring } from "framer-motion";
import { useCallback, useEffect, useRef } from 'react';

interface CountUpProps {
  to: number;
  from?: number;
  direction?: 'up' | 'down';
  delay?: number;
  duration?: number;
  className?: string;
  startWhen?: boolean;
  separator?: string;
  onStart?: () => void;
  onEnd?: () => void;
}

/** Hoisted to module scope so the spring's `restDelta` can use it. */
const getDecimalPlaces = (num: number): number => {
  const str = num.toString();
  if (str.includes('.')) {
    const decimals = str.split('.')[1];
    if (parseInt(decimals) !== 0) {
      return decimals.length;
    }
  }
  return 0;
};

export default function CountUp({
  to,
  from = 0,
  direction = 'up',
  delay = 0,
  duration = 2,
  className = '',
  startWhen = true,
  separator = '',
  onStart,
  onEnd
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(direction === 'down' ? to : from);

  const stiffness = 100 * (1 / duration);

  /*
   * Fourth edit to the vendored component: the damping.
   *
   * Upstream uses `20 + 40 / duration`, which is heavily *overdamped* at every
   * duration — at duration 0.9 that is a damping of 64 against a critical value
   * of 2*sqrt(111) ≈ 21, i.e. 3x over. An overdamped spring has no overshoot but
   * approaches its target by slow exponential decay, so "12,400" sits visibly
   * ticking through 12,377 … 12,396 for several seconds and reads as though the
   * page is still loading.
   *
   * Critical damping (ζ = 1) is the fastest approach that still cannot overshoot
   * — which is what a counter wants: it must never tick *past* the real figure
   * and come back.
   */
  const damping = 2 * Math.sqrt(stiffness);

  /*
   * `restDelta` is the third edit to the vendored component.
   *
   * A spring approaches its target asymptotically, and framer-motion's default
   * rest threshold is 0.01 — an *absolute* value. That is sensible for an opacity
   * of 0..1 and useless for a counter running to 12,400: the spring has to close
   * to within a hundredth of a unit before it is allowed to rest, so the last
   * digits visibly crawl for seconds after the number is, to the eye, done.
   *
   * Scaling the threshold to the magnitude being counted (and the precision being
   * displayed) lets it rest as soon as it is within half a displayed unit — i.e.
   * as soon as no further change could be rendered anyway.
   */
  const restDelta = Math.max(
    Math.abs(to - from) / 10_000,
    0.5 / Math.pow(10, getDecimalPlaces(to)),
  );

  const springValue = useSpring(motionValue, {
    damping,
    stiffness,
    restDelta,
  });

  const isInView = useInView(ref, { once: true, margin: '0px' });

  const maxDecimals = Math.max(getDecimalPlaces(from), getDecimalPlaces(to));

  const formatValue = useCallback(
    (latest: number) => {
      const hasDecimals = maxDecimals > 0;

      const options: Intl.NumberFormatOptions = {
        useGrouping: !!separator,
        minimumFractionDigits: hasDecimals ? maxDecimals : 0,
        maximumFractionDigits: hasDecimals ? maxDecimals : 0
      };

      const formattedNumber = Intl.NumberFormat('en-US', options).format(latest);

      return separator ? formattedNumber.replace(/,/g, separator) : formattedNumber;
    },
    [maxDecimals, separator]
  );

  useEffect(() => {
    if (ref.current) {
      ref.current.textContent = formatValue(direction === 'down' ? to : from);
    }
  }, [from, to, direction, formatValue]);

  useEffect(() => {
    if (isInView && startWhen) {
      if (typeof onStart === 'function') {
        onStart();
      }

      const timeoutId = setTimeout(() => {
        motionValue.set(direction === 'down' ? from : to);
      }, delay * 1000);

      const durationTimeoutId = setTimeout(
        () => {
          if (typeof onEnd === 'function') {
            onEnd();
          }
        },
        delay * 1000 + duration * 1000
      );

      return () => {
        clearTimeout(timeoutId);
        clearTimeout(durationTimeoutId);
      };
    }
  }, [isInView, startWhen, motionValue, direction, from, to, delay, onStart, onEnd, duration]);

  useEffect(() => {
    const unsubscribe = springValue.on('change', (latest: number) => {
      if (ref.current) {
        ref.current.textContent = formatValue(latest);
      }
    });

    return () => unsubscribe();
  }, [springValue, formatValue]);

  return <span className={className} ref={ref} />;
}
