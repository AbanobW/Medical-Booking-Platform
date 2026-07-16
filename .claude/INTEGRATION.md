# MedPoint integration — START HERE

The state of the frontend↔backend integration, and what it takes to finish it.
Written to be read cold: an agent resuming this work should not need to re-derive
the map from `vesita-app/src/lib/api/`.

**Verified against live staging (`https://medpoint.intrazero.org`), last re-probed 2026-07-16.**
Re-probe before you trust it — see [Verify before you trust](#verify-before-you-trust).

**Companion documents**
- `.claude/Business-Logic-and-Product-Decisions-v2.md` — what the product must do. Product truth.
- `.claude/BACKEND-GAPS.md` — what staging fails to do, phrased as an ask to the backend team.
- `.claude/API-CONTRACT.md` — endpoint catalogue, wire DTOs, and the field-level gap map.
- `vesita-app/CLAUDE.md` — the build contract for the app itself.

---

## There is no mock. This is a rewrite, not an update.

Earlier revisions of this document described a hybrid: a seeded localStorage dataset
(`src/lib/data/seed.ts`) alongside MedPoint, with per-domain routing decided by
`src/lib/api/capabilities.ts` and a global `NEXT_PUBLIC_API_MODE` switch. **All of that is
deleted.** There is no mock, no seed, no capability flags, no mode switch, and no
localStorage overlay reconstructing a booking from wizard context. Every function in
`src/lib/api/*` talks to MedPoint or nothing.

Two consequences follow directly:

- **Unknown is `null`, and `null` renders as an em dash.** A field the API cannot answer
  is never coerced to `0`, `""`, or a plausible constant — that coercion (a `0` rating
  indistinguishable from an unrated provider, `"09:00 – 21:00"` opening hours nobody set,
  a doctor's gender defaulting to male) is exactly what got removed. See `formatEGP`,
  `formatNumber`, `DASH`, `orDash` in `src/lib/i18n/format.ts`.
- **A capability with no endpoint throws, it does not pretend.** Where the mock used to
  quietly serve a plausible response, the live function now throws a `501 ApiError`
  ("… is not available yet — <why>") or returns an empty list. The UI surfaces that
  through the ordinary error/empty-state path rather than through a silent fallback.

The result is an app that is honest about a genuinely thin backend. Read
`vesita-app/CLAUDE.md`'s opening section before touching any screen — it states this
rule for the build itself.

---

## ⚠️ Staging facts still true as of the last re-probe

| What | Status | Consequence |
|---|---|---|
| `POST /v1/auth/register` | ✅ `201` + a real token pair | Fixed; the old login-fallback workaround is deleted, not just retired |
| `/v1/me/profiles` (the profiles route moved off `/v1/patient-profiles`) | ✅ full CRUD works | Live, direct — no client-side reconstruction needed |
| `GET /v1/services`, `/v1/slots`, `/v1/doctor-sessions` | 🔴 **no `branch_id` on read** | Nothing can be attributed to a provider or branch. **The keystone gap** — see below |
| `GET /v1/branches` | 🔴 **no `provider_id` on read** | Same problem one level up |
| List endpoints (`providers`, `services`, `slots`, …) | 🔴 filters ignored; `per_page` ignored, pinned at 10 rows/page | `/services` is 5 pages of 10 for 49 rows; `/slots` is 105 pages of 10 for 1044 rows |
| `GET /v1/bookings` | 🔴 no relations, no appointment datetime | A booking cannot be rendered once created |
| `POST /v1/auth/refresh-token` | 🔴 500s | Session dies 24h after sign-in with no renewal |
| Hashids | 🔴 collide across every model | Provider row 1, Branch row 1, Service row 1 all encode to the same string |
| CORS | 🔴 no `Access-Control-*` headers at all | Proxied same-origin through `next.config.ts`; see below |

Re-probe commands for all of these are in [Verify before you trust](#verify-before-you-trust).

---

## The one-paragraph summary

**The writes line up with the spec; the reads do not.** `POST /v1/bookings` takes
`patient_profile_id`, `branch_id`, a polymorphic `bookable_type`/`bookable_id` and
`price_snapshot`; `POST /v1/services` takes `branch_id`; `POST /v1/slots` takes
`branch_id` + `service_id`; `POST /v1/branches` takes `provider_id`. Every relation the
platform needs is accepted on write. **None of it comes back on read.** `GET` on any of
these resources omits the foreign key it just accepted, so a service can never be
attributed to the branch it was created under, a branch never to its provider. Combined
with list endpoints that ignore every filter and a `Booking` payload with no relations or
datetime, the result is: real prices exist in the database, but no client can attribute
one to a provider — so there is no price, no availability and nothing bookable, and the
UI says so rather than inventing an attribution. This is a small, local backend fix
(populate the columns on read), not a redesign.

---

## Orientation

App root is **`vesita-app/`**. The integration layer is `vesita-app/src/lib/api/`:

```
src/lib/api/
  config.ts        — apiBaseUrl()/apiUpstream() only; no mode switch
  errors.ts        — ApiError (was in the now-deleted client.ts)
  http.ts          — the fetch transport; envelope unwrapping, error mapping, 401 handling
  tokens.ts        — access/refresh token storage (localStorage, deliberately — see below)
  session.ts       — the seam auth-provider talks to; sequences the two account-write endpoints
  auth.ts          — HOME_FOR_ROLE + RegisterInput only; no demo accounts, no OTP
  providers.ts, availability.ts, bookings.ts, profiles.ts,
  engagement.ts, stats.ts, admin.ts, provider-admin.ts
                   — thin seams re-exporting medpoint/* (real) or refusing what has no endpoint
  medpoint/
    types.ts       — wire DTOs, exactly as Laravel sends them
    mappers.ts     — the one file that knows MedPoint's field names
    cache.ts       — fetchAllPages() (page-walks a list), createCachedLoader() (TTL + coalescing)
    auth.ts, profile.ts, profiles.ts, providers.ts, availability.ts, bookings.ts, admin.ts
                   — one file per resource, calling MedPoint directly
```

The browser never talks to MedPoint directly: no CORS headers are sent (see below), so
`apiBaseUrl()` returns the relative constant `/api/medpoint` and `next.config.ts` rewrites
that upstream server-to-server.

### No CORS — the one infrastructural workaround that's still standing

MedPoint sends no `Access-Control-Allow-*` header on any response, success or failure. A
browser therefore discards every response to a direct cross-origin call. `next.config.ts`
rewrites `/api/medpoint/*` upstream, so the browser makes a same-origin call and Next
proxies it server-to-server, where CORS does not apply. This costs a hop and is the reason
`apiBaseUrl()` can't just point at `https://medpoint.intrazero.org` directly.

**Ask:** send CORS headers for the web origins. Then the rewrite can be deleted and
`config.ts` simplified to one constant.

---

## Current status, by domain

| Domain | Status | Module | Why |
|---|---|---|---|
| Auth (login/register/logout/session restore) | ✅ live | `session.ts` → `medpoint/auth.ts` | Works end to end. Refresh is written (`medpoint/auth.ts#refreshSession`) but has zero call sites — `POST /auth/refresh-token` 500s, so wiring it into a 401-retry would just turn every expired session into a 500 |
| Account profile (name/phone/gender/DOB/avatar) | ✅ live | `session.ts` → `medpoint/profile.ts` | Two writers: `PUT /v1/profile` (name, phone), `PATCH /v1/users/:id` (gender, birth). `session.ts#updateProfile` sequences both — name/phone first, so a partial failure leaves the visible identity correct |
| Patient profiles (CRUD) | ✅ live | `profiles.ts` → `medpoint/profiles.ts` | Full CRUD under `/v1/me/profiles`, including the auto-created SELF profile. This was the worst regression in the previous revision of this doc (route 404s on every verb) — **it is fixed and confirmed working** |
| Provider discovery | 🟡 **live, but nothing is bookable** | `providers.ts` → `medpoint/providers.ts` | Providers, branches and services are all real, fetched and paginated correctly (§ cache.ts fix below) — but no service can be attributed to a branch (no `branch_id` on read), so every provider has zero services, `price` is `null`, and the search/sort/filter fields that depend on service or rating data (price range, rating) can only ever exclude everything. `Provider` grew `gender`/`specialty`/`subspecialty`/`rating_avg`/`rating_count`/`syndicate_number`/`verified_at` since this was first documented (BACKEND-GAPS.md §1.5) — real progress, but every one is still null/0 on staging today, so the specialty-from-name parse stays the load-bearing path and there is still no rating to show. |
| Availability | 🟡 same root cause | `medpoint/availability.ts` | Slots and doctor-sessions are real and correctly paginated, but carry no `branch_id` on read either, so none can be attached to the provider being viewed |
| Booking — create | ✅ live | `bookings.ts` → `medpoint/bookings.ts#holdBooking` | `POST /v1/bookings` succeeds and the server records it. The response is assembled from what was sent and accepted — it is a receipt for one request, not something that can be read back later |
| Booking — pay | 🔴 **refuses on purpose** | `medpoint/bookings.ts#beginPayment`/`#payBooking` | Both throw a `501`. They used to swallow a failed `POST /v1/payments` and mark the booking confirmed-and-paid locally regardless — the single most dangerous line in the old codebase. Removed rather than fixed: there is nothing to confirm the payment against once it succeeds, since bookings can't be read back either. **Consequence: only a `cash` booking (fee = 0, confirmed immediately) can complete the wizard today** — any online-fee payment method is blocked at the payment step |
| Booking — read/cancel/reschedule/refund | 🔴 refuses | `bookings.ts` | `getBookings` always returns an empty page; everything else throws `501`. `GET /v1/bookings` returns `{type, id, status, price_snapshot, booking_fee, payment_status, queue_number, source, …}` — no provider, no service, no branch, no date, no time. "Dr. Hala Mansour — Cardiology, Tue 16 Jul, 10:00" is not derivable from that response, on the list endpoint or the detail one |
| Favourites | 🔴 refuses | `engagement.ts` | No `/v1/favorites` resource exists at all. Reads are empty; `toggleFavorite` throws |
| Reviews | 🔴 refuses on write, empty on read | `engagement.ts` | `/v1/reviews` exists and answers `200` with zero rows, but takes no `provider_id`/`patient_id` filter and its wire shape is undocumented (`ratings` is an untyped array with no sample response). Nothing is decoded from a guess |
| Notifications | 🔴 refuses on write, empty on read | `engagement.ts` | Same shape of gap as reviews |
| Admin — users, providers | 🟡 live, admin-gated | `admin.ts` → `medpoint/admin.ts` | `GET /v1/users` / `/v1/providers` are real; a non-admin token gets `403`, which is surfaced rather than swallowed. Client-side filtering (no server-side filters, as everywhere else) |
| Admin — coupons | ✅ live (read + delete) | `admin.ts` → `medpoint/admin.ts` | `/v1/coupons` lists 5 real coupons and deletes work. Create/update refuse: the wire coupon has no description, minimum-order or applies-to column to write |
| Admin — campaigns, commission | 🔴 refuses | `admin.ts` | No endpoint exists for either |
| Admin — suspension | 🔴 refuses | `admin.ts` | A hard suspension must cancel and refund every upcoming booking (§13) — impossible while bookings can't be listed or refunded |
| Provider-admin (schedule/services/packages) | 🔴 refuses | `provider-admin.ts` | Same `branch_id` gap as discovery: a service can be *created* (`POST` accepts `branch_id`) but not listed back, so an editor that cannot show what it just created isn't one |
| Stats & analytics (patient/provider/admin dashboards) | 🔴 null/empty, always | `stats.ts` | No analytics endpoint exists, and `Booking` carries no foreign keys to aggregate even client-side. Every metric is `null`; every chart series is `[]` |

---

## What used to be a "workaround registry" — now mostly permanent decisions

The previous revision of this document tracked eleven numbered hacks with removal
triggers, on the assumption the mock was temporary scaffolding around them. Several of
those hacks are now simply **deleted** rather than retired, because the thing they
patched over (the mock, the overlay) is gone too. What's left is a shorter list of
decisions the code actually still embodies:

| # | Decision | Where | Reconsider when |
|---|---|---|---|
| 1 | **Never join two resources by id.** Every model's row index hashes to the same string with the same salt — `Provider` row 1, `Branch` row 1, `Service` row 1 are all `W6V1Y2Pn83Q7mDEK`. This looks exactly like a foreign key and is not one: joining on it pairs row N with row N regardless of what they actually are (a lab would get a doctor's consultation). `medpoint/providers.ts#buildCatalog` attaches a branch to a provider **only** via the real `provider_id`/`branch_id` fields, and explicitly documents why not to "fix" the resulting empty-services problem by matching ids instead. | `medpoint/providers.ts` (`buildCatalog`) | ids are salted per model, or globally unique |
| 2 | **`fetchAllPages` trusts the reported total, not the batch size.** The server pins every page at 10 rows regardless of what's requested (`limit`/`per_page` both ignored) — the old version sent `limit` and stopped on the first page shorter than requested, which meant *every* page was "short" and the catalog silently saw 10 of 49 services, 10 of 1044 slots. Fixed to walk pages until `items.length >= pagination.total`, capped at `MAX_PAGES = 40` with a console warning if that cap is hit before the total is reached (currently true for `/slots`, at 105 pages for 1044 rows). | `medpoint/cache.ts` | the API honours `per_page`, or exposes a filter so whole tables stop needing a full walk |
| 3 | **Payment is refused, not attempted-then-swallowed.** `beginPayment`/`payBooking` throw a `501` instead of calling `POST /v1/payments` and ignoring a rejection. This blocks online-fee bookings entirely rather than risk showing a confirmed-paid booking the server never recorded. | `medpoint/bookings.ts` | `POST /v1/payments` has a confirmed accepted shape **and** bookings can be read back (so a payment can be reconciled against something) |
| 4 | **Tokens in `localStorage`** (`vesita:medpoint:access:v1` / `…:refresh:v1`). Readable by any XSS. Accepted deliberately: the app is a client-rendered SPA with no server session. | `tokens.ts` | an httpOnly `SameSite` refresh cookie ships — needs CORS + `Allow-Credentials` first |
| 5 | **`refreshSession()` is written but has zero call sites.** `POST /auth/refresh-token` 500s (`RefreshToken::createFrom()` type-hints the framework's base `Request`), so wiring it into a 401-retry today would turn every expired session into a 500 instead of a clean sign-out. | `medpoint/auth.ts` (defined, unused) | refresh-token stops 500ing — then wire it into `http.ts`'s 401 handling |
| 6 | **`roleOf()` hard-codes `"patient"`.** MedPoint ships full RBAC (`/v1/roles`, `/v1/permissions`) but a new signup gets no role and `WireUser` carries none. Provider and admin sign-in are impossible against MedPoint as a result — the admin screens that do work (users, providers, coupons) are reached with a manually-issued admin token, not through the app's own sign-in. | `medpoint/mappers.ts#roleOf` | a role appears on the user payload |
| 7 | **Location data is `null` rather than a fuzzy-matched guess.** `governorateIdOf`/`areaIdOf` (`medpoint/mappers.ts`) resolve the wire's free-text governorate/area against `GOVERNORATES`/areas and return `null` on a miss — this used to default to `"cairo"`/`"nasr-city"`, silently relocating an unrecognised branch to the capital. A wrong location is worse than an unknown one. | `medpoint/mappers.ts` | the backend offers a controlled vocabulary, or ids instead of free text |

---

## Business rules the live path currently cannot honour

Rules from the business doc that the code is written to enforce, but that the API gives
it nothing to enforce them *against*:

### §3 — the mandatory preparation/eligibility gate is real, but partial

The rule: a booking cannot be finalized until the patient has acknowledged preparation
instructions and the profile's eligibility. This is still enforced in code
(`requiresAcknowledgement`, the booking-wizard gate) — but the screening itself is
narrower than the business doc describes, because the wire only carries two of the four
signals it needs:

- **Gender and age** screen for real — a `PatientProfile` stores both, so
  `evaluateEligibilityDetailed` can genuinely block a booking on them.
- **Pregnancy and excluded-condition rules** are declared on a service (when
  `prep_instructions`/`eligibility_rules` are populated — see the gap below) and are
  *shown and acknowledged*, but never *auto-screened*, because a `PatientProfile` has no
  pregnancy or chronic-condition column to check against. This was a deliberate scope
  decision (see `.claude/BACKEND-GAPS.md` §1.7), not an oversight: collecting a field the
  server cannot store would mean asking the patient twice.

`GET /v1/services` returns `"prep_instructions": null` and omits `eligibility_rules` from
the payload entirely — so even the "shown and acknowledged" half is currently empty in
practice. `WireService` declares both fields and `POST /v1/services` accepts them; the
gap is read-side only.

### §5, §9, Appendix A — capacity and holds have no server enforcement

There is no server-side hold or expiry concept at all. `holdBooking` sets a client-side
`holdExpiresAt`, but nothing on the server tracks or enforces it — and since a booking
can't be read back, there is no way to even check whether it lapsed. Appendix A's
guarantee ("exactly one succeeds" when two patients race for the last place) has no
server-side mechanism behind it.

### §1 — profile isolation holds

This one *does* work correctly: `medpoint/profiles.ts` checks `wire.user_id`/ownership
and 404s on a mismatch (never 403 — see API-CHANGES.md §5), and the SELF-profile
uniqueness rule is enforced both client-side and by the server (a second SELF profile is
a 422).

### §13 — suspension cannot be enforced as specified

A hard suspension must cancel and refund every upcoming booking. With no way to list a
provider's bookings, this is not implementable today regardless of the suspension
endpoint's existence.

---

## Path to full-live

Ordered by unblocks-the-most-per-unit-of-backend-work.

1. **Populate `branch_id` on `GET /v1/services`, `/v1/slots`, `/v1/doctor-sessions`, and
   `provider_id` on `GET /v1/branches`.** *The keystone — bigger than everything else
   combined.* These are already accepted on `POST`; they are simply not returned. This one
   fix makes discovery, availability and pricing real, unblocks booking end-to-end (cash
   and online), and is the prerequisite for provider-admin ever working.
2. **Give `Booking` its relations and its appointment datetime**, or make
   `?include=provider,service,branch,slot` actually do something (it's accepted with `200`
   today and changes nothing; `meta.include` is always `[]`). Unblocks booking read,
   cancel, reschedule, refund, reviews-after-a-visit, and every dashboard stat.
3. **Confirm the accepted shape for `POST /v1/payments`** and make it return a
   deterministic success or a 4xx. Combined with #2, this lets online-fee bookings
   complete and be reconciled — today they're blocked at the payment step by design.
4. **CORS headers** for the web origins → deletes the `next.config.ts` rewrite, and is a
   hard prerequisite for httpOnly refresh cookies.
5. **Server-side filtering, sorting and search** on `/v1/providers` and `/v1/services`
   (`provider_type=`, `search=`, `q=`, `filter=` are all currently ignored) plus honouring
   `per_page` — makes `/search`'s filter dimensions real and retires the page-cap warning
   in `medpoint/cache.ts`.
6. **Ship a `/v1/favorites` resource.**
7. **Fix `POST /v1/auth/refresh-token`** (500s on a bad type-hint) → wire
   `refreshSession()` into `http.ts`'s 401 handling → sessions stop dying at 24h.
8. **Salt hashids per model**, or return globally unique ids.
9. **A role on the user payload** → provider/admin sign-in becomes possible without a
   manually-issued token.
10. **Turn off debug mode in staging** — full PHP stack traces and file paths currently
    ride on every 5xx body (`http.ts` already replaces them with a generic message before
    the user sees anything, but they shouldn't be on the wire).
11. **Machine-readable error codes.** Laravel sends prose only; a business rejection keeps
    the server's English sentence verbatim, so Arabic users see English for exactly the
    errors that matter most (why their booking or code was rejected).

---

## Verify before you trust

This document was true on **2026-07-16**. Re-probe before acting on it.

```bash
# CORS. Expect: no output (no Access-Control-* header at all).
curl -sI -X POST https://medpoint.intrazero.org/v1/auth/login \
  -H 'Origin: http://localhost:3000' -H 'Content-Type: application/json' \
  -d '{"email":"x@y.z","password":"nope"}' | grep -i access-control

# Register. Expect: 201 + a token pair.
curl -s -X POST https://medpoint.intrazero.org/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"full_name":"Probe","email":"probe+'"$(date +%s)"'@example.com","password":"password","phone":"+201234567890"}' \
  | head -c 300

# Refresh-token. Expect: 500.
curl -s -X POST https://medpoint.intrazero.org/v1/auth/refresh-token \
  -H 'Content-Type: application/json' -d '{}' | head -c 300

# The rest need a bearer token:
TOKEN=...   # from POST /v1/auth/login or /v1/auth/register

# Patient profiles. Expect: 200 with a list, including a "self" relationship.
curl -s https://medpoint.intrazero.org/v1/me/profiles -H "Authorization: Bearer $TOKEN" | head -c 400

# THE keystone check — does a service carry branch_id yet?
curl -s https://medpoint.intrazero.org/v1/services -H "Authorization: Bearer $TOKEN" | head -c 400
# Expect today: no "branch_id" key at all. The day it appears, discovery/availability/
# booking all become fixable in one pass — re-read this document's "Path to full-live" #1.

# Hashid collision. Expect: the three lists share their first ids.
for r in providers services bookings; do
  echo -n "$r: "
  curl -s "https://medpoint.intrazero.org/v1/$r" -H "Authorization: Bearer $TOKEN" \
    | grep -o '"id":"[^"]*"' | head -3 | tr '\n' ' '
  echo
done

# Filters ignored. Expect: identical payloads.
curl -s 'https://medpoint.intrazero.org/v1/providers?provider_type=lab' -H "Authorization: Bearer $TOKEN" | md5
curl -s 'https://medpoint.intrazero.org/v1/providers'                   -H "Authorization: Bearer $TOKEN" | md5

# Page size. Expect: "per_page": 10 regardless of what you ask for.
curl -s 'https://medpoint.intrazero.org/v1/services?per_page=100' -H "Authorization: Bearer $TOKEN" \
  | grep -o '"per_page":[0-9]*'

# Booking payload. Expect: no *_id fields, no date/time.
curl -s 'https://medpoint.intrazero.org/v1/bookings?include=provider,service,branch,slot' \
  -H "Authorization: Bearer $TOKEN" | head -c 600
```
