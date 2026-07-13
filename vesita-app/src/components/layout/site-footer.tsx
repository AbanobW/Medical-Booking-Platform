import Link from "next/link";
import { Mail, Phone } from "lucide-react";

import { Logo } from "@/components/layout/logo";
import { GOVERNORATES, SPECIALTIES } from "@/lib/data/egypt";
import { SITE } from "@/lib/site";

/**
 * Brand marks as inline SVG — lucide-react v1 dropped its brand icon set, and
 * these are the only four we need.
 */
const SOCIAL_PATHS: Record<string, string> = {
  Facebook:
    "M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z",
  X: "M4 4l16 16M20 4L4 20",
  Instagram:
    "M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM16.5 7.5h.01M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4z",
  LinkedIn:
    "M4.5 9.5v10M4.5 5.5v.01M10 19.5v-6a3 3 0 0 1 6 0v6M10 9.5v10",
};

function SocialIcon({ name }: { name: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
      aria-hidden
    >
      <path d={SOCIAL_PATHS[name]} />
    </svg>
  );
}

const COLUMNS = [
  {
    title: "Top Specialties",
    links: SPECIALTIES.slice(0, 6).map((s) => ({
      label: s.name,
      href: `/search?type=doctor&specialtyId=${s.id}`,
    })),
  },
  {
    title: "Top Cities",
    links: GOVERNORATES.slice(0, 6).map((g) => ({
      label: g.name,
      href: `/search?type=doctor&governorateId=${g.id}`,
    })),
  },
  {
    title: "Services",
    links: [
      { label: "Book a Doctor", href: "/search?type=doctor" },
      { label: "Medical Labs", href: "/search?type=lab" },
      { label: "Radiology Centers", href: "/search?type=radiology" },
      { label: "How It Works", href: "/#how-it-works" },
      { label: "FAQ", href: "/#faq" },
      { label: "For Providers", href: "/register?role=doctor" },
    ],
  },
];

const SOCIALS = ["Facebook", "X", "Instagram", "LinkedIn"];

export function SiteFooter() {
  return (
    <footer className="border-t bg-card">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.5fr_repeat(3,1fr)]">
          <div className="space-y-4">
            <Logo />
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
              {SITE.description}
            </p>

            <div className="space-y-2 pt-2">
              <a
                href={`tel:${SITE.supportPhone}`}
                className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary"
              >
                <Phone className="size-4" />
                {SITE.supportPhone}
              </a>
              <a
                href={`mailto:${SITE.supportEmail}`}
                className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary"
              >
                <Mail className="size-4" />
                {SITE.supportEmail}
              </a>
            </div>

            <div className="flex gap-2 pt-2">
              {SOCIALS.map((label) => (
                <a
                  key={label}
                  href="#"
                  aria-label={label}
                  className="flex size-9 items-center justify-center rounded-xl border text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                >
                  <SocialIcon name={label} />
                </a>
              ))}
            </div>
          </div>

          {COLUMNS.map((column) => (
            <div key={column.title}>
              <h3 className="mb-4 text-sm font-semibold">{column.title}</h3>
              <ul className="space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.href + link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-primary"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t pt-6 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} {SITE.name}. A demo healthcare booking
            platform — not a real medical service.
          </p>
          <div className="flex gap-5">
            {["Privacy Policy", "Terms of Service", "Cookie Policy"].map((label) => (
              <Link
                key={label}
                href="#"
                className="text-xs text-muted-foreground transition-colors hover:text-primary"
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
