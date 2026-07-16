# MedPoint — Medical Booking Platform (Egypt)

A production-quality **frontend** for a Vezeeta-style healthcare marketplace: search
and book **doctors**, **medical labs**, and **radiology centers** across 10 Egyptian
governorates.

There is **no backend**. Every API is mocked behind a promise-based service layer
with realistic latency, so the UI exercises real loading, error, and empty states —
and swapping in a live API later means changing `src/lib/api/*` and nothing else.

---

## Quick start

```bash
npm install
npm run dev      # http://localhost:3000
```

### Sign in

The login screen has **one-click demo login for all five roles** — no password needed.

| Role | Lands on | Sees |
|---|---|---|
| Patient | `/patient` | bookings, favorites, reviews, notifications |
| Doctor | `/provider` | schedule, consultation types, bookings, revenue |
| Lab | `/provider` | tests, packages, branches, bookings |
| Radiology | `/provider` | scans, packages, branches, bookings |
| Admin | `/admin` | users, providers, coupons, cashback, commission, analytics |

Any seeded email works with any password. The OTP code is always `123456`.

---

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind v4 · shadcn/ui (**Base UI**) ·
Framer Motion · React Hook Form + Zod · TanStack Table · Recharts · lucide-react ·
next-themes (dark/light).

---

## Architecture

```
src/
  app/
    (marketing)/        home, search, doctor/lab/radiology profiles
    (auth)/             login, register, OTP verification
    booking/[slug]/     5-step booking wizard
    patient/            patient dashboard
    provider/           doctor + lab + radiology dashboard (one shell, three shapes)
    admin/              admin dashboard
    api/avatar|cover/   deterministic SVG image generators
  components/
    ui/                 shadcn primitives + AppSelect & RHF form wrappers
    shared/             ProviderCard, SearchBar, FilterSidebar, CalendarPicker,
                        DataTable, charts, RatingCard, ReviewCard, states, motion…
    layout/             SiteHeader, SiteFooter, DashboardShell, ThemeToggle
    providers/          theme + auth context
  lib/
    types.ts            the whole domain model — one contract for everything
    data/               Egypt reference data + deterministic seed generator
    api/                the mock backend (providers, bookings, engagement,
                        stats, admin, provider-admin, auth)
  hooks/                useAsync, useMutation, useDebounced
```

### The mock backend

`src/lib/data/seed.ts` generates the entire dataset from a **fixed seed** with a
deterministic PRNG, so the server and client always produce byte-identical data
(React hydration stays clean). It anchors to a fixed `TODAY` for the same reason —
use `TODAY` from `@/lib/data/seed`, never `new Date()`, for "now".

| | count |
|---|---|
| Doctors | 56 (across 24 specialties) |
| Labs | 22 (with tests, packages, branches) |
| Radiology centers | 22 (with scans, packages, branches) |
| Patients | 60 |
| Bookings | 620 (past + upcoming, all four statuses) |
| Reviews | 212 (only on completed bookings) |
| Coupons / cashback campaigns | 8 / 4 |

Everything is cross-referenced: reviews belong to real completed bookings, bookings
point at real services on real providers, and provider ratings reconcile with their
reviews. `scripts/check-seed.ts` asserts that integrity:

```bash
npx tsx scripts/check-seed.ts
```

Mutations (bookings, reviews, favorites, admin edits) persist to `localStorage`.
Clear it to reset, or call `resetDatabase()` from `@/lib/api/client`.

### Images

Provider photos and cover banners are **generated SVG** served from `/api/avatar`
and `/api/cover`, seeded by provider id. No remote CDN, no broken images offline,
no `next.config` remote patterns.

---

## Design system

Teal `#00A6A6` primary, slate `#0F172A` secondary, green `#22C55E` accent, on
`#F8FAFC`. Soft shadows, rounded cards, full dark mode.

The **chart palette is CVD-validated**. The categorical ramp is a fixed order
(teal → blue → green → amber → violet — blue sits between teal and green because
adjacent teal/green fails tritan separation), with separately-chosen dark-mode
steps rather than an automatic flip of the light ones. Don't reorder or extend it.
Charts always carry a legend plus direct labels, and never use a dual axis.

---

## Notes & limitations

- The dashboard role guard is **client-side only** — it exists so the mock flows
  behave correctly, not as real authorization. A real app must enforce this on the server.
- Authentication is mocked: no passwords are checked, no tokens are issued.
- The map is a styled placeholder with real pin geometry and working Google Maps
  deep links; wiring the real embed means swapping one `<div>` for an `<iframe>`.
- This is a demo, not a real medical service.
