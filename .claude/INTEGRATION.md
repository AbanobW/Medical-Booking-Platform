# MedPoint integration — START HERE

The state of the frontend↔backend integration, and what it takes to finish it.
Written to be read cold: an agent resuming this work should not need to re-derive
the map from `src/lib/api/`.

**Verified against live staging (`https://medpoint.intrazero.org`), last re-probed 2026-07-14.**
Re-probe before you trust it — see [Verify before you trust](#verify-before-you-trust).

**Companion documents**
- `.claude/Business-Logic-and-Product-Decisions-v2.md` — what the product must do. Product truth.
- `.claude/BACKEND-GAPS.md` — what staging fails to do, phrased as an ask to the backend team.
- `.claude/API-CONTRACT.md` — endpoint catalogue, wire DTOs, and the field-level gap map.
- `vesita-app/CLAUDE.md` — the build contract for the app itself.

---

## ⚠️ Staging moved — read this before anything else

The last re-probe found the backend had shifted under the app. **Two of these are not yet
reflected in the code**, so the code and this table disagree until someone acts.

| What | Was | Is now | Consequence |
|---|---|---|---|
| `POST /v1/auth/register` | 500 (Passport client missing) | ✅ **`201` + a real token pair** | **Workaround #1's trigger has fired. Delete the login-fallback** (`medpoint/auth.ts:66-80`). |
| `/v1/patient-profiles` | `GET` 500s, `POST` works | 🔴 **`404` on `GET` *and* `POST` — the route is gone entirely** | **Regression, and the worst item on this page.** `profiles: true` is now wholly broken, not partially. A booking needs a `patient_profile_id` (§1), so **the live booking flow is dead**, not degraded. |
| `GET /v1/services` | unknown | `prep_instructions: null`, **`eligibility_rules` absent from the payload entirely** | The §3 gate is **not** a cheap frontend fix after all — the data genuinely is not on the wire. |

Still exactly as documented: no CORS headers, `refresh-token` 500s, hashids collide across
*every* resource (`providers`, `services`, `slots` and `doctor-sessions` all return
`W6V1Y2Pn83Q7mDEK` as their first id), list filters are ignored (`?provider_type=lab` and
unfiltered return byte-identical payloads), and `Provider` is still
`{type, id, provider_type, name, status}` with the specialty glued into the name string.

Not re-verified: the `Booking` payload's missing FKs. `GET /v1/bookings` is scoped to the
caller and a fresh probe account has none, so the list came back empty. `meta.include` was
still `[]`. Treat §1.2 as unchanged until someone probes it with a seeded account.

---

## The one-paragraph summary

The **writes line up with the spec; the reads do not.** MedPoint's schema was clearly
designed against the business doc — `POST /v1/bookings` takes `patient_profile_id`,
`branch_id`, a polymorphic `bookable_type`/`bookable_id` and `price_snapshot`;
`doctor-sessions` carries `max_tickets` and `capacity_type`; `services` carries
`prep_instructions`, `eligibility_rules` and `home_collection`. Every concept the
platform needs exists in the request bodies. The failure is entirely on the response
side: **`GET` drops every relation and the appointment datetime**, list endpoints ignore
every filter, and the `Provider` payload is too thin to render a card. So the app writes
to MedPoint and reads from a local overlay plus a seeded mock. Fixing this is a small,
local backend change — not a redesign.

---

## Orientation

App root is **`vesita-app/`**. The integration layer is `vesita-app/src/lib/api/`.

Two backends coexist:

- **The mock** — a seeded localStorage dataset (`src/lib/data/seed.ts` + `client.ts`).
  56 doctors, 22 labs, 22 radiology centres, 620 bookings. Fully implements the business
  rules, including capacity, holds and the 9-state machine.
- **MedPoint** — the real Laravel API, reached through `src/lib/api/medpoint/*`.

Routing is decided by **two AND-ed gates**:

1. The global mode. `NEXT_PUBLIC_API_MODE` is read in exactly one place —
   `src/lib/api/config.ts:19-21`:
   ```ts
   /** `NEXT_PUBLIC_*` is inlined at build time, so this must not be destructured. */
   function readMode(): ApiMode {
     return process.env.NEXT_PUBLIC_API_MODE === "live" ? "live" : "mock";
   }
   ```
   **Only `"live"` and `"mock"` are accepted, and anything else silently becomes `mock`.**
   There is no validation and no warning. `"LIVE"`, a trailing space, or a typo costs you
   an hour of wondering why nothing hits the network. Current state: `.env.local` is
   `live`, `.env.example` is `mock`.
2. The per-capability flag in `src/lib/api/capabilities.ts`.

A capability is live only when **both** are true. In mock mode nothing is ever live.
Live mode *widens* what is real — it never takes a screen away; anything MedPoint cannot
serve falls back to the mock rather than going blank.

The browser never talks to MedPoint directly. `apiBaseUrl()` is the relative constant
`/api/medpoint` (`config.ts:43-47`), and `next.config.ts:41-48` rewrites that upstream
server-to-server. See workaround #2.

---

## Capability state

Verbatim from `src/lib/api/capabilities.ts:30-46`:

```ts
const LIVE_CAPABILITIES: Record<LiveCapability, boolean> = {
  auth: true,
  /** `GET /v1/patient-profiles` 500s — list uses overlay cache; CRUD is live. */
  profiles: true,
  /** Thin Provider payload; filters run client-side on fetched pages. */
  discovery: true,
  /** Slots + doctor-sessions fetched and filtered client-side. */
  availability: true,
  /** `POST /bookings` + `POST /payments`; enriched via overlay. */
  bookingWrite: true,
  /** Booking responses lack FKs and appointment datetime — read stays mock. */
  bookingRead: false,
  /** No `/v1/favorites` resource on MedPoint. */
  favorites: false,
  reviews: false,
  notifications: false,
};
```

| Capability | Live | Dispatcher | Live module | Why it's where it is | Flip it when |
|---|---|---|---|---|---|
| `auth` | ✅ | `session.ts` | `medpoint/auth.ts`, `medpoint/profile.ts` | Login/logout/profile/avatar all work | — (already live) |
| `profiles` | 🔴 **broken** | `profiles.ts` | `medpoint/profiles.ts` | Was: CRUD live, list 500s → reconstructed from overlay-cached ids. **Now: the whole `/v1/patient-profiles` route 404s.** The flag still says `true`, so live mode calls a route that no longer exists | the route comes back |
| `discovery` | ✅ | `providers.ts` | `medpoint/providers.ts` | Degraded: fetches *all* providers + branches + services, assembles them, filters in the browser | server-side filter/sort/search lands |
| `availability` | ✅ | `providers.ts` | `medpoint/availability.ts` | Degraded: fetches *all* slots + doctor-sessions, filters client-side against `TODAY` | a per-provider date-range availability endpoint lands |
| `bookingWrite` | ✅ | `bookings.ts` | `medpoint/bookings.ts` | `POST /bookings` + `POST /payments`; every created booking is enriched from wizard context into the overlay | — (live, but see workaround #6) |
| `bookingRead` | ❌ | `bookings.ts` | — | **The keystone gap.** Wire `Booking` has no FKs and no appointment datetime, so a booking cannot be rendered | `Booking` carries relations + datetime |
| `favorites` | ❌ | `engagement.ts` | — | No `/v1/favorites` resource exists at all | the resource ships |
| `reviews` | ❌ | `engagement.ts` | — | Deferred; `/v1/reviews` exists but is unwired | MVP scope allows |
| `notifications` | ❌ | `engagement.ts` | — | Deferred; `/v1/notifications` exists but is unwired | MVP scope allows |

### Two traps in this table

**`bookingRead` is declared but never consulted.** Grep it: the flag appears in the type
and the record, and nowhere else. Booking *reads* actually go through the mock plus an
overlay merge, gated on `bookingWrite` (`bookings.ts` `mergeOverlayIntoPage`). Flipping
`bookingRead` to `true` today would change nothing. When the backend is fixed, you must
wire the flag up as well as flip it.

**`stats.ts`, `admin.ts` and `provider-admin.ts` have no capability check at all.** They
are unconditionally mock in both modes. That is correct for the patient MVP — provider
and admin portals are out of scope — but do not mistake their silence for "live".
Relatedly, `roleOf()` hard-codes `"patient"` (workaround #11), so a provider or admin
cannot sign in against MedPoint anyway.

---

## Workaround registry

Every hack currently standing between the app and the API. Each one exists for a reason,
and each one has an exact removal trigger. **Do not delete one without checking its
trigger has actually fired.**

| # | Workaround | Location | Delete when |
|---|---|---|---|
| 1 | ✅ **TRIGGER FIRED — DELETE THIS.** register-500 → `login()` fallback. `POST /auth/register` used to 500 (no Passport personal-access client) while still creating the user row, stranding the user with a real account they were never told about — so a 5xx fell back to logging in with the credentials just submitted. **Register now returns `201` with a token pair.** The fallback is dead code that would mask a genuine future 5xx. Remove the `catch` at `:73-80`, keep the 422 path. | `medpoint/auth.ts:45-81` | ~~register returns a token pair~~ **done — go delete it** |
| 2 | **CORS rewrite proxy.** MedPoint sends no `Access-Control-Allow-*` header on any response, so a browser discards every cross-origin call. `/api/medpoint/*` is rewritten upstream by Next, server-to-server, where CORS does not apply. Costs a hop; the API is only reachable through our own origin. | `next.config.ts:41-48`, `config.ts:32-47` | the API sends CORS headers for the web origins |
| 3 | **`refreshSession()` is written but never called.** `POST /auth/refresh-token` 500s (it type-hints the framework's base `Request`). The function exists so that the moment the endpoint works, there is exactly one place to believe. Consequence today: **a session dies hard 24h after sign-in** — the 401 clears the token and bounces the user to `/login`. | `medpoint/auth.ts:100-122` (defined, zero call sites) | refresh-token stops 500ing — then wire it into a 401-retry interceptor in `http.ts:169-177` |
| 4 | 🔴 **NOW WORSE THAN THE WORKAROUND.** Patient-profile list is N fan-out `GET`s: `GET /patient-profiles` 500'd, so `getPatientProfiles` reads ids from the overlay and fetches each one by id, un-caching any that 404s (so profiles created in another browser are invisible). **But the entire route now 404s on every verb** — the by-id fetches this workaround depends on fail too, and every id gets silently un-cached. Live profile CRUD is dead, which kills the live booking flow with it. | `medpoint/profiles.ts:29-51` | the route exists again *and* `GET /v1/patient-profiles` lists |
| 5 | **The entire overlay cache.** localStorage store (`vesita:medpoint:overlay:v1`) holding profile ids and the full wizard context of every booking — provider name/photo/specialty, service, branch, date, time, pricing, acknowledgement — because `GET /bookings` returns none of it. `overlayToBooking()` reconstitutes a domain `Booking` from it. | `medpoint/overlay.ts` (whole file) | wire `Booking` carries FKs + appointment datetime |
| 6 | ⚠️ **A failed `POST /payments` is swallowed and the booking is confirmed locally anyway.** `catch { /* Scaffold API may reject payment shape — overlay still confirms locally. */ }`. The patient sees a confirmed, paid booking while the server has **no payment row**. This is the highest-risk hack in the codebase — it is a live divergence on the money path. Treat removing it as urgent. | `medpoint/bookings.ts:209-221` | `POST /v1/payments` accepts the shape; then let the error propagate and fail the booking |
| 7 | **Hashids collide across models.** `Provider` row 1, `Service` row 1 and `Booking` row 1 all encode to the *same* string — the salt is not per-model. An id is meaningful **only together with its type**. Never use a bare id as a cross-resource cache key, a React key on a mixed collection, or a URL slug. Use `wireKey(type, id)`. | `medpoint/types.ts:14-31`, `:144-147` | ids are salted per model, or globally unique |
| 8 | **Tokens in `localStorage`** (`vesita:medpoint:access:v1` / `…:refresh:v1`). Readable by any XSS. Accepted deliberately: the app is a client-rendered SPA with no server session. The right shape is an httpOnly `SameSite` refresh cookie plus a short-lived in-memory access token. | `tokens.ts:1-16` | an httpOnly refresh cookie ships — **needs #2 (CORS + `Allow-Credentials`) first** |
| 9 | **Discovery and availability fetch every page and filter in the browser.** `loadCatalog()` pulls all `/providers` + `/branches` + `/services` (60s in-memory TTL) and `searchProviders` applies all twelve filter dimensions client-side. Availability pulls all `/slots` + `/doctor-sessions`. Correct today; will not survive a real dataset. | `medpoint/providers.ts:51-96`, `:146-211`; `medpoint/availability.ts:18-34` | server-side filtering, sorting and search land |
| 10 | **`PUT /profile` silently drops unknown fields**, so the profile form hides four of them in live mode. `GET /profile` returns `gender` and `birth`, but `PUT` accepts neither; `governorate` and `blood_type` have no column at all. Unsaveable fields are deliberately **not** merged into the returned user — that would look like a save and then vanish on reload. | `medpoint/profile.ts:19-31`, `session.ts:106-110` | `PUT /profile` accepts `gender` + `birth`, and `governorate`/`blood_type` columns exist |
| 11 | **`roleOf()` hard-codes `"patient"`.** MedPoint ships full RBAC (`/v1/roles`, `/v1/permissions`) but a new signup gets no role and `WireUser` carries none. **Provider and admin sign-in are impossible in live mode.** | `medpoint/mappers.ts:68-70` | a role appears on the user payload |

---

## Business rules the live path currently violates

The join nobody had written down. Each row is a rule from the business doc that the
**mock honours and live mode does not** — because the wire cannot carry it.

### §3 — the mandatory preparation/eligibility gate is empty in live mode

The rule: *"A booking cannot be finalized until the patient has confirmed they have read
the preparation instructions and that the selected patient profile meets the eligibility
rules."* `holdBooking` in the mock enforces it — it rejects a booking with no
acknowledgement, or whose profile fails `evaluateEligibility`.

In live mode there is nothing to acknowledge. `wireServiceToLabTest`
(`mappers.ts:194-215`) and `wireServiceToScan` (`:217-238`) **synthesize empty blocks**:

```ts
preparation: {
  fastingRequired: false,
  waterAllowed: true,
  medicationRestrictions: [],
  arrivalInstructions: emptyLocalized(""),
  documentsRequired: [],
},
eligibility: { pregnancySafe: true, excludedConditions: [] },
```

Compounding it, `toPatientProfile` (`:100-113`) hard-codes `chronicConditions: []` and
`isPregnant: false` because MedPoint has no such columns — so even a real eligibility
rule would have nothing to screen against.

**Probed, and it is a backend fix, not a mapper fix.** `WireService` declares
`prep_instructions` and `eligibility_rules` (`medpoint/types.ts:86-95`) and `POST
/v1/services` accepts both — but a live `GET /v1/services` returns
`"prep_instructions": null` and **omits `eligibility_rules` from the payload entirely**:

```json
{ "type": "Service", "id": "W6V1Y2Pn83Q7mDEK", "name": "Initial Consultation",
  "category": "consultation", "price": "449.00", "prep_instructions": null,
  "home_collection": false, … }
```

So the data genuinely is not on the wire, and no mapper change can conjure it. This is a
*safety* rule — a patient who ate before a fasting test, or who is ineligible for a scan —
so it needs a real ask: populate both fields on read, and add `chronic_conditions` /
`is_pregnant` to the patient profile so there is something to screen against.

### §5, §9, Appendix A — capacity and holds are client-side fiction in live mode

There is **no server hold or expiry concept at all**. The 10-minute payment window is
enforced entirely in the browser: `beginPayment` and `releaseHold`
(`medpoint/bookings.ts:159-171`, `:231-237`) do **no HTTP** — they mutate the overlay.
Appendix A's guarantee that "exactly one succeeds" when two patients race for the last
place has no server enforcement behind it in live mode.

There is also a **vocabulary mismatch**: the domain says `CapacityType = "comfort" |
"strict"` (`types.ts:509`); the wire sends `capacity_type: "soft"`.
`capacityTypeOf` (`mappers.ts:358-360`) maps anything that isn't `"strict"` to
`"comfort"`, so `"soft"` lands correctly by accident. Pin the vocabulary down with the
backend rather than relying on that.

Note also `slotToTimeSlot` (`:398-412`) hard-codes `"strict"` for lab/radiology slots —
correct per §5, but it is an assumption, not something the wire tells us.

### §1 — profile isolation holds, eligibility screening does not

The account→profile ownership boundary is correctly enforced: `fetchProfile`
(`medpoint/profiles.ts:20-27`) 404s if `wire.user_id` doesn't match the account, and
`createPatientProfile` blocks a second `self` profile client-side. Good.

But the clinical fields the profile exists to carry (`chronicConditions`, `isPregnant`)
are hard-coded empty, so the profile cannot do the one job §3 gives it.

### Location data is confidently wrong rather than absent

`governorateIdOf` and `areaIdOf` (`mappers.ts:115-132`) fuzzy-match the wire's free-text
governorate/area against `GOVERNORATES` and **default to `"cairo"` / `"nasr-city"` on a
miss**. A provider in Alexandria with an unrecognised spelling is silently shown in
Cairo. A wrong location is worse than an unknown one — this needs either a controlled
vocabulary on the backend or an explicit "unknown" branch in the mapper.

### Everything a live `Provider` shows is invented

`baseProviderFields` (`mappers.ts:246-275`) and `toProvider` (`:277-348`) hard-code
`rating: 0`, `reviewCount: 0`, `bookingCount: 0`, `waitingTimeMinutes: 30`,
`isFeatured: false`, and for a doctor: `title: "Dr."`, `specialtyId: "general"`,
`gender: "male"`, `yearsOfExperience: 0`. The specialty is currently glued into the
provider's `name` string on the wire ("Dr. Hala Mansour — Cardiology") rather than being
its own field. So live-mode search-by-specialty and filter-by-gender match against
constants — they cannot work.

---

## Path to full-live

Ordered by *unblocks-the-most-per-unit-of-backend-work*. Each step names the backend
prerequisite, the flag to flip, and the workaround it retires.

0. 🔴 **Restore the `/v1/patient-profiles` route.** *Do this before anything else — it is a
   regression, not a gap.* Every verb 404s. A booking belongs to a patient profile (§1) and
   the wizard opens by choosing one, so **the live booking flow cannot run at all** until
   the route is back. Everything below is moot while this is broken. (Then also fix the
   original `ListPatientProfilesTask` list bug — its closure type-hints `PatientProfile`
   where it means `Eloquent\Builder` — which retires workaround #4.)

0b. ✅ **Delete the register fallback** (`medpoint/auth.ts:73-80`). Frontend-only, no
   backend work needed: register already returns `201` + a token pair. Free.

1. **CORS headers** → retires workaround #2 (delete the `next.config.ts` rewrite and point
   `apiBaseUrl()` at the upstream). Also a hard prerequisite for #8 (httpOnly cookies).
   Cheapest remaining backend change; unblocks the security story.

2. 🔑 **Give `Booking` its relations and its appointment datetime.** *The keystone.*
   Either make `?include=provider|service|branch|slot` actually work (it is accepted with
   a 200 today but changes nothing, and `meta.include` is always `[]`), or at minimum
   expose `provider_id`, `service_id`, `branch_id`, `patient_profile_id`, `slot_id` and
   the appointment date/time.
   → flip `bookingRead: true` **and wire the flag up** (it is currently never consulted)
   → **retire the whole overlay** (workaround #5)
   → `/patient/bookings`, the patient dashboard, cancel and reschedule all come off the mock.
   This one change is worth more than the rest of the list combined.

3. **Make `POST /v1/payments` accept the shape** → **delete workaround #6**, the swallowed
   payment failure. Do this *early* despite its position — it is a correctness bug on the
   money path, not a feature gap. Until it lands, a booking can read as paid while the
   server has no payment row.

4. **Populate `prep_instructions` / `eligibility_rules` on `GET /v1/services`** (today the
   first is `null` and the second is absent from the payload), and add `chronic_conditions`
   / `is_pregnant` to the patient profile → restores the §3 acknowledgement gate. A safety
   rule, not a feature.

5. **Fatten `Provider`** (rating, review count, photo, price, specialty as its own field,
   sub-specialty, governorate/area, gender, bio) **and add server-side filtering, sorting
   and full-text search** to `/v1/providers` and `/v1/services` — today `provider_type=`,
   `search=`, `q=` and `filter=` are all silently ignored, and only `page`/`limit` work
   (`per_page` does not). → retires workaround #9 and makes `/search`'s twelve filter
   dimensions real.

6. **Ship a `/v1/favorites` resource** → flip `favorites: true`; `/patient/favorites` is a
   built, working screen with nothing to talk to.

7. **Fix `POST /v1/auth/refresh-token`** → wire `refreshSession()` into a 401-retry in
   `http.ts` → retires workaround #3 and stops sessions dying at 24h.

8. **Salt hashids per model** → retires workaround #7 and the `wireKey` discipline.

9. **Turn off debug mode in staging.** Responses currently carry full PHP stack traces and
   file paths (`/var/www/MedPoint/…`); an `OPTIONS` request returns the whole PHP Debugbar
   HTML payload. `http.ts:84-88` already replaces any 5xx body with a generic message, so
   users never see them — but they should not be on the wire.

10. **Emit machine-readable error codes.** Laravel sends prose only, so `codeForStatus`
    (`http.ts:60-68`) derives a code from the HTTP status and a business rejection keeps
    the server's English sentence. **Arabic users therefore see English** for exactly the
    errors that matter most. Stable codes fix it.

**Two of these need no backend work at all** and are available right now: 0b (delete the
register fallback) and, once #0 is unblocked, wiring `bookingRead` up so the flag it
declares actually does something.

---

## Verify before you trust

This document was true on **2026-07-14**. Before acting on it, re-probe — a fixed gap is
immediately available work, and a stale doc is worse than none.

```bash
# 1.1 — CORS. Expect: no output (no Access-Control-* header at all).
curl -sI -X POST https://medpoint.intrazero.org/v1/auth/login \
  -H 'Origin: http://localhost:3000' -H 'Content-Type: application/json' \
  -d '{"email":"x@y.z","password":"nope"}' | grep -i access-control

# 2.1 — register. Expect: 201 + a token pair (FIXED — was a 500). If it regresses to
#        "Personal access client not found", the login-fallback is needed again.
curl -s -X POST https://medpoint.intrazero.org/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"full_name":"Probe","email":"probe+'"$(date +%s)"'@example.com","password":"password","phone":"+201234567890"}' \
  | head -c 300

# 2.2 — refresh-token. Expect: 500, "RefreshToken::createFrom(): Argument #1".
curl -s -X POST https://medpoint.intrazero.org/v1/auth/refresh-token \
  -H 'Content-Type: application/json' -d '{}' | head -c 300

# The rest need a bearer token:
TOKEN=...   # from POST /v1/auth/login

# 2.3 — patient-profiles. Expect: 404 "The route ... could not be found" on EVERY verb.
#        A 500 ("ListPatientProfilesTask::{closure}") would actually be progress — it
#        would mean the route is back and only the list query is broken.
for m in GET POST; do
  printf '%-5s ' "$m"
  curl -s -o /dev/null -w 'HTTP %{http_code}\n' -X $m -H 'Accept: application/json' \
    -H "Authorization: Bearer $TOKEN" https://medpoint.intrazero.org/v1/patient-profiles
done

# 1.2 — Booking payload. Expect: no *_id fields, no date/time. THE keystone check.
curl -s 'https://medpoint.intrazero.org/v1/bookings?include=provider,service,branch,slot' \
  -H "Authorization: Bearer $TOKEN" | head -c 600

# 1.3 — hashid collision. Expect: the three lists share their first ids.
for r in providers services bookings; do
  echo -n "$r: "
  curl -s "https://medpoint.intrazero.org/v1/$r" -H "Authorization: Bearer $TOKEN" \
    | grep -o '"id":"[^"]*"' | head -3 | tr '\n' ' '
  echo
done

# 1.4 — filters ignored. Expect: identical payloads.
curl -s 'https://medpoint.intrazero.org/v1/providers?provider_type=lab' -H "Authorization: Bearer $TOKEN" | md5
curl -s 'https://medpoint.intrazero.org/v1/providers'                   -H "Authorization: Bearer $TOKEN" | md5

# §3 check — does GET /services return prep_instructions populated? If yes, cheap win.
curl -s https://medpoint.intrazero.org/v1/services -H "Authorization: Bearer $TOKEN" | head -c 600
```

One more, worth knowing: **staging's seed data is dated in the past** relative to the
app's fixed `TODAY` (2026-07-13, `src/lib/data/seed.ts` — used instead of `new Date()` so
server and client hydration agree). Live availability can therefore look empty for
reasons that have nothing to do with the code.
