# MedPoint API — integration gaps

**This is the ask to the backend team.** The frontend-side companion is
[`INTEGRATION.md`](./INTEGRATION.md) — capability state, workaround registry, and the
ordered path to full-live. Field-level wire↔domain shapes are in
[`API-CONTRACT.md`](./API-CONTRACT.md).

Everything below was **verified against the live staging API**
(`https://medpoint.intrazero.org`) **on 2026-07-14** — not inferred from the Postman
collection, which ships request shapes only and no example responses. `INTEGRATION.md`
carries the `curl` probes to re-check every item here in about a minute; do that before
trusting this file.

The app runs a **hybrid backend** (`NEXT_PUBLIC_API_MODE`):
when set to `live`, per-capability routing in `src/lib/api/capabilities.ts` sends each
domain to MedPoint or the mock as appropriate. See `src/lib/api/session.ts` for auth.

## Integration status (frontend, 2026-07-14)

| Capability | Live? | Module | Notes |
|---|---|---|---|
| Auth (login/register/logout/profile) | Yes | `session.ts` → `medpoint/auth`, `medpoint/profile` | Register now works (delete the fallback); refresh still unwired |
| Avatar upload/delete | Yes | `session.ts` → `medpoint/profile` | |
| Patient profiles CRUD | 🔴 **Broken** | `profiles.ts` → `medpoint/profiles` | **Route 404s entirely** (§2.3) — was: list 500s, overlay cache of created ids |
| Provider discovery | Degraded | `providers.ts` → `medpoint/providers` | Client-side filters; thin Provider payload |
| Availability | Degraded | `providers.ts` → `medpoint/availability` | Slots/sessions filtered client-side |
| Booking write (hold/pay) | Partial | `bookings.ts` → `medpoint/bookings` | Overlay enriches wire booking |
| Booking read/cancel/reschedule | Mock | `bookings.ts` | Merges overlay bookings into lists |
| Favorites | Mock | `engagement.ts` | No API resource |
| Reviews / notifications | Mock | `engagement.ts` | MVP deferred |
| Provider admin / admin / stats | Mock | `provider-admin`, `admin`, `stats` | Out of patient MVP scope |

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
and cancel all stay on the mock until this is fixed.

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
returns the same unfiltered page. Only `page` and `limit` work (`per_page` does not).

`/search` is the app's core discovery surface with twelve filter dimensions
(specialty, governorate, area, gender, rating, price range, availability, …). None of
it can be served. It stays on the mock.

**Ask:** filtering, sorting and full-text search on `/v1/providers` and `/v1/services`.

### 1.5 `Provider` is too thin to render

```json
{ "type": "Provider", "id": "…", "provider_type": "doctor",
  "name": "Dr. Hala Mansour — Cardiology", "status": "active", … }
```

No rating, review count, photo, price, specialty, sub-specialty, governorate/area,
branches, or bio. A `ProviderCard` cannot be built from this, so the home page, search
results and every provider profile stay on the mock. Note also that the specialty is
currently glued into the `name` string rather than being its own field.

### 1.6 No favourites resource

There is no `/v1/favorites` (or equivalent) in the collection or on the server.
`/patient/favorites` — a built, working screen — has nothing to talk to.

### 1.7 `Service` never returns its preparation or eligibility rules

`POST /v1/services` accepts `prep_instructions`, `eligibility_rules` and `home_collection`
— the schema was built for §3 of the business rules. But nothing comes back populated on
the read side, and there are no `chronic_conditions` / `is_pregnant` columns on a patient
profile to screen against even if it did.

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

### 2.4 `POST /v1/payments` may reject the shape — and the app currently swallows it

The most dangerous item in this document, because it is a divergence on the **money path**.

`medpoint/bookings.ts#payBooking` posts `{ booking_id, amount, purpose, gateway }` and then
catches and ignores any failure:

```ts
} catch {
  // Scaffold API may reject payment shape — overlay still confirms locally.
}
overlay.status = "confirmed";
overlay.paymentStatus = "paid";
```

So the patient can be shown a **confirmed, paid booking while the server holds no payment
row at all.** That was an acceptable stopgap while the booking read path was mock anyway;
it stops being acceptable the moment anything real depends on it.

**Ask:** confirm the accepted request shape for `POST /v1/payments` and make it return a
deterministic success or a 4xx we can act on. The frontend then lets the error propagate
and fails the booking honestly rather than confirming a payment that did not happen.

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
| Profile fields | `GET /v1/profile` returns `gender` and `birth`, but `PUT /v1/profile` accepts neither — only `name` and `phone` round-trip. There is no `governorate` or `blood_type` at all. The profile form therefore hides those four fields in live mode (`session.ts#editableProfileFields`) rather than accepting input the server would discard. |
| Phone format | Stored as E.164 (`+201234567890`); the app validates and displays the local Egyptian form (`01234567890`). Normalised both ways in `mappers.ts#toLocalPhone` / `#toE164Phone` — without it the API's own saved number fails the app's validation. |
| Signup + OTP | The OTP endpoints only serve password reset. `POST /auth/register` returns a live token pair and the account is immediately usable, so a live signup skips `/verify` (`session.ts#requiresOtpAfterSignup`). |
| Date of birth | Called `birth` on the user, `date_of_birth` on a patient profile. |
| Money | Sent as decimal strings (`"449.00"`), not numbers. |
| Dates | Plain dates come back as full timestamps (`"2026-08-01T00:00:00.000000Z"`). |
| Error codes | Laravel sends no machine-readable error code, only prose. `http.ts` derives a stable code from the HTTP status; a business rejection keeps the server's own sentence, so Arabic users see English for those. Stable codes would fix it. |
| Availability | `/v1/slots` and `/v1/doctor-sessions` expose `capacity`/`booked_count`/`max_tickets`, but there is no endpoint to query availability for a provider over a date range, and no hold/expiry concept. The mock's capacity + payment-hold rules have no server equivalent. |
| Seed dates | Staging slots are seeded in the past relative to the app's fixed `TODAY` (2026-07-13). |

---

## 4. Security note

`storeTokens` keeps the access + refresh token in `localStorage`, because the app is a
client-rendered SPA with no server session. That is readable by any XSS. The better shape
is an httpOnly, `SameSite` refresh cookie set by the API, with a short-lived access token
in memory — which needs 1.1 (CORS with `Allow-Credentials`) first.
