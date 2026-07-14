# MedPoint API — integration gaps

Everything below was verified against the live staging API (`https://medpoint.intrazero.org`)
on 2026-07-14, not inferred from the Postman collection — the collection ships request
shapes only, no example responses.

The app runs a **hybrid backend** (`NEXT_PUBLIC_API_MODE`):
when set to `live`, per-capability routing in `src/lib/api/capabilities.ts` sends each
domain to MedPoint or the mock as appropriate. See `src/lib/api/session.ts` for auth.

## Integration status (frontend, 2026-07-14)

| Capability | Live? | Module | Notes |
|---|---|---|---|
| Auth (login/register/logout/profile) | Yes | `session.ts` → `medpoint/auth`, `medpoint/profile` | Register 500 fallback; refresh unwired |
| Avatar upload/delete | Yes | `session.ts` → `medpoint/profile` | |
| Patient profiles CRUD | Partial | `profiles.ts` → `medpoint/profiles` | List 500s — overlay cache of created ids |
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

---

## 2. Server bugs — endpoints that exist but 500

### 2.1 `POST /v1/auth/register` → 500

```
RuntimeException: Personal access client not found for 'users' user provider.
  vendor/laravel/passport/src/ClientRepository.php:74
```

Passport has no personal-access client configured, so registration creates the user row
and *then* dies issuing the token. **The account does exist afterwards** — logging in
with the same credentials works.

Because a naïve "registration failed" error would strand the user (the account is real,
so they cannot re-register — the email is taken — and they were never told they have an
account), `medpoint/auth.ts#register` falls back to `login()` on a 5xx. A 422 still
surfaces normally. **Delete that fallback once this is fixed.**

Run `php artisan passport:client --personal`.

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

### 2.3 `GET /v1/patient-profiles` → 500

```
ListPatientProfilesTask::{closure}(): Argument #1 ($query) must be of type
  Eloquent\Builder, PatientProfile given
```

`POST /v1/patient-profiles` works and returns a created profile. **Listing them does
not.** Since a booking belongs to a patient profile (§1 of the business rules), and the
booking wizard opens by choosing one, this blocks the booking flow independently of 1.2.

### 2.4 Debug mode is on in staging

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
