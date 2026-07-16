"use client";

/*
 * Vendored from React Bits (reactbits.dev) via the shadcn registry.
 * `"use client"` added — it tracks the pointer to move the spotlight.
 */

import React, { useRef, useState } from 'react';

import { cn } from '@/lib/utils';

interface Position {
  x: number;
  y: number;
}

interface SpotlightCardProps extends React.PropsWithChildren {
  className?: string;
  spotlightColor?: `rgba(${number}, ${number}, ${number}, ${number})`;
}

const SpotlightCard: React.FC<SpotlightCardProps> = ({
  children,
  className = '',
  spotlightColor = 'rgba(255, 255, 255, 0.25)'
}) => {
  const divRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState<boolean>(false);
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState<number>(0);

  const handleMouseMove: React.MouseEventHandler<HTMLDivElement> = e => {
    if (!divRef.current || isFocused) return;

    const rect = divRef.current.getBoundingClientRect();
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleFocus = () => {
    setIsFocused(true);
    setOpacity(0.6);
  };

  const handleBlur = () => {
    setIsFocused(false);
    setOpacity(0);
  };

  const handleMouseEnter = () => {
    setOpacity(0.6);
  };

  const handleMouseLeave = () => {
    setOpacity(0);
  };

  return (
    <div
      ref={divRef}
      onMouseMove={handleMouseMove}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      /*
       * Edit to the vendored component: `cn` instead of a template string.
       *
       * Upstream hardcodes `border-neutral-800 bg-neutral-900` — a dark-only card
       * — and concatenates `className` onto it. Tailwind classes do not cascade by
       * source order, so an override passed in by the caller would not reliably
       * win, and the card rendered black in this app's light theme. `cn` runs
       * tailwind-merge, so the caller's colours actually replace the defaults.
       */
      className={cn(
        "relative overflow-hidden rounded-3xl border border-neutral-800 bg-neutral-900 p-8",
        className,
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 ease-in-out"
        style={{
          opacity,
          background: `radial-gradient(circle at ${position.x}px ${position.y}px, ${spotlightColor}, transparent 80%)`
        }}
      />
      {children}
    </div>
  );
};

export default SpotlightCard;
