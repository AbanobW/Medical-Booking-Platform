# Business Logic & Product Decisions
## Medical Booking Platform — Doctors, Labs & Radiology

**Version:** 2.0 — Enhanced Architecture Baseline `[UPDATED]`
**Prepared by:** Product Management · Architecture review by Principal Product Architect `[UPDATED]`
**Audience:** Product, Backend, Frontend, QA, DevOps `[UPDATED]`
**Status:** Approved decisions — source of truth for build, design, test, and operations `[UPDATED]`

---

### Purpose

This document defines how the platform behaves and why. It is the shared reference across Product, Backend, Frontend, QA, and DevOps: it explains each module's business logic and records the decisions taken where more than one behavior was possible. `[UPDATED]` Every screen, state, message, test case, and service the teams build should trace back to a rule here. Where a decision belongs to the business rather than the product (a fee amount, a percentage), it is marked clearly near the end. Newly added and modified content in this version is tagged with `[NEW]` and `[UPDATED]` so the team can see what changed against the approved first version.

---

## 1. Accounts & Patient Identity `[UPDATED]`

Access to the platform is tied to a phone number, verified by a one-time code. A single account can hold several **patient profiles** — the account owner plus family members — because booking on behalf of relatives is a normal, everyday need for our users. When a booking is made, it is made *for a specific patient profile*, not just "the account."

`[NEW]` **Domain model.** The relationship is formalized as follows:

```
Account
  └── Patient Profile (Self)
  └── Patient Profile (Child)
  └── Patient Profile (Spouse)
  └── Patient Profile (Parent)
```

`[NEW]` The rules that govern this model are explicit:

- An **Account owns** its Patient Profiles.
- A **Booking belongs to a Patient Profile**, never to the Account directly.
- **Medical history and booking history attach to the Patient Profile**, not to the Account. A father's records live on the "father" profile, so they stay coherent regardless of who booked.
- **Patient Profiles remain isolated** even when another account uses the same phone number or the same personal information. Two accounts that appear to describe the same real person are still two separate records, and their profiles are never merged or cross-linked.

A deliberate decision governs identity: patient profiles are private to the account that created them and are never automatically linked to any other account, even when a name or phone number appears to match. This protects privacy — we never expose one person's medical bookings to another account — and avoids a class of confusing, error-prone merging behavior. A booking is only ever visible to the account that made it.

Reused or shared phone numbers are handled as individual support cases rather than through automated reconciliation. This is a rare and low-impact situation, and attempting to detect it automatically would create more risk than it removes.

---

## 2. Providers, Branches & Onboarding `[UPDATED]`

The platform lists three kinds of providers — doctors, laboratories, and radiology centers — and treats them as genuinely different, because they operate differently. A doctor is booked for a visit; a lab or radiology center is booked for a specific test or scan. The product respects that difference throughout rather than forcing all three into one shape.

`[NEW]` **Branch as a first-class entity.** Providers are not single locations. A provider operates through one or more **branches**, and everything a patient interacts with hangs off the branch:

```
Provider
  └── Branch
        └── Services
        └── Schedules
        └── Bookings
```

`[NEW]` This reflects how the market actually works:

- A **doctor** may operate in a single clinic or across **multiple clinics**, and is bookable at each.
- A **laboratory** typically has **many branches**.
- A **radiology center** typically has **many branches**.

`[NEW]` Because branches are independent operating units, the following are defined **per branch**, not per provider:

- **Branch-specific schedules** — each branch keeps its own working hours, sessions, and slots.
- **Branch-specific services** — a service offered at one branch may not exist at another.
- **Branch-specific pricing** — the same service or consultation may cost differently by branch.
- **Branch-specific availability** — availability is always resolved at the branch level.

This structure future-proofs the platform for large provider networks and chains without reshaping the model later.

**Onboarding.** For launch, providers, their branches, and their services are added and maintained by the platform's operations team, not by the providers themselves. Each provider is verified during onboarding — for doctors, this includes confirming their registration with the medical syndicate — and only approved providers appear to patients. This keeps quality and trust high from day one and means providers do not need to be technically capable to be listed.

`[NEW]` **Provider management roadmap.** How providers are managed evolves in three phases:

- **Phase 1 — Operations-managed.** The platform's operations team creates and maintains all provider, branch, service, and schedule data.
- **Phase 2 — Provider self-service portal.** Providers gain a portal to manage their own listing, services, pricing, and schedules.
- **Phase 3 — Network management.** Multi-branch management, staff roles and permissions, provider-facing analytics, and full schedule management for chains and large networks.

---

## 3. Laboratory & Radiology Services `[NEW]`

Laboratory tests and radiology scans carry requirements that a normal doctor visit does not, and the platform models these explicitly so patients arrive prepared and eligible.

**Preparation instructions.** A service may specify how the patient must prepare, including:

- **Fasting required** (and for how long).
- **Water allowed** or not allowed during fasting.
- **Medication restrictions** — medicines to pause or continue before the test.
- **Arrival instructions** — when to arrive, what to bring, documents or prior results needed.

**Eligibility rules.** A service may restrict who can book it, including:

- **Gender restrictions.**
- **Age restrictions** (minimum and/or maximum age).
- **Pregnancy restrictions** — services unsafe or not permitted during pregnancy.
- **Special conditions** — any additional medical condition that makes a service inappropriate.

**Acknowledgement is mandatory.** Where a service carries preparation instructions or eligibility rules, the booking flow must **display them clearly and require the patient to acknowledge them before the booking can be completed**. A booking cannot be finalized until the patient has confirmed they have read the preparation instructions and that the selected patient profile meets the eligibility rules. This prevents wasted visits — a patient who ate before a fasting test, or who is ineligible for a scan — and protects both the patient and the provider's schedule.

---

## 4. Search & Discovery `[UPDATED]`

Patients find providers through a rich set of filters and sorts, resolved down to the branch level.

`[UPDATED]` **Search filters:**

- **Provider Type** (doctor, laboratory, radiology).
- **Specialty.**
- **Subspecialty** `[NEW]`.
- **Governorate.**
- **Area.**
- **Price Range.**
- **Rating.**
- **Available Today.**
- **Gender** (of the doctor).
- **Insurance** `[NEW]` — future filter, activated when insurance support ships (see Section 14).

`[UPDATED]` **Sorting:**

- **Rating.**
- **Price.**
- **Distance.**
- **Earliest Availability.**

**Accuracy of availability.** Availability behaves in three layers of increasing certainty, and every team should treat them accordingly:

- **Search availability is approximate** — a fast, near-real-time hint. "Available today" in results is an optimistic label.
- **Provider profile availability is live** — the profile page reflects genuine current availability at the branch.
- **Booking confirmation is authoritative** — the moment of booking is the only guaranteed source of truth.

When search and reality differ, the patient never sees an error; they open the profile and simply see the true availability, for example "no places today, here is tomorrow." Design should rely on the profile page for accuracy, not on the search label.

---

## 5. Availability & Scheduling `[UPDATED]`

Doctors and facilities are scheduled differently, reflecting how they actually work in Egypt, and `[UPDATED]` all scheduling is resolved **per branch** (see Section 2).

Doctors run **sessions** — for example an evening clinic — and a patient booking a session receives a **queue number** and an **estimated time**, rather than an exact appointment minute. This matches the real clinic experience and sets honest expectations.

Laboratories and radiology centers run on **time slots**, closer to fixed appointments, because that is how sample collection and scans are organized.

Each session or service carries a capacity. By default this capacity is a **comfort limit** rather than a hard wall: a doctor can usually see one more patient — it simply means a longer evening. Where a limit is genuinely physical (for instance, the number of scans a machine can perform in a session), the provider's listing is configured with a **strict** capacity that cannot be exceeded. Section 6 describes what each behavior means for the patient trying to book the last place, and Appendix A describes how the platform protects capacity under concurrent demand.

---

## 6. Booking

The booking flow is: choose which patient the booking is for, choose a branch, choose a session or slot, confirm the details, pay the booking fee where one applies, and receive confirmation showing the queue number or slot time. `[UPDATED]` For laboratory and radiology services, the preparation and eligibility acknowledgement defined in Section 3 must be completed before the booking can be finalized.

When two patients try to secure the last available place at the same instant, the platform guarantees that only one of them succeeds — a place is never handed to two people. The experience for the second patient depends on the capacity type. Under a comfort limit, they are not rejected; they are told the session is busy and offered the next place with a longer expected wait, and they decide. Under a strict limit, they are told the session is full and offered the next available session or slot instead. In both cases the patient always sees a clear outcome and a next step, never a failure. The system behavior that guarantees this is described in Appendix A.

The price a patient sees at the moment of booking is the price they will pay. If a provider changes their price afterwards, the change applies only to future bookings; existing bookings are honored at the price agreed. Should a provider reduce their price after a booking is made, the platform does not automatically apply the lower price — this is rare and low-value, and can be handled by support as a goodwill gesture if a patient raises it. This protects patients from any sense of a price changing under them, which is essential to trust in the platform.

The states a booking moves through, and the events that move it between them, are defined formally in Section 7.

---

## 7. Booking Lifecycle & States `[NEW]`

A booking progresses through a defined set of states. The interface, the backend, and QA should all treat these as the single vocabulary for a booking's status.

**HELD** — A place has been reserved for the patient while they complete the booking, but the booking is not yet final. *Triggering event:* the patient selects a session or slot and begins confirming. *Allowed transitions:* to `AWAITING_PAYMENT` if an online fee applies, to `CONFIRMED` if no fee applies, or the hold is released (the booking is discarded) on timeout or abandonment.

**AWAITING_PAYMENT** — The place is held and the platform is waiting for the online booking fee to be paid. *Triggering event:* a fee applies and the patient proceeds to payment. *Allowed transitions:* to `CONFIRMED` on successful payment, or the hold is released (the booking is discarded) on payment failure or timeout. See Section 9 for the holding window.

**CONFIRMED** — The booking is secured and the patient is expected. *Triggering event:* payment succeeds, or the booking is placed where no fee applies. *Allowed transitions:* to `COMPLETED`, `NO_SHOW`, `CANCELLED_BY_PATIENT`, or `CANCELLED_BY_PROVIDER`.

**COMPLETED** — The visit took place. *Triggering event:* provider staff mark the visit complete after it happens. *Allowed transitions:* terminal (a review becomes possible from here).

**NO_SHOW** — The patient did not arrive. *Triggering event:* provider staff record a missed visit, only after the session has ended (see Section 8). *Allowed transitions:* terminal.

**CANCELLED_BY_PATIENT** — The patient cancelled their own booking. *Triggering event:* the patient cancels. *Allowed transitions:* to `REFUND_PENDING` when a refund is due under policy; otherwise terminal.

**CANCELLED_BY_PROVIDER** — The provider cancelled the booking or the session. *Triggering event:* provider staff or operations cancel. *Allowed transitions:* to `REFUND_PENDING` whenever a fee was paid; otherwise terminal.

**REFUND_PENDING** — A refund is owed and in progress. *Triggering event:* a cancellation that qualifies for a refund. *Allowed transitions:* to `REFUNDED`.

**REFUNDED** — The refund has been returned to the patient. *Triggering event:* the refund completes. *Allowed transitions:* terminal.

**Transition diagram:**

```
                 (no fee)
        ┌──────────────────────────────┐
        │                              ▼
  ┌─────────┐   fee    ┌──────────────────┐  paid   ┌───────────┐
  │  HELD   ├────────▶ │ AWAITING_PAYMENT ├───────▶ │ CONFIRMED │
  └────┬────┘          └────────┬─────────┘         └─────┬─────┘
       │  timeout /             │ fail / timeout          │
       │  abandon               │                         │
       ▼                        ▼                         │
   (released)              (released)                      │
                                                          │
        ┌───────────────┬───────────────┬─────────────────┤
        ▼               ▼               ▼                 ▼
   ┌─────────┐   ┌──────────┐   ┌──────────────────┐  ┌───────────────────┐
   │COMPLETED│   │ NO_SHOW  │   │CANCELLED_BY_      │  │CANCELLED_BY_      │
   └─────────┘   └──────────┘   │PATIENT            │  │PROVIDER           │
                                └────────┬─────────┘  └─────────┬─────────┘
                                         │ refund due           │ fee paid
                                         ▼                      ▼
                                   ┌───────────────┐    ┌───────────────┐
                                   │ REFUND_PENDING│◀───┤ REFUND_PENDING│
                                   └──────┬────────┘    └───────────────┘
                                          ▼
                                     ┌──────────┐
                                     │ REFUNDED │
                                     └──────────┘
```

A booking is only ever in exactly one state, and only the transitions above are permitted.

---

## 8. Cancellations, Missed Visits & Provider Cancellations

Patients may cancel their own bookings. A free-cancellation window applies before the session or slot; cancelling within that window carries no penalty, while cancelling very late is treated like a missed visit once fees are in effect.

A missed visit is defined strictly as *the patient did not arrive*. A patient who arrived and then left after a long wait is never treated as having missed their visit. Only provider staff can record a missed visit, and only after the session has ended — this prevents the record from being misused. Separately, a patient who arrived but left after waiting can indicate this, and rather than counting against the patient, it feeds into the provider's waiting-time reputation, where the responsibility actually lies. This turns our most sensitive situation into a quality signal about the provider.

Until online fees are introduced, a missed visit is only recorded as a signal and carries no penalty, because we will not act punitively on information we cannot yet fully trust. A patient's first missed visit is always treated leniently.

When a provider cancels an entire session — for example, a doctor who falls ill — every affected booking is cancelled on the provider's behalf, and each patient is notified immediately with a simple way to rebook. Any fee already paid is refunded in full automatically, and the platform absorbs the cost of that refund; a patient is never left out of pocket for something the provider caused. Patients are not silently moved to another session, because that would overload the next session and confuse people about their new time — rebooking is always the patient's choice. Provider-initiated cancellations are tracked and affect the provider's standing on the platform.

---

## 9. Booking Fees, Payments & Refunds `[UPDATED]`

The platform's first source of revenue is a small **booking fee** paid by the patient online to confirm their booking. The visit fee itself continues to be paid in cash at the clinic. This approach is clean to collect, and it also gives patients a reason to honor their bookings, which reduces missed visits. Other revenue models — provider subscriptions and per-visit commission — are introduced in later phases.

`[NEW]` **Slot reservation and payment holding.** When an online fee applies, the patient's place is held for a limited **reservation window** while payment is completed. As a working default, a place is held for **10 minutes**. The outcomes are strict and simple:

- **Payment succeeds → the booking is confirmed** and the place becomes permanent.
- **Payment fails → the place is released** and the held booking is discarded.
- **Window times out → the place is released** and the held booking is discarded.

`[UPDATED]` A booking is either fully paid and confirmed, or it does not exist — **a booking is never partially confirmed**, and there is no half-paid, half-held state that lingers. If payment fails or the window lapses, the place is released and the patient can simply try again with no confusing leftover state. In the rare event that a payment cannot be matched to a held booking, it is flagged for support and refunded — money is never quietly kept.

**Refunds.** Refunds are handled by the platform automatically wherever the rules are clear; a patient should never have to chase money they are owed. Cancellations caused by the provider or by a platform error are refunded in full immediately. A patient who cancels within the free window is refunded in full. A patient who cancels very late or misses their visit forfeits the fee, according to the stated policy. Anything genuinely unclear or disputed is routed to support, who can issue a refund by hand. Refunds return to the method the patient paid with, and the patient is told honestly how long the bank may take. A faster wallet-based refund option may be offered in a later phase.

---

## 10. Reviews & Ratings

A patient can review a provider only after a completed visit, and only once per visit. This keeps reviews genuine and tied to real experiences. Reviews cover an overall rating alongside a few specific aspects such as waiting time, the doctor's manner, and cleanliness, which together form the provider's rating. Providers may reply to reviews, and reviews pass a light check before appearing publicly to guard against abuse.

---

## 11. Notifications & Login Security

Login codes are sent by SMS, as the reliable baseline. Booking confirmations, reminders, and updates are sent over WhatsApp, which is the channel our users actually read, with email as a fallback. The product does not depend on browser notifications, which are unreliable on phones.

Reminders are sent when a booking is made and again shortly before the session or slot, which is our first and most direct tool for reducing missed visits.

Login codes are both a security matter and a real cost, since each message is paid for. The platform therefore limits how often a code can be requested for a given number and device, caps the number of requests in a day, applies short cooldowns after repeated attempts, and reuses a still-valid code rather than sending a new one on rapid re-requests. For a normal user this is completely invisible; it only surfaces when behavior is abnormal. This protects our messaging costs and prevents the platform from being used to repeatedly message someone against their will.

---

## 12. Promotions (Later Phase)

Discount coupons, cashback, and a patient wallet are planned for a later phase and are noted here so their rules are understood in advance. A discount can never reduce the amount payable below zero; if a discount is larger than the fee, the remainder is simply not owed and is never paid out as cash. Cashback is credited to the patient's wallet and can be applied to future bookings rather than withdrawn.

---

## 13. Provider & Account Suspension

Suspending a provider comes in two forms, and operations chooses the appropriate one. A **soft** suspension removes the provider from search and blocks any new bookings, while honoring bookings that already exist — this suits a temporary pause and does not punish patients who already booked. A **hard** suspension, used when there is a serious issue such as a credential problem or fraud, additionally cancels all upcoming bookings, refunds them in full, and notifies the affected patients with help to rebook elsewhere. Serious safety-related suspensions default to the hard form automatically. The same principle guides the suspension of a patient account: it prevents future activity while dealing fairly with anything already committed.

---

## 14. Insurance (Future Phase) `[NEW]`

Insurance is **not part of the MVP**. It is documented here so the platform is prepared for it without rework. Support for Egyptian insurance networks — for example **AXA, MedNet, Bupa, MetLife**, and others — is planned as **Phase 2 or Phase 3** functionality.

The data model is prepared for insurance in advance through two relationships:

```
Provider
  └── Accepted Insurance Plans

Patient (Profile)
  └── Insurance Information
```

When activated, a provider will declare which insurance plans they accept, a patient profile will carry its insurance information, search will offer an insurance filter (Section 4), and the booking flow will be able to reflect coverage. Until that phase, none of this is exposed to users, but the model reserves space for it so that introducing insurance does not disturb existing bookings, providers, or profiles.

---

## 15. Analytics & Reporting (Future Phase) `[NEW]`

Analytics is a later-phase capability, split by audience. It is documented now so events and records are captured from the start in a way that can feed these reports.

**Platform / Admin reporting** covers the health of the whole marketplace:

- Total bookings.
- Revenue.
- Conversion rate (searches and profile views that turn into bookings).
- Cancellation rate.
- Top providers.
- Top specialties.
- Top locations.

**Provider reporting** covers a single provider's performance:

- Booking trends over time.
- Cancellation trends.
- Utilization (how full their sessions and slots run).
- Average wait time.

Provider-facing analytics aligns with the Phase 3 provider roadmap in Section 2.

---

## 16. Handling of Patient Data

Patient and medical information is treated as sensitive throughout. Access is limited to those who need it, and the platform is built to protect this data as a first-class concern. Specific legal obligations around health data will be confirmed with legal counsel before launch. `[UPDATED]` The auditability and security requirements that support this are defined in Section 17.

---

## 17. Non-Functional Requirements `[NEW]`

These requirements apply across the platform and are owned jointly by Backend, QA, and DevOps.

**Performance.**

- Search results return in **under 2 seconds** under normal load.
- Booking confirmation completes in **under 3 seconds** under normal load.

**Availability.**

- Target service uptime of **99.9%**.

**Security.**

- Protection against **SQL injection**.
- Protection against **cross-site scripting (XSS)**.
- Protection against **cross-site request forgery (CSRF)**.
- **Rate limiting** on sensitive and high-cost endpoints.
- **OTP abuse prevention**, as described in Section 11.

**Auditability.**

- **Important booking changes are tracked** — creation, confirmation, cancellation, completion, and missed-visit records, with who acted and when.
- **Provider actions are tracked** — schedule changes, price changes, session cancellations, and status changes.
- **Refund actions are tracked** — who initiated a refund, why, and its outcome.

These audit trails support dispute resolution, financial accuracy, and the careful handling of patient data described in Section 16.

---

## 18. API-First Platform `[NEW]`

The platform must be **API-first**. All functionality is exposed through well-defined APIs, and every client is a consumer of those same APIs rather than a special case. This is required so the platform can serve, from one consistent core:

- The **web** experience.
- **Mobile applications**.
- **Future partner integrations** — insurance networks, provider systems, and third parties.

Building API-first from the start avoids a costly re-platforming later and keeps web, mobile, and partners in lockstep on the same business rules defined in this document.

---

## Appendix A — Concurrency & Inventory Protection `[NEW]`

This appendix describes required system *behavior* under concurrent demand. It intentionally contains no implementation code; it defines what must be true, and engineering chooses how.

**Two patients booking the last place at the same instant.** When multiple patients attempt to take the final available place simultaneously, the platform must guarantee that **exactly one succeeds**. The place can never be granted to two patients. The patient who does not succeed must receive an immediate, clear outcome — the next available place under a comfort limit, or the next available session or slot under a strict limit — and never an error or a silent failure.

**Capacity limits.** Every session and slot has a capacity that the platform must enforce as a single source of truth. A comfort limit may be exceeded knowingly and with the patient's consent (a longer wait); a strict limit must never be exceeded under any circumstances, including concurrent booking attempts.

**Session locking.** While a place is being claimed, the relevant capacity must be protected so that concurrent attempts are resolved in order and cannot both consume the same place. Holds (the `HELD` and `AWAITING_PAYMENT` states in Section 7) must count against capacity while they are active, and must return capacity the moment they are released, so that a place is neither double-sold nor stranded.

**Double-booking prevention.** The platform must prevent the same place from being confirmed for two bookings, and must prevent the same patient profile from unintentionally holding conflicting bookings for the same time. Capacity counts must always reconcile: confirmed bookings plus active holds must never exceed a strict capacity.

---

## Decisions Owned by the Business

The following are commercial inputs rather than product rules, and need to be set by the business. Sensible placeholders are in use until they are confirmed:

- The **booking-fee amount** charged to patients.
- The **commission or subscription rate** for providers, once that model is activated.
- The **length of the free-cancellation window** before a session or slot.
- The **length of the payment holding window** `[NEW]` (working default: 10 minutes).
- The **first launch city or governorate**, so the initial provider network can be focused there.

---

## Delivery Sequence `[UPDATED]`

To keep the build focused, the platform is delivered in stages, aligned with the provider roadmap in Section 2.

The **first stage** establishes patient accounts and profiles, the provider–branch network, laboratory and radiology service definitions with preparation and eligibility acknowledgement, search, and the core booking experience with cash payment at the clinic and WhatsApp reminders — this alone delivers the central value of finding a provider, booking, and being reminded. Providers are operations-managed in this stage.

The **second stage** introduces the online booking fee and payment holding, refunds, the full booking state machine end to end, reviews, missed-visit handling, and the provider self-service portal. `[UPDATED]`

**Later stages** add insurance support, promotions, home sample collection for laboratories, platform and provider analytics, multi-branch and staff-role management, and further payment options. `[UPDATED]`

Design and engineering should prioritize the first stage in full before moving on. The non-functional requirements, API-first principle, and concurrency protections in Sections 17, 18, and Appendix A apply from the first line of code, not from a later stage.
