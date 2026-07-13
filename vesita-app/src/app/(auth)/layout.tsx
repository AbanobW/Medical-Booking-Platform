import Link from "next/link";
import { CalendarCheck, ShieldCheck, Wallet } from "lucide-react";

import { Logo } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";

const HIGHLIGHTS = [
  {
    icon: CalendarCheck,
    title: "Instant confirmation",
    body: "Pick a slot and it's yours — no phone calls, no waiting for a callback.",
  },
  {
    icon: Wallet,
    title: "Transparent pricing",
    body: "See the consultation fee, test price or scan cost before you book.",
  },
  {
    icon: ShieldCheck,
    title: "Verified providers",
    body: "Every doctor, lab and radiology center is licence-checked before listing.",
  },
];

/** Split layout for auth screens: the form on the left, the pitch on the right. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col px-6 py-8 sm:px-10">
        <div className="flex items-center justify-between">
          <Link href="/">
            <Logo />
          </Link>
          <ThemeToggle />
        </div>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-md">{children}</div>
        </div>
      </div>

      {/* Decorative panel — hidden on mobile, where it would only add scroll. */}
      <div className="relative hidden overflow-hidden bg-brand-gradient lg:block">
        <div className="absolute inset-0 bg-grid-pattern opacity-20" aria-hidden />

        <div className="relative flex h-full flex-col justify-center px-14 text-white">
          <h2 className="max-w-md text-4xl font-bold leading-tight">
            Healthcare in Egypt, booked in under a minute.
          </h2>
          <p className="mt-4 max-w-md text-lg text-white/80">
            Compare 100+ verified doctors, labs and radiology centers across 10
            governorates — then book the slot that actually fits your day.
          </p>

          <ul className="mt-12 space-y-6">
            {HIGHLIGHTS.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
                  <Icon className="size-5" />
                </span>
                <div>
                  <p className="font-semibold">{title}</p>
                  <p className="mt-0.5 max-w-sm text-sm text-white/75">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
