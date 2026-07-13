import { cn } from "@/lib/utils";
import { SITE } from "@/lib/site";

/** The Vesita wordmark: a blue cross-in-pulse glyph plus the name. */
export function Logo({
  className,
  showText = true,
}: {
  className?: string;
  showText?: boolean;
}) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <span className="flex size-9 items-center justify-center rounded-xl bg-brand-gradient shadow-glow">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="size-5 text-white"
          aria-hidden
        >
          <path
            d="M3 12h3.5l2-5 3 10 2.5-7 1.5 2H21"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>

      {showText && (
        <span className="text-xl font-bold tracking-tight">
          {SITE.name}
        </span>
      )}
      <span className="sr-only">{SITE.name} home</span>
    </span>
  );
}
