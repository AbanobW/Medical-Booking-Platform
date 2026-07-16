# Vesita — build contract

Medical booking platform for Egypt (Vezeeta-like). **Live API only — there is no mock.**
Every value on screen came from MedPoint or is absent; an absent value renders as an
em dash (`DASH` / `orDash` in `@/lib/i18n/format`). Never invent a default to fill a
gap — no `?? 0`, no placeholder rating, no plausible opening hours. See `.claude/BACKEND-GAPS.md`.
Next.js 15 App Router · TypeScript · Tailwind v4 · shadcn (Base UI) · Framer Motion ·
React Hook Form + Zod · TanStack Table · Recharts · lucide-react.

The foundation below is **built, typechecked, and must not be rewritten**. Build on it.

---

## ⚠️ shadcn here is Base UI, NOT Radix. Read this or your code won't compile.

| Radix habit | What to do here |
|---|---|
| `<Button asChild><Link/></Button>` | **`<Button render={<Link href="…" />}>Label</Button>`** — `asChild` does not exist |
| `<DialogTrigger asChild>` | **`<DialogTrigger render={<Button …/>} />`** (self-closing; children go in the rendered element) |
| Same for `SheetTrigger`, `PopoverTrigger`, `DropdownMenuTrigger`, `SidebarMenuButton`, `DropdownMenuItem` | all use `render={…}` |
| `<TooltipProvider delayDuration>` | **`delay`** |
| `onValueChange={(v: string) => …}` | Base UI passes `(value, eventDetails)` and value may be **`null`** — type params accordingly |
| brand icons (`Facebook`, `Twitter`…) | **removed from lucide v1** — use inline SVG |

`Button` sizes are small by default (`default` = h-8). For prominent buttons add
`className="h-10 rounded-xl px-4"` or `h-11`.

**Never import `@base-ui/react/*` directly.** Use `@/components/ui/*`.

### Use these wrappers instead of raw primitives
- **`<AppSelect>`** (`@/components/ui/app-select`) — the *only* way to render a select.
  `value: string` (`""` = nothing), `onValueChange: (v: string) => void`, `options: {value,label}[]`,
  `emptyOption?: string` (e.g. "All governorates"), `placeholder`, `disabled`.
- **Form primitives** (`@/components/ui/form`) — `Form`, `FormField`, `FormItem`, `FormLabel`,
  `FormControl`, `FormMessage`, `FormDescription`. Hand-rolled (shadcn dropped `form`).
  Standard RHF + `zodResolver` usage.

---

## Data & API — already built. Import, don't reinvent.

Everything is a promise-returning service with simulated latency, so **every data
surface needs loading / error / empty states**.

```ts
import { useAsync, useMutation, useDebounced } from "@/hooks/use-async";
const { data, error, isLoading, refetch, setData } = useAsync(() => getBookings({...}), [deps]);
```

| Module | Key exports |
|---|---|
| `@/lib/api/providers` | `searchProviders(filters)` → `Paginated<Provider>`, `getProviderBySlug`, `getProviderById`, `getFeaturedProviders(type)`, `getPopularSpecialties()`, `getProviderReviews`, `getNearbyProviders`, `getAvailability(id, days, branchId?)` → `Record<isoDate, TimeSlot[]>`, `getSlotsForDate`, `getNextSlots` |
| `@/lib/api/bookings` | `holdBooking` (**the only door into a booking**), `beginPayment`, `payBooking(id, "success"\|"failure")`, `releaseHold`, `cancelBooking`, `cancelByProvider`, `cancelSession`, `processRefund`, `markCompleted`, `markNoShow`, `reportLongWait`, `rescheduleBooking`, `getBookings(query)`, `getBookingById`, `validateCoupon`, `findService`, `isUpcoming`, `isWithinFreeCancellation`, `CapacityError`, `EligibilityError` |
| `@/lib/api/profiles` | `getPatientProfiles(accountId)`, `getPatientProfile`, `createPatientProfile`, `updatePatientProfile`, `deletePatientProfile`, `checkEligibility` |
| `@/lib/api/availability` | `slotsForBranch`, `nextAvailableSlot`, `queuePositionFor`, `estimatedTimeFor`, `releaseExpiredHolds`, `branchOf`, `earliestAvailability` |
| `@/lib/eligibility` | `evaluateEligibility(service, profile)` → `EligibilityResult`, `describeEligibility`, `ageOf` |
| `@/lib/data/clinical` | `CHRONIC_CONDITIONS` (the vocabulary a provider declares rules from) |
| `@/lib/api/engagement` | `getFavorites`, `getFavoriteIds`, `toggleFavorite`, `getReviewsByPatient`, `getReviewsByProvider`, `createReview`, `updateReview`, `deleteReview`, `replyToReview`, `getNotifications`, `getUnreadCount`, `markNotificationRead`, `markAllNotificationsRead`, `deleteNotification` |
| `@/lib/api/stats` | `getPatientStats`, `getProviderStats`, `getAdminStats`, `getTopProviders(type)`, `getCancellationAnalytics`, `getRevenueAnalytics` |
| `@/lib/api/admin` | `getUsers`, `setUserStatus`, `getAdminProviders`, `setProviderStatus`, `getCoupons`/`createCoupon`/`updateCoupon`/`deleteCoupon`, `getCampaigns`/`createCampaign`/`updateCampaign`/`deleteCampaign`, `getCommission`, `updateCommission` |
| `@/lib/api/provider-admin` | `updateProviderProfile`, `getSchedule`, `updateSchedule`, `getHolidays`, `addHoliday`, `removeHoliday`, `getServices`, `createService`, `updateService`, `deleteService`, `createPackage`, `updatePackage`, `deletePackage` |
| `@/lib/api/auth` | `HOME_FOR_ROLE`, `RegisterInput` |
| `@/lib/data/egypt` | `GOVERNORATES`, `SPECIALTIES`, `getAreasFor(govId)`, `getGovernorateName`, `getAreaName`, `getSpecialtyName`, `slugify` |
| `@/lib/time` | `now()`, `todayISO()`, `addDays`, `toISODate` |
| `@/lib/format` | `formatDate`, `formatDateShort`, `formatTime`, `relativeDay`, `timeAgo`, `formatDuration`, `formatDelta`, `initialsOf` |
| `@/lib/site` | `SITE`, `BUSINESS` (bookingFee, paymentHoldMinutes, freeCancellationHours), `formatEGP`, `formatEGPCompact`, `formatNumber` |
| `@/lib/types` | the whole domain model — `Provider` (`Doctor \| Lab \| RadiologyCenter`, discriminated on `.type`), `Branch`, `PatientProfile`, `Booking`, `Review`, `Coupon`, `SearchFilters`, `Role`, … |

---

## The business rules the model enforces — do not route around them

The domain follows `.claude/Business-Logic-and-Product-Decisions-v2.md`. Four rules
are load-bearing; breaking them is a product bug, not a style choice.

1. **A booking belongs to a `PatientProfile`, never to an account** (§1). An account
   owns profiles (self + family); medical and booking history attach to the profile.
   Profiles are private to their account and are *never* merged or cross-linked.
2. **Preparation & eligibility gate the booking** (§3). Where a lab test or scan
   carries either, the flow must display them and the patient must acknowledge them
   before the booking can be finalized. `holdBooking` rejects a booking that lacks
   the acknowledgement, or whose profile fails `evaluateEligibility`.
3. **The 9-state lifecycle is the vocabulary** (§7): `held → awaiting_payment →
   confirmed → completed | no_show | cancelled_by_* → refund_pending → refunded`.
   Only `ALLOWED_TRANSITIONS` may happen — use `canTransition`, never assign a status
   directly. A missed visit means *the patient did not arrive*, may only be recorded
   after the session ended, and is not the same thing as `longWaitReported` (which
   counts against the **provider's** waiting-time reputation).
4. **Capacity is the single source of truth** (§5, §6, App. A). Confirmed bookings
   *and live holds* both consume a place. A **comfort** limit may be exceeded only
   with the patient's explicit consent (`acceptOverCapacity`); a **strict** limit is
   never exceeded. The loser of a race gets `CapacityError` with a real next step —
   never a bare error. Doctors run **sessions** (queue number + estimated time); labs
   and radiology run **slots**. Everything resolves per **branch**.

Holds expire after `BUSINESS.paymentHoldMinutes` and are *discarded*, returning the
place to capacity. A booking is never partially confirmed.

Auth: `const { user, isAuthenticated, isLoading, login, register, logout, updateProfile } = useAuth()`
from `@/components/providers/auth-provider`. There is no demo login, no role switcher
and no signup OTP — all three were mock affordances.

Use `now()` from `@/lib/time` for anything "now", and only inside client
components — a server render and the client evaluate it at different instants.

**What the API cannot serve, the app does not show.** MedPoint returns providers,
branches, services, slots, coupons and insurances — but no foreign keys on read, so
no service or slot can be attributed to a provider. Consequently: no provider price,
no availability, nothing bookable, no booking list, and no stats (there is no
analytics endpoint at all). Those screens render dashes and empty states on purpose.
Functions with no endpoint throw a 501 `ApiError` rather than pretending to save.

---

## Shared components — already built. Reuse, don't duplicate.

`@/components/shared/…`
- `provider-card` → `ProviderCard`, `ProviderCardCompact`, `providerHref(p)`, `providerSubtitle(p)`
- `search-bar` → `SearchBar` (`variant="hero" | "compact"`)
- `filter-sidebar` → `FilterSidebar` (desktop rail + mobile sheet)
- `calendar-picker` → `CalendarPicker` (date grid + time slots)
- `rating` → `RatingStars`, `RatingBadge`, `RatingInput`, `RatingCard`
- `review-card` → `ReviewCard`
- `statistics-card` → `StatisticsCard` (`change`, `invertChange`, `icon`, `tone`)
- `charts` → `RevenueChart`, `BookingsChart`, `TrendChart`, `CategoryBarChart`, `DonutChart`, `Sparkline`, `SERIES`
- `data-table` → `DataTable` (sortable/searchable/paginated), re-exports `ColumnDef`
- `notification-center` → `NotificationCenter`, `NotificationItem`, `CHANNEL_ICONS`, `CHANNEL_LABELS`
- `map-placeholder` → `MapPlaceholder` (Google Maps stand-in, real deep links)
- `states` → `EmptyState`, `ErrorState`, and skeletons: `ProviderListSkeleton`, `StatGridSkeleton`, `TableSkeleton`, `ChartSkeleton`, `ProfileSkeleton`, `ListSkeleton`
- `motion` → `PageTransition`, `Reveal`, `RevealItem`, `HoverLift`, `fadeUp`, `stagger`, `EASE`
- `dynamic-icon` → `DynamicIcon` (resolves `specialty.icon` strings safely)

`@/components/layout/…` → `SiteHeader`, `SiteFooter`, `Logo`, `ThemeToggle`,
`DashboardShell` (sidebar + role guard; props: `allow: Role[]`, `nav: NavSection[]`, `title`).

### Charts — non-negotiable rules
The categorical ramp (`--chart-1…5`, in fixed order teal→blue→green→amber→violet)
is **CVD-validated**. Do not add, reorder, or invent chart colors. Never a
dual-axis chart. Legend required for ≥2 series. Use the wrappers in `charts.tsx`.

---

## Conventions

- **Client components** for anything touching the API, auth, or `localStorage`
  (`"use client"`). Server components only for static shells + `metadata` exports.
  This is deliberate — it keeps hydration clean.
- Currency is **EGP** — always via `formatEGP`.
- Mobile-first. Tables scroll inside `overflow-x-auto`, never the page body.
- Radius: cards `rounded-2xl`, controls `rounded-xl`. Shadows: `shadow-soft`,
  `shadow-card`, `shadow-lift`, `shadow-glow`.
- Toasts via `toast` from `sonner`. Destructive actions → `AlertDialog`.
- Every list: loading skeleton → error state → empty state → content.
- Do **not** leave TODOs or placeholder screens. Build it fully.

## Verify before you finish
```
npx tsc --noEmit     # must be clean
```
