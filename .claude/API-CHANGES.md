# MedPoint API — breaking changes

Re-import `docs/MedPoint.postman_collection.json`; the previous
collection is wrong in ways that will not show up as obvious errors.

---

## 1. Registration was broken. It works now.

`POST /v1/auth/register` returned **500** for every call (it tried to mint a token type the
app was never configured for). If you had it "working", you were not hitting this endpoint.

It now returns a real `access_token` **and** `refresh_token`, creates the account's default
patient profile, and assigns the `patient` role.

## 2. Auth responses have a new shape — all three login paths agree

`POST /v1/auth/register`, `/v1/auth/login`, `/v1/auth/phone`, `/v1/auth/google` all return:

```json
{
  "token_type": "Bearer",
  "expires_in": 86400,
  "access_token": "…",
  "refresh_token": "…",
  "is_new_user": true,
  "needs_phone": true,
  "user": { … }
}
```

- **`refresh_token` used to be `""`** on register, phone and Google. It is now real, and
  `POST /v1/auth/refresh-token` works for all of them.
- **`needs_phone`** — `true` until the account has a *verified* phone. A Google signup has no
  phone at all. Gate anything that needs a number on this flag.
- Refresh tokens **rotate**: each one is single-use. Store the new one from every refresh
  response. Replaying a used token now returns **400** (it used to return 500).

## 3. Patient profiles moved

| Old (gone — will 404) | New |
|---|---|
| `GET/POST /v1/patient-profiles` | `GET/POST /v1/me/profiles` |
| `GET/PATCH/DELETE /v1/patient-profiles/{id}` | `GET/PATCH/DELETE /v1/me/profiles/{id}` |

- **`POST /v1/me/profiles` no longer accepts `user_id`.** The owner is the authenticated
  account. Sending one is ignored.
- The account's own **SELF profile is created automatically** at signup and **cannot be
  deleted** (422). Profiles you create are dependants.
- Deletes are **soft**.
- There is a **cap of 10 active profiles** per account (422 beyond that).
- **`national_id` moved** from the user onto the patient profile.

## 4. New endpoints

| Endpoint | Purpose |
|---|---|
| `GET /v1/me` | The account **plus its profiles** — what you want on app start. |
| `POST /v1/auth/logout-all` | Revoke every session for the account. |
| `POST /v1/me/phone` | Change the phone number. Run the Firebase SMS OTP on the **new** number and post the resulting `id_token`. 409 if another account holds it. |
| `POST /v1/me/deactivate` | Account holder switches their account off. Revokes all sessions. |
| `POST /v1/me/delete-request` | Request deletion. Revokes all sessions. The account is **not** hard-deleted. |
| `PATCH /v1/notifications/{id}/read` | Mark your own notification read. |

## 5. 404 now means "not yours", not just "not there" — IMPORTANT

Bookings, payments, refunds, reviews, wallets and patient profiles are scoped to the caller.
Another account's record returns **404, not 403** — deliberately, so the API never confirms
that someone else's record exists.

**Do not treat 404 as "this definitely does not exist."** Treat it as *"not available to you."*

Related: **a request body is never an authorization source.** `user_id`,
`patient_profile_id` and `booking_id` in a body are validated against the caller. Booking for
a profile you do not own, or paying for a booking you do not own, returns 404.

## 6. Endpoints removed

- **Audits:** `POST`/`PATCH`/`DELETE /v1/audits` are gone. Reads are **staff-only**.
- **Notifications:** `POST`/`DELETE /v1/notifications` and the generic `PATCH` are gone.
  Notifications are emitted server-side; you may read your own and mark them read.
- **Duplicate auth paths removed.** Use these, not the old aliases:
  `/v1/auth/register` (not `/v1/register`), `/v1/auth/login` (not `/v1/clients/web/login`),
  `/v1/auth/forgot-password` (not `/v1/forgot-password`), `/v1/profile` (not `/v1/user/profile`).

## 7. Phone numbers are normalised

Send `01012345678` or `+201012345678` — both are stored as **`+201012345678`** (E.164), and
they are the *same* number, so the second one cannot register a second account.

## 8. Password reset (OTP) is enumeration-safe

`POST /v1/auth/forgot-password` returns the **same 200 and the same body** whether or not the
email exists. Do not infer account existence from it. Wrong/expired codes all fail with one
generic message.

---

## Still not implemented — do not build on these

- **No booking state machine.** `status` is a free-form field.
- **No capacity or concurrency checks.** Overbooking is possible.
- **`price_snapshot` is taken from your request**, not derived from the Service.
- **No payment processing.** Payments record intent only, and `status` is still settable on
  *your own* payment/refund. The gateway webhook lands in a later phase.
