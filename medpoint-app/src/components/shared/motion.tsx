"use client";

import { motion, type Variants } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Shared Framer Motion primitives.
 *
 * One easing curve and one duration scale across the whole app, so animation
 * reads as a system rather than per-component improvisation. Everything here
 * honours `prefers-reduced-motion` via the global CSS override.
 */

export const EASE = [0.22, 1, 0.36, 1] as const;

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.35, ease: EASE } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.35, ease: EASE } },
};

/** Parent variant that cascades its children in. */
export const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
};

/** Wraps a route's content in a subtle enter transition. */
export function PageTransition({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * Reveals its children as they scroll into view, staggered.
 * Use for marketing sections; `once` keeps it from re-firing on scroll-back.
 */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-80px" }}
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: 0.07, delayChildren: delay } },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** A single item inside a <Reveal> or a `stagger` parent. */
export function RevealItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div variants={fadeUp} className={className}>
      {children}
    </motion.div>
  );
}

/** Lifts a card on hover — the standard interaction for clickable cards. */
export function HoverLift({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.995 }}
      transition={{ duration: 0.2, ease: EASE }}
      className={cn("h-full", className)}
    >
      {children}
    </motion.div>
  );
}

export { motion };
