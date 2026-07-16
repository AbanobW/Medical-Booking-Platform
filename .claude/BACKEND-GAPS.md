# MedPoint API — integration gaps

**This is the ask to the backend team.** The frontend-side companion is
[`INTEGRATION.md`](./INTEGRATION.md) — capability state, workaround registry, and the
ordered path to full-live. Field-level wire↔domain shapes are in
[`API-CONTRACT.md`](./API-CONTRACT.md).

Everything below was **verified against the live staging API**
(`https://medpoint.intrazero.org`) **on 2026-07-14**, with the read-side gaps re-confirmed
2026-07-16 — not inferred from the Postman collection, which ships request shapes only and
no example responses. `INTEGRATION.md` carries the `curl` probes to re-check every item
here in about a minute; do that before trusting this file.

**There is no mock backend.** The app used to run a hybrid — a seeded localStorage
dataset alongside MedPoint, with `src/lib/api/capabilities.ts` routing each domain to
whichever one could serve it. That capability layer, and the dataset it fell back to, are
both deleted. Every function under `src/lib/api/*` now either calls MedPoint or refuses:
a domain with no working endpoint throws a `501 ApiError` or returns empty, rather than
serving a plausible stand-in. So "Live?" below is no longer a routing question — it is a
factual one, per domain, per direction (read vs. write). See `INTEGRATION.md` for the full
per-domain status table and `src/lib/api/session.ts` for auth.

## Integration status (frontend, 2026-07-16)

| Capability | Live? | Module | Notes |
|---|---|---|---|
| Auth (login/register/logout/profile) | Yes | `session.ts` → `medpoint/auth`, `medpoint/profile` | Register works; refresh still unwired (§2.2) |
| Account gender/date-of-birth | Yes | `session.ts` → `medpoint/profile` | Via `PATCH /v1/users/:id` — a second writer alongside `PUT /v1/profile` for name/phone |
| Avatar upload/delete | Yes | `session.ts` → `medpoint/profile` | |
| Patient profiles CRUD | Yes | `profiles.ts` → `medpoint/profiles` | Fixed since the last revision of this doc — `/v1/me/profiles` works end to end, including the auto-created SELF profile |
| Provider discovery | 🔴 **live, but nothing is bookable** | `providers.ts` → `medpoint/providers` | Providers/branches/services are real and correctly paginated, but no service can be attributed to a branch (§1.2/§1.7 below), so every provider has zero services and a null price |
| Availability | 🔴 same cause | `providers.ts` → `medpoint/availability` | Slots/sessions are real but carry no `branch_id` either |
| Booking write — create | Yes | `bookings.ts` → `medpoint/bookings` | `POST /v1/bookings` succeeds; the response is a receipt, not something re-readable |
| Booking write — pay | 🔴 **refuses on purpose** | `medpoint/bookings.ts` | Throws `501` rather than swallowing a `POST /v1/payments` rejection (§2.4) — only a `cash` (fee-free) booking can complete the wizard today |
| Booking read/cancel/reschedule/refund | 🔴 refuses/empty | `bookings.ts` | `GET /v1/bookings` has no relations or datetime — nothing to render |
| Favorites | 🔴 refuses/empty | `engagement.ts` | No API resource |
| Reviews / notifications | 🔴 refuses/empty | `engagement.ts` | Endpoints exist, answer 200 with zero rows, take no filter, undocumented shape |
| Admin — users, providers, coupons (read) | Yes, admin-gated | `admin.ts` → `medpoint/admin.ts` | 403 for a non-admin token, surfaced not swallowed |
| Provider admin / stats / campaigns / commission | 🔴 refuses/empty | `provider-admin`, `admin`, `stats` | No endpoint, or the same `branch_id` gap as discovery |

---

## 1. Blockers — these stop a flow from being built at all

### 1.1 No CORS headers on any response

No `Access-Control-Allow-Origin` (or any `Access-Control-*` header) is sent, on
success or failure. A browser therefore discards every response, and **no
browser-based client can call this API directly.**

```
$ curl -i -X POST https://medpoint.intrazero.org/v1/auth/login \
    -H 'Origin: http://localhost:3000' -H 'Content-Type: application/json' \
    -d '{"email":"x@y.z","password":"nope"}' | grep -i access-control
  (nothing)
```

**Worked around**, not fixed: `next.config.ts` rewrites `/api/medpoint/*` upstream, so
the browser makes a same-origin call and Next proxies it server-to-server. This costs a
hop and means the API is only reachable through our own origin.

**Ask:** send CORS headers for the web origins. Then the rewrite can be deleted.

### 1.2 `Booking` has no relations, no foreign keys and no date

This is the single biggest blocker. The payload — identical on both the list and the
detail endpoint — is:

```json
{ "type": "Booking", "id": "…", "status": "no_show", "price_snapshot": "121.00",
  "booking_fee": "0.00", "payment_status": "unpaid", "queue_number": null,
  "source": "walk_in", "created_at": "…", "updated_at": "…" }
```

There is no `provider_id`, `service_id`, `branch_id`, `patient_profile_id`, `slot_id`,
and **no appointment date or time anywhere**. `?include=provider|service|branch|slot|…`
is accepted (200) but changes nothing, and `meta.include` is always `[]`.

So a booking cannot be rendered. "Dr. Hala Mansour — Cardiology, Tue 16 Jul, 10:00" is
not derivable from this response. `/patient/bookings`, the patient dashboard, reschedule
and cancel all show an empty list / refuse outright until this is fixed — there is no
fallback dataset standing in for them any more.

**Ask:** either embed the related resources via a working `?include=`, or at minimum
expose the foreign keys plus the appointment datetime.

### 1.3 Hashids collide across every resource type

Row 1 of *every* table encodes to the same id — the hashid salt is not per-model:

```
GET /v1/providers → ['W6V1Y2Pn83Q7mDEK', 'Wnv5ej3omPL6Z8gK', '6z5YEpP4GwRdm0gb']
GET /v1/services  → ['W6V1Y2Pn83Q7mDEK', 'Wnv5ej3omPL6Z8gK', '6z5YEpP4GwRdm0gb']
GET /v1/bookings  → ['W6V1Y2Pn83Q7mDEK', 'Wnv5ej3omPL6Z8gK', '6z5YEpP4GwRdm0gb']
```

An id is only meaningful together with its type. It cannot be used as a cache key, a
React key across mixed collections, or a URL slug without ambiguity. Combined with 1.2
(no foreign keys) it is also impossible to tell which `Provider` a `Booking` belongs to
even if you had the id.

**Ask:** salt the hashid per model, or return globally unique ids.

### 1.4 List endpoints accept no filters or search

`provider_type=`, `search=`, `q=`, `filter=` are all silently ignored — every query
returns the same unfiltered page. Only `page` works; **neither `limit` nor `per_page`
changes the page size** — every page is pinned at 10 rows regardless of what's requested
(re-confirmed 2026-07-16: `?per_page=100` still reports `"per_page": 10`).

`/search` is the app's core discovery surface with twelve filter dimensions
(specialty, governorate, area, gender, rating, price range, availability, …). The app
walks every page client-side and filters/sorts in the browser (`medpoint/cache.ts#fetchAllPages`),
which works for correctness but not for scale — and it's moot regardless while §1.2/§1.7
below mean nothing is attributable to a provider in the first place.

**Ask:** filtering, sorting and full-text search on `/v1/providers` and `/v1/services`.

### 1.5 `Provider` is thin, but less than it was — partially fixed

Re-probed 2026-07-16. `GET /v1/providers` now returns:

```json
{ "type": "Provider", "id": "…", "provider_type": "doctor",
  "name": "Dr. Hala Mansour — Cardiology",
  "gender": null, "specialty": null, "subspecialty": null,
  "rating_avg": null, "rating_count": 0,
  "syndicate_number": null, "verified_at": null,
  "status": "active", … }
```

Seven fields were added since this was first documented: `gender`, `specialty`,
`subspecialty`, `rating_avg`, `rating_count`, `syndicate_number`, `verified_at`. This is
real, meaningful progress on this item — a rating and a specialty no longer have to be
inferred or left blank once populated.

**But every one of them is still `null` (or `0`) on every provider on staging today**, so
in practice nothing has changed yet: `specialty` being null means `mappers.ts#parseProviderName`
splitting it out of `name` is still the load-bearing path, not a fallback for an edge case.
The frontend now prefers the dedicated field when it's populated and falls back to the
name-parse when it isn't (`toProvider`, `mappers.ts`).

Two things this surfaced that were **frontend bugs, now fixed**, not backend gaps:
- `parseProviderName`'s no-match case returned the literal string `"general"`, which is not
  a real id in `SPECIALTIES` (the closest entry is `"general-surgery"`, a different
  specialty). `getSpecialtyName` then papered over the miss with the invented label
  "General Practice" — a category no doctor claimed. Fixed to return `null`, which the UI
  already renders as a dash.
- `"Orthopaedics"` (British spelling, no alias) fell into that same bug — "Dr. Omar Sabry —
  Orthopaedics" resolved to nothing and showed "General Practice". Added the missing alias.

Still missing and still blocking: no rating on a card until real ratings exist (`rating_avg`
stays null until then — a real `rating_count: 0` is now distinguishable from "unknown", but
there's nothing to average yet), no photo, no bio — and, unchanged and far more consequential
— **still no price**, because price is derived from the provider's services and no service
can be attributed to a branch (§1.2, §1.7, unaffected by this update). The frontend does not
fabricate any of these; it shows the gap.

### 1.6 No favourites resource

There is no `/v1/favorites` (or equivalent) in the collection or on the server.
`/patient/favorites` — a built, working screen — has nothing to talk to.

### 1.7 `Service` never returns its preparation or eligibility rules

`POST /v1/services` accepts `prep_instructions`, `eligibility_rules` and `home_collection`
— the schema was built for §3 of the business rules. But nothing comes back populated on
the read side.

There are also no `chronic_conditions` / `is_pregnant` columns on a patient profile. That
half is now **settled rather than outstanding**: the app no longer collects either, because
a field the server cannot keep is a field the user fills in twice. Screening runs on
`gender` and `date_of_birth`, which do persist; a service's pregnancy and excluded-condition
rules stay declared, displayed and acknowledged. If those columns ever land, re-screening
them is a change to `evaluateEligibilityDetailed` and the profile form — nothing else.

This is a **safety** rule, not a nice-to-have. §3 requires that where a lab test or scan
carries preparation instructions or eligibility restrictions, the booking flow *must*
display them and the patient *must* acknowledge them before the booking can be finalized —
so a patient does not turn up having eaten before a fasting test, or ineligible for a scan.

In live mode there is nothing to display. `mappers.ts#wireServiceToLabTest` and
`#wireServiceToScan` synthesize empty `preparation` / `eligibility` blocks, so the gate
renders and passes vacuously.

Probed, to rule out the possibility that this was merely a frontend oversight — it is not.
`GET /v1/services` returns `"prep_instructions": null` and **omits `eligibility_rules` from
the payload entirely**:

```json
{ "type": "Service", "id": "W6V1Y2Pn83Q7mDEK", "name": "Initial Consultation",
  "category": "consultation", "price": "449.00", "prep_instructions": null,
  "home_collection": false, … }
```

**Ask:** return `prep_instructions` and `eligibility_rules` populated on `GET /v1/services`,
and add `chronic_conditions` + `is_pregnant` to the patient profile so there is something
to screen against. No frontend change can substitute for this — the data is not on the wire.

---

## 2. Server bugs — endpoints that exist but 500

### 2.1 ✅ `POST /v1/auth/register` → FIXED

Was a 500 (`RuntimeException: Personal access client not found for 'users' user provider.`
— Passport had no personal-access client, so registration created the user row and *then*
died issuing the token, leaving the account real but the user un-told).

**Re-probed: it now returns `201` with a live token pair.** Nothing more is needed from the
backend here.

Frontend follow-up: `medpoint/auth.ts#register` still falls back to `login()` on a 5xx.
That is now dead code which would mask a genuine future failure — **delete it**
(`medpoint/auth.ts:73-80`), keeping the 422 path intact.

### 2.2 `POST /v1/auth/refresh-token` → 500

```
RefreshToken::createFrom(): Argument #1 ($request) must be of type
  App\Ship\Parents\Requests\Request, Illuminate\Http\Request given
```

Fails with or without a `refresh_token` in the body. **Token refresh is impossible**,
so a session dies 24h after sign-in (the access token's TTL) with no way to renew it.

`medpoint/auth.ts#refreshSession()` is written and correct, but cannot be wired into a
401-retry interceptor until this works — doing so now would just turn every expired
session into a 500. Today a 401 clears the token and signs the user out.

### 2.3 🔴 `/v1/patient-profiles` → the whole route is GONE (404 on every verb)

**This is now the most urgent item in this document, and it is a regression.**

```
$ curl -H "Authorization: Bearer $TOKEN" -H 'Accept: application/json' \
    https://medpoint.intrazero.org/v1/patient-profiles
  {"message": "The route v1/patient-profiles could not be found."}
```

Every verb — `GET`, `POST`, and by extension `GET|PATCH|DELETE /:id` — 404s. The resource
has disappeared from routing since it was last probed.

Previously the picture was narrower: `POST` worked and returned a created profile, while
`GET` (list) 500'd with

```
ListPatientProfilesTask::{closure}(): Argument #1 ($query) must be of type
  Eloquent\Builder, PatientProfile given
```

Both need fixing, in that order: **restore the route, then fix the list closure.**

Why this matters more than anything else here: a booking belongs to a patient profile (§1
of the business rules) and the booking wizard *opens* by choosing one. With no profile
resource at all, **the live booking flow cannot run** — this is no longer a degradation,
it is a hard stop, and it blocks the flow independently of 1.2.

### 2.4 `POST /v1/payments`' accepted shape has never been confirmed — so the frontend no longer calls it

This used to be the most dangerous item in this document: `payBooking` posted
`{ booking_id, amount, purpose, gateway }`, caught any failure, and confirmed the booking
as paid in a local overlay regardless — so a patient could see a confirmed, paid booking
while the server held no payment row at all.

**That code is deleted, not patched.** `medpoint/bookings.ts#beginPayment` and `#payBooking`
now both throw a `501` unconditionally. This isn't a fix so much as a refusal: even a
successful `POST /v1/payments` couldn't be reconciled against anything today, because a
booking can't be read back either (§1.2) — there is nowhere to record "this booking is
now paid" once the request that created it has scrolled off. The practical consequence is
that **only a `cash` booking (`booking_fee = 0`, confirmed immediately with no payment
step) can complete the wizard.** Any online payment method is a dead end at the payment
step.

**Ask:** confirm the accepted request shape for `POST /v1/payments`, make it return a
deterministic success or a 4xx, and — paired with §1.2 — give bookings a way to be read
back so a payment has something to attach to. Only then is there a booking to confirm
against, and the frontend can re-wire online payment instead of refusing it outright.

### 2.5 Debug mode is on in staging

Responses carry full PHP stack traces, file paths (`/var/www/MedPoint/…`) and an
`OPTIONS` request returns the whole PHP Debugbar HTML payload. Stack traces are never
shown to users (`http.ts` replaces any 5xx body with a generic message), but they should
not be on the wire at all.

---

## 3. Smaller mismatches

| Area | Detail |
|---|---|
| Roles | MedPoint ships full RBAC (`/v1/roles`) but a new signup gets no role. The app assumes `patient` (`mappers.ts#roleOf`). Provider/admin sign-in is not possible against MedPoint. |
| Profile fields | `GET /v1/profile` returns `gender` and `birth`, but `PUT /v1/profile` accepts neither — only `name` and `phone` round-trip. Both *are* writable, just via a second endpoint, `PATCH /v1/users/:id` (`session.ts#updateProfile` sequences the two). There is still no `governorate` or `blood_type` column anywhere; those fields were removed from the account form rather than collected and discarded. |
| Phone format | Stored as E.164 (`+201234567890`); the app validates and displays the local Egyptian form (`01234567890`). Normalised both ways in `mappers.ts#toLocalPhone` / `#toE164Phone` — without it the API's own saved number fails the app's validation. |
| Signup + OTP | The OTP endpoints only serve password reset. `POST /auth/register` returns a live token pair and the account is immediately usable — there is no post-signup OTP screen at all any more (it was mock-only and has been deleted, not just skipped). |
| Date of birth | Called `birth` on the user, `date_of_birth` on a patient profile. |
| Money | Sent as decimal strings (`"449.00"`), not numbers. |
| Dates | Plain dates come back as full timestamps (`"2026-08-01T00:00:00.000000Z"`). |
| Error codes | Laravel sends no machine-readable error code, only prose. `http.ts` derives a stable code from the HTTP status; a business rejection keeps the server's own sentence, so Arabic users see English for those. Stable codes would fix it. |
| Availability | `/v1/slots` and `/v1/doctor-sessions` expose `capacity`/`booked_count`/`max_tickets`, but there is no endpoint to query availability for a provider over a date range, and no hold/expiry concept. The app's capacity + payment-hold rules (§5, §9, Appendix A) are enforced only client-side, with no server backing them. |
| Clock | The app used to anchor "now" to a fixed dataset date (2026-07-13) so a generated dataset would hydrate identically server- and client-side. There is no generated dataset any more, so `@/lib/time#now()` is the real clock — meaning staging slot dates need to be checked against *today*, not against a fixed anchor, when availability looks unexpectedly empty. |

---

## 4. Security note

`storeTokens` keeps the access + refresh token in `localStorage`, because the app is a
client-rendered SPA with no server session. That is readable by any XSS. The better shape
is an httpOnly, `SameSite` refresh cookie set by the API, with a short-lived access token
in memory — which needs 1.1 (CORS with `Allow-Credentials`) first.
