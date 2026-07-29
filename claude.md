# CLAUDE.md — Wingdai

This file gives Claude Code the context needed to work on this repository. It is derived from the Wingdai product/business plan. Read it before writing any code — several of these rules exist because getting them wrong is expensive (money, legal exposure, or rider trust), not just "nice to have."

---

## 1. What this product is

Wingdai is a **hyperlocal food-delivery platform** for Thailand. The thesis: delivery economics only work when the average delivery distance is short (1–1.5 km) inside a dense zone. **The strategy is zone-type-agnostic** — a university area, a condo cluster, and an office district all qualify equally; the founder picks whichever dense zone they can access first, not a specific demographic. Short distance lets one rider complete 4–5 orders/hour instead of ~2. That efficiency is what funds a **15% commission (GP)** instead of the industry's 30–35% — which means restaurants don't need to inflate menu prices, which means **the customer pays the same price as walking into the store.**

Don't assume the founder or the target zone is student-specific anywhere in the product — the business model generalizes across zone types and across who's running it. Zone-type is a config/data decision, not a hardcoded assumption (see §7).

Every architectural and product decision below exists to protect that thesis. If a feature request conflicts with it, flag it — don't just build it.

---

## 2. Current phase — READ THIS FIRST

We are building **Phase 1 (MVP)**. Scope discipline matters more than speed here; the plan explicitly calls scope creep the most common way this kind of business dies.

**Build now (Phase 1):**
- One mobile app, role-based UI — but **not** a simple 1-account-1-role model anymore (see §4 for the updated account architecture)
- Username + password login, with a one-time phone OTP verification at registration (not at every login)
- **Auto-dispatch** (§6.3) — this was deferred to Phase 2 in earlier plan revisions; it has been pulled into Phase 1. Build the scoring + sequential-offer engine now, seeded with restaurant-set constant prep times (no historical data needed to start). Keep a manual-override path for admins as a safety net.
- **Semi-automated refund/dispute** (§6.4) — system auto-verifies and proposes a decision; admin confirms with one tap. Not admin-typed-from-scratch, and not fully automatic payout either.
- Admin dashboard built **exception-based by default** (only orders needing attention), not a raw live-order firehose — this is a Phase 1 requirement now, not a later optimization, because it was flagged as a scaling concern up front.
- PromptPay payment only (no cards yet)
- Order state machine + refund recording
- **Bilingual UI (Thai + English), auto-selected from device locale** — moved *into* Phase 1 by an explicit decision on 2026-07-21. This was previously on the "do not build yet" list; it is no longer. Thai is the source language, English is the second locale. Every user-facing string goes through the i18n layer from the first commit — retrofitting i18n is far more expensive than starting with it.

**Do NOT build yet, even if it looks easy to add:**
- Group Order
- Promotions / coupons / discount codes
- Fully automated ledger + payout runs (see the note in §6.2 — Phase 1 can log refund/payout data without building the automated reconciliation engine yet)
- Any grocery/non-restaurant vertical, any "super app" feature (rides, courier, bill pay)
- Loyalty points, in-app chat, AI recommendations

If you're asked to add something from the "do not build yet" list, say so and ask for confirmation before proceeding — it's very likely someone forgot which phase we're in, not a deliberate change of plan.

**Note on scope:** Phase 1 is meaningfully larger now than in earlier plan revisions (auto-dispatch and semi-automated refund verification both moved in from Phase 2). Budget more time accordingly — don't silently compress the timeline to match the old Phase 1 estimate.

---

## 3. Non-negotiable product principles

These override convenience or "faster to build this way." If a shortcut would violate one of these, stop and flag it instead of shipping it silently.

1. **Density over coverage** — don't build features that assume/encourage city-wide coverage before a single zone is profitable.
2. **App price == in-store price** — never silently add markup to menu prices. Any fee must be its own line item (delivery fee, service fee), never folded into the item price.
3. **No cash-burn subsidies** — no discount-code system, no "unlimited free delivery" mechanics. Every order should be structured to have positive contribution margin.
4. **No rider-speed pressure** — never build a KPI, leaderboard, or notification that rewards riders for going faster. Speed comes from shorter distances (zone density), not from pushing riders.
5. **PromptPay-first** — PromptPay QR is the default and primary payment path. Card payment fees (3.2–3.65%) vs PromptPay (0.8–1.8%) materially change unit economics, so the UI/flow should never make card payment the path of least resistance.
6. **Ops must work from a phone** — the Admin role UI must be fully usable on a mobile screen. Don't design admin screens assuming a desktop/wide viewport is available.

---

## 4. Architecture: one mobile app, capability-based roles

There is **one React Native app**, not separate apps per user type. But the account model is **not** a simple 1-account-1-role enum anymore — read this carefully before touching auth or navigation code.

### 4.1 Account types and how they're created

| Account type | How it's created | Notes |
|---|---|---|
| `user` (customer) | Public registration | Default account type. Can later gain a merchant capability (below). |
| `rider` | Public registration | Chosen at signup. **A rider can also place customer orders** (decided 2026-07-21) — the rider account carries customer ordering as a capability, the same way a `user` account can carry a merchant capability. |
| Merchant | **Not a signup type at all** | An **upgrade** applied to an existing `user` account — see §4.3 |
| `admin` | **Never public** | Provisioned directly by the company (DB seed / internal tool). There is no public registration path or UI entry point for this. |

### 4.2 Auth flow

- **Login:** identifier + password, where identifier is **either the username or the phone number** (decided 2026-07-29, replacing the 2026-07-23 username-or-email rule). Username is short and easy to type; phone is the channel that's already OTP-verified. **Email is captured at registration but is NOT a login identifier** — it exists only as a password-reset channel. A login attempt matches an account whose username OR phone equals the identifier.
- **Register:** username, password, phone number, name, **and an optional email** — phone number still gets a **one-time OTP verification at registration** (not at every login), and email does NOT replace it. This matters even though login itself doesn't use OTP: riders, restaurants, and customers need working contact numbers for delivery coordination, and skipping verification opens the door to fake-number signups. Email is stored only as a login alias / password-reset channel, never as the verified identity.
- **Forgot password:** a real flow is needed now (wasn't required under the old OTP-only login) — reset via SMS to the verified number or via email.
- At the end of registration, the user picks **`user` or `rider`** — nothing else is offered here.

### 4.3 Merchant is a capability, not an account type

A logged-in `user` account can tap "Open your restaurant" from their profile, fill out a restaurant registration form, and submit it for admin approval. Once approved, **that same account** gains access to the Merchant Stack via an in-app role switcher — it does not become a new account and does not require re-registering.

This means the navigation model is not a flat "route once by user_type" — it's:

```
AuthStack (username/password login, register, forgot password)
  → after login, check account_type:
       "user"
           → CustomerStack (default view)
           → if an approved merchant profile exists on this account:
                show a role-switcher entry point → MerchantStack
       "rider"
           → if approved: RiderStack (default view)
                          + role-switcher entry point → CustomerStack (can order food)
           → if pending approval: an "awaiting approval" screen only — no other stack access,
                                  including no customer ordering
       "admin" (provisioned by the company, never via public registration)
           → AdminStack
```

**Consequence for permission handling:** background location for the rider role still only applies to `rider` accounts. It should never be requested from a `user` account, even one with an approved merchant profile.

**Fraud/conflict-of-interest rule — enforce this at the application layer, not just as a UI nicety:** a user must not be able to place an order from a restaurant they own. Check `restaurant.owner_user_id` against the ordering `user_id` on every order creation, server-side.

**Resolved 2026-07-21 — a `rider` account CAN place customer orders** (the way a Grab driver can also order Grab food). This replaces the earlier "mutually exclusive" design.

Consequences for navigation and data:
- `account_type` still has exactly three values (`user | rider | admin`) — riders do **not** get a second account. Customer ordering is a capability available to both `user` and `rider` accounts.
- A `rider` account therefore reaches **two** stacks: RiderStack (work) and CustomerStack (ordering), via the same role-switcher pattern already used for merchants.
- Background location permission stays tied to **rider work mode only** — it must not be requested while a rider is browsing as a customer.
- The conflict-of-interest rule extends: a rider must not be able to accept a delivery job for an order they placed themselves. Check this server-side at dispatch time, not just in the UI.

**Why one app at all:** this is a solo/small-team build. One codebase, one deploy, one EAS Update pipeline. Merchant/rider/admin are "workers," not consumers — they don't need the install-friction protections a customer-facing app needs, so bundling them costs nothing.

**Known trade-off to keep in mind:** because there's no web/PWA ordering flow, customers must install the app before ordering, which raises acquisition friction vs. a link-based flow. Compensate with the "same price as in-store" pitch and in-store QR codes pointing straight to the app store listing — this is a product/marketing mitigation, not something to solve in code, but worth remembering when designing onboarding.

---

## 5. Tech stack

### Frontend (single app)
| Layer | Choice | Notes |
|---|---|---|
| Framework | React Native + Expo | Use EAS Update for OTA bug fixes without app store review |
| Navigation | React Navigation | Separate stack per role (§4) |
| Server state | TanStack Query | |
| Client state | Zustand | |
| Forms | react-hook-form + zod | |
| Maps | MapLibre GL (react-native) + MapTiler/Protomaps tiles | **Do not use the Google Maps SDK** — it bills per map load, which is unsustainable on a "customer stares at tracking screen for minutes" use case |
| Push notifications | Expo Notifications → FCM | |

**Making rider tracking feel as realtime as possible:** the map provider is not the lever here — MapLibre supports smooth marker animation just as well as Google Maps. Realtime-ness comes from three things, all of which should be built:
1. **WebSocket push, never REST polling**, for location updates (the realtime/dispatch service already does this).
2. **Rider location ping interval of ~3–5 seconds while actively delivering** (relax to 15–30s when online-but-idle, to save battery). This matches what Grab/Uber actually use — there's no need for continuous GPS streaming.
3. **Client-side interpolation** — animate the marker's position between pings (tween/ease) instead of snapping, so movement reads as continuous even though updates arrive every few seconds.

Do not treat "switch to Google Maps" as a way to get more realtime tracking — it isn't one, and it reintroduces the per-load billing risk noted above.

### Backend — ✅ confirmed 2026-07-29: TypeScript (NestJS) on Supabase Postgres

**This replaces the earlier Spring Boot + Go decision.** That decision was made assuming a team; with a solo builder, running two backend languages alongside a React Native app costs more than the safety it buys. The safety argument for Java was ecosystem, not language — ACID comes from Postgres either way, and §7 already mandates integer satang, which removes the floating-point risk that motivated the original choice.

| Layer | Choice | Notes |
|---|---|---|
| Core API | **NestJS (TypeScript, Node 22)** | auth, catalog, order, payment, ledger, notification — modular monolith. NestJS modules map 1:1 onto these. |
| DB access | **Drizzle ORM** | SQL-first, real `transaction()`, and a clean raw-SQL escape hatch — needed because PostGIS types have no first-class ORM support. Prisma was rejected for weak PostGIS handling. |
| Realtime/dispatch | **same NestJS process for now** | Split into its own service only when connection count justifies it. Node's I/O model is what made Go attractive here in the first place. |
| Database / storage | **Supabase** (managed Postgres 15 + PostGIS + Storage), region `ap-southeast-1` | See the rule below on what Supabase is and isn't for. |

**Supabase is the data plane, not the logic plane.** Use it for: managed Postgres + PostGIS, Storage (rider ID/licence photos), backups, and connection pooling. Do **not** put business logic in Edge Functions or plpgsql — money logic (§6.2) and dispatch (§6.3) live in the NestJS service where they can be unit-tested and versioned. The payoff: the DB is plain Postgres, so moving to RDS later is a connection-string change, not a rewrite.

**Do not use Supabase Auth.** §4.2 requires username-or-phone as the login identifier; Supabase Auth only supports email/phone/OAuth, so username login would mean faking synthetic emails. Auth is our own: argon2id password hashes + JWT, issued by core-api. Supabase's phone OTP is not used either — OTP delivery goes through a Thai SMS provider when that's picked.

**Three non-negotiable guardrails** — these are what make TypeScript as safe as Java would have been for money code. Do not skip them:
1. **All money is an integer number of satang.** No floats anywhere in the path from API to ledger. Keep a test that fails on any non-integer amount.
2. **Ledger writes go in the same `db.transaction()` as the order status change.** No exceptions, no "we'll reconcile later".
3. **Ledger tests assert debits === credits as a property**, generated across many order shapes — not one worked example.

### Data & infrastructure (not affected by the frontend/backend decision above)
- **PostgreSQL + PostGIS** — primary DB, zone boundaries, geospatial queries
- **Redis** — cache, session store, `GEOSEARCH` index for rider matching, rate limiting, event streams
- **No Kafka yet** — use a transactional outbox + Redis Streams; revisit only above ~100 orders/minute
- **AWS ap-southeast-1** (Singapore) — acceptable ~30ms latency from Bangkok
- **ECS Fargate + RDS Multi-AZ + ElastiCache** — do not reach for Kubernetes at this team size
- **Terraform + GitHub Actions**
- **Firebase Cloud Messaging** for push (free tier)
- **Sentry + OpenTelemetry → Grafana Cloud**

**Routing API cost trap:** never call a per-element routing API (e.g. Google Routes) against every candidate rider. Use Redis `GEOSEARCH` to shortlist 5–10 candidates first (free, in-memory), then call the routing API once for the selected rider. Self-host OSRM/Valhalla on an OpenStreetMap Thailand extract once volume justifies it.

---

## 6. Business rules that MUST be correct in code

These aren't style preferences — get them wrong and it's a financial or legal problem, not a bug ticket.

### 6.1 Commission
Restaurant commission (GP) is **15%**, applied to the food subtotal only (not delivery fee or service fee). This number is the entire basis of the "no markup" pitch — never let it drift silently.

### 6.2 Ledger — double-entry, append-only
Every completed order must produce balanced ledger entries. Example for a ฿170 order (฿150 food, ฿15 delivery, ฿5 service fee):

| Account | Debit | Credit |
|---|---|---|
| `cash` (net settled by the gateway) | ฿168.64 | |
| `payment_fee_expense` | ฿1.36 | |
| `restaurant_payable` | | ฿127.50 |
| `rider_payable` | | ฿30.00 |
| `platform_revenue` | | ฿12.50 |
| **Total** | **฿170.00** | **฿170.00** ✓ |

**Corrected 2026-07-29.** An earlier version of this table debited `cash` the full ฿170 and credited `platform_revenue` ฿13.86. It balanced, but it was wrong in two ways: the gateway never remits the gross amount (it nets its fee out before settlement), and crediting revenue ฿13.86 overstated it by exactly the fee — which made cash and PromptPay look equally profitable, contradicting §6.5. With the corrected entries, `platform_revenue` is ฿12.50 regardless of payment method and the fee shows up only as an expense, so net contribution is ฿12.50 for cash and ฿11.14 for PromptPay. The property test in `services/core-api/src/ledger/postOrder.test.ts` is what surfaced this.

**Same order paid in cash** — the rider collects money that belongs to the platform, so it lands in `rider_cash_held` rather than `cash`, and there is no gateway fee:

| Account | Debit | Credit |
|---|---|---|
| `rider_cash_held` | ฿170.00 | |
| `restaurant_payable` | | ฿127.50 |
| `rider_payable` | | ฿30.00 |
| `platform_revenue` | | ฿12.50 |
| **Total** | **฿170.00** | **฿170.00** ✓ |

**The rider never fronts the food cost.** The restaurant is paid by the platform on the weekly run no matter how the customer paid. Requiring riders to carry working capital would gate recruitment on having cash on hand and would push cancellation losses onto them — both are direct threats to the rider supply the whole model depends on. At payout, `rider_cash_held` is netted against `rider_payable`; a rider with ฿170 collected and ฿30 earned owes the platform ฿140, deducted from their cashless earnings. Enforce a cash-in-hand ceiling (`rider_profiles.cash_limit_satang`, default ฿1,500) — over the ceiling, stop offering cash orders until they settle.

Rules:
- Entries are **append-only** — never UPDATE or DELETE a ledger row. Corrections are reversal entries.
- Write ledger entries in the **same DB transaction** as the order status change.
- Weekly payout run: debit `restaurant_payable` → credit `cash`.
- Daily reconciliation: ledger totals must match the payment gateway's settlement report; mismatch → alert immediately.

**Phase 1 clarification:** per §2, Phase 1 does not need the fully automated payout/reconciliation engine — that's Phase 2. But when you do build it (or even a manual version now), the double-entry structure above is the target design; don't build something that will need a rewrite to become double-entry later.

### 6.3 Dispatch — now Phase 1 scope, not a Phase 2 deferral
This used to be deferred to Phase 2 with Phase 1 relying on manual admin assignment. **That has changed — auto-dispatch is now Phase 1 scope.** Build the engine described below before launch, not after. Keep a manual-override action available to admins regardless (for cases where auto-dispatch can't find a rider, or something's clearly wrong).

Never dump a job into a shared pool riders race to accept — it rewards fast networks over the best-fit rider and creates dead time.

Sequential offer, scored:
```
score(rider) = w1 × (1 / distance_to_restaurant)
             + w2 × time_since_last_online   // fairness
             + w3 × completion_rate
             − w4 × current_active_jobs
```
Offer to the highest-scored rider → 15s to accept → if declined/timeout, offer to the next.

**Critical timing rule — don't dispatch too early:**
```
dispatch_time = predicted_food_ready_time − rider_travel_time_to_restaurant
```
If a rider arrives before food is ready, they wait unpaid, their earnings/hour drops, and they churn. Predict prep time per restaurant from a moving average (by restaurant, time of day, order size); **seed it from a restaurant-set constant** (collected during restaurant onboarding, §7) since there's no historical order data on day 1 — the algorithm is designed to work cold-start, so this isn't a blocker to shipping auto-dispatch in Phase 1.

**Batching:** if 2+ orders from the same/nearby restaurant are headed to nearby drop-offs within a 5-minute window, assign them to one rider.

**Monitor closely at launch:** since there's no real prep-time data yet, watch Orders per Rider Hour (§8) closely in the first weeks and expect to tune the scoring weights and prep-time constants based on what actually happens.

### 6.4 Refund & dispute — semi-automated, not manual-only
The flow is: customer reports an issue → system auto-verifies → system proposes a decision → admin confirms/edits/rejects with one tap. This is **not** a fully manual admin workflow, and it's **not** a fully automatic payout either — a human always confirms before money moves.

Auto-verify checks to run before presenting a recommendation to admin:
- **Order status/timing** — is the order within the window disputes are even allowed for (e.g. within X hours of delivery)?
- **Photo evidence** — compare the rider's delivery-confirmation photo (if any) against the customer's complaint.
- **Historical pattern** — is this customer's, this restaurant's, or this rider's dispute rate abnormal? (fraud signal — don't auto-approve a customer who disputes an unusual fraction of their orders)
- **Amount threshold** — below some threshold, it's reasonable to auto-suggest a fast full refund; above it, flag for closer review rather than auto-suggesting.

Present the output as a recommendation with reasoning (e.g. "Suggest full refund of ฿150 — wrong item, customer provided a photo, this restaurant has no prior disputes"), not just a raw refund button. When admin confirms, it must **auto-generate a ledger reversal entry**, never a manual out-of-band ledger fix.

Fault attribution convention: wrong item → restaurant's cost; spilled/damaged in transit → rider's cost; platform/system error → platform absorbs. Store this attribution on the refund record — it'll be needed for payout math and for restaurant/rider-facing reporting later.

Instrument refund rate from day 1; > 2% is a signal something systemic broke, not just normal noise.

### 6.5 Payment
Phase 1 ships **three** payment methods (decided 2026-07-29): **PromptPay QR**, **cash on delivery**, and **card**. PromptPay stays the *default* and the path of least resistance — §3 rule 5 is unchanged, and the customer's chosen default is stored per account (they can change it in Profile → Payment method).

Status of each:
- **PromptPay** — mocked QR screen until the gateway question in §11 is answered.
- **Cash on delivery** — works end to end; the rider collects. Cash orders need their own ledger treatment (rider holds platform money) — get this right before launch.
- **Card** — listed in the picker but **not selectable yet**, labelled "payment gateway pending". Enable it the moment §11.3 is resolved. The fee delta (0.8–1.8% vs 3.2–3.65%) must be visible in internal margin reporting — don't let card become invisible overhead.

---

## 7. Core data entities (starting point, not final schema)

`User (account_type: user|rider|admin)`, `Restaurant (owner_user_id → User)`, `MenuItem`, `Order`, `OrderItem`, `Address`, `RiderProfile`, `RiderDocument`, `LedgerEntry`, `Payout`, `RefundCase`, `Zone`.

**`User.account_type` is `user | rider | admin` — not `customer | merchant | rider | admin`.** Merchant status lives on `Restaurant.owner_user_id`, a foreign key back to a `user`-type account, not as a value of `account_type`. A single `User` row can therefore be a plain customer, or a customer who also owns a `Restaurant`. Don't model merchant as a peer enum value next to `rider`/`admin` — that was the old design and it no longer matches the product spec.

**`admin` accounts are never created through the public registration endpoint.** Seed them directly or build an internal-only provisioning tool; there is no public sign-up path for this account type.

**`RiderProfile` / `RiderDocument` should capture (all required for admin approval):**
- Identity: full legal name, Thai national ID number, date of birth, verified phone, selfie photo, ID card photo (front + back)
- License & vehicle: vehicle type (motorcycle only for Phase 1), driver's license photo + expiry, vehicle registration number, vehicle registration book photo, compulsory motor insurance (พ.ร.บ.) photo + expiry
- Payout: bank name, account number, account holder name — **should match the verified legal name**, as a basic anti-money-laundering / mule-account check
- Safety: emergency contact name + phone
- Preferred `Zone` (helps admin filter approvals by launch zone)
- Signed independent-contractor agreement + PDPA consent for storing the above

**`Restaurant` registration (submitted by a `user`-type account, not a separate signup) should capture:** name, cuisine category, address + coordinates (must fall within an active `Zone`), operating hours, storefront photo, a business/ID document, payout bank details, and a minimum starter menu before submission is allowed.

Notes:
- `Zone` matters early — density/beachhead logic (§Roles, §Dispatch) is all zone-scoped. Don't model this as a single flat city-wide table from the start.
- **`Zone` should carry a `type` field** (e.g. `university` | `condo_cluster` | `office_district` | `mixed`), since the beachhead strategy applies equally across zone types (§1). Don't hardcode zone-type-specific assumptions (e.g. a semester calendar) into core zone or dispatch logic — keep seasonal/demand-pattern config (closure periods, peak hours, etc.) as per-zone-instance data, not as branching logic keyed on zone type.
- Keep monetary fields as integers (satang) internally where practical to avoid floating-point drift in ledger math — the plan doesn't specify this, but it directly protects the "ledger must never be wrong" rule in §6.2.
- The Admin dashboard should default to an **exception-based view** (orders past SLA, unresolved disputes, orders with no rider assigned after N minutes) rather than a raw live-order feed — this was flagged early specifically because a full firehose view stops being usable once order volume grows, and building the filtered view later means retrofitting, not just adding a toggle.

---

## 8. Metrics to instrument from day one

The plan's North Star Metric is **Orders per Rider Hour**, not order count or user count. To compute it you need, from the very first version: rider online/offline timestamps and order-completion timestamps per rider. Build this logging in even before there's an analytics dashboard to show it.

| Metric | Target | Why it matters |
|---|---|---|
| Orders per rider hour | ≥ 3.0 | Core of the whole economic model |
| Contribution margin/order | > ฿0 from day 1 | No subsidized orders |
| Restaurant accept rate | > 95% | Missed orders lose customers |
| On-time delivery rate | > 90% | |
| Median delivery time | < 30 min | |
| Refund rate | < 2% | Above this = systemic issue |
| 30-day repeat order rate | > 40% | Signal the product is actually good |
| % paid via PromptPay | > 80% | Directly affects margin |
| Auto-dispatch success rate (new) | > 90% (jobs successfully assigned without manual override) | Validates that the dispatch engine pulled into Phase 1 is actually working, not just shipped |

---

## 9. Suggested repo layout

```
/apps
  /mobile              # React Native + Expo — role-based stacks live here
/services
  /core-api            # NestJS (TypeScript) — auth, catalog, order, payment, ledger, notification,
                       #   and (for now) realtime + auto-dispatch (§6.3)
/packages
  /shared-types        # types shared FE↔BE — do not hand-duplicate
/infra                 # Terraform (only once we outgrow Supabase's managed setup)
```

Since both sides are TypeScript now, `shared-types` can export the Drizzle-inferred row types
directly instead of being generated from an OpenAPI spec. The mobile app must keep importing
through `src/data/repositories` — screens never import backend types directly, so swapping the
mock repo for the HTTP one stays a one-file change.

---

## 10. Resolved decisions

- ~~**Backend language: Spring Boot (Java 21) + Go**~~ — **superseded 2026-07-29.** Backend is now **NestJS (TypeScript) on Supabase Postgres with Drizzle** — see §5 for the full reasoning and the three money-code guardrails that replace what Java's ecosystem was buying us. The deciding factor: for a solo builder the biggest risk is not shipping, and two backend languages beside a React Native app is a tax paid daily.
- **Supabase is the data plane only** (decided 2026-07-29) — Postgres + PostGIS + Storage. Business logic stays in NestJS, never in Edge Functions or plpgsql. Supabase Auth is not used (§4.2 needs username login). See §5.
- **Brand name: Wingdai** (decided 2026-07-21). Earlier revisions of this file said "FoodRush" — that name is retired. Use Wingdai everywhere: app display name, bundle identifier, copy, assets.
- **A rider account can also place customer orders** (decided 2026-07-21) — see §4.3. Replaces the earlier mutually-exclusive design.
- **Bilingual UI, Thai + English, auto-selected from device locale** (decided 2026-07-21) — moved into Phase 1 from the "do not build yet" list. See §2.
- **Map tiles: Protomaps** (decided 2026-07-21) — self-hosted `.pmtiles`, no per-load billing, which is the cost trap §5 already warns about. MapLibre remains the renderer.
- **Font scaling: disabled** (`allowFontScaling={false}`, decided 2026-07-21). Accepted tradeoff: users who enlarge system text will not see larger text in this app. Revisit if accessibility feedback demands it.
- **Dark mode: yes, from the first commit** (decided 2026-07-21). Riders work at night; a bright screen while driving is a safety issue, not a preference. This requires a semantic token layer (`bg-surface`, `text-primary`, …) rather than components referencing raw palette values — retrofitting dark mode later means editing every file.
- ~~**Email as optional login alias** (decided 2026-07-23)~~ — **superseded 2026-07-29.** Login identifier is now **username OR phone**, not email. Email is still captured at registration (optional, not OTP-verified) but is only a password-reset channel. `Account` keeps its optional `email` field. See §4.2.
- **Payment methods: PromptPay + cash + card** (decided 2026-07-29) — card payments moved off the §2 "do not build yet" list. PromptPay remains the default; the customer picks their own default in Profile → Payment method. Card stays disabled in the UI until §11.3 is resolved. See §6.5.
- **Notifications are derived from orders, not a separate table** (decided 2026-07-29) — Phase 1 has no push infrastructure or notification entity, so the in-app notification list (design C20) is generated from the customer's own order events. Swap the data source when the backend lands; the screen doesn't change.
- **Design handoff features that stay banned** — the handoff contains screens for wallet/credit, loyalty points, group order, and promotions. Take the visual language only. When a design screen's *content* is a banned feature, replace it with content backed by real data rather than dropping the screen or faking the data.
- **Visual language: "Wingdai rounded-soft"** (decided 2026-07-27). The app follows the design handoff (`Wingdai App.dc.html`, 58 screens): warm off-white ground `#F6F1EA`, white rounded cards (radius 20–24) with soft ambient shadows, pill buttons/chips, a floating teal pill bottom-nav, brand orange `#F15A22` + brand teal `#0E3B3A`. **All new screens must be composed from the primitives in `apps/mobile/src/ui/` — no raw colors, radii, or shadows in screen files.** Full spec: `docs/design/wingdai-design-system.md`.
  - Note the AA carve-out documented there: `#F15A22` fails contrast for text (3.37:1 with white), so it is a **graphics-only** token (`brandAccent`). Text-bearing fills use `#CC4310` (`brandSolid`) and brand-colored text uses `#B23A0C` (`brandLink`). Don't "fix" this by loosening the contrast tests.
  - The handoff contains screens for features §2 bans (deals/promo codes, group order, wallet/points, card & cash payment, merchant promotions). Take the **visual language only** — never the banned features, and never ship UI elements that do nothing.
- **Glass/blur is restricted to low-stakes screens** (decided 2026-07-21). React Native has no `backdrop-filter`; `expo-blur` looks good on iOS but is emulated and frame-expensive on Android. Blur is allowed on onboarding, profile, and receipt screens. It is **banned** on the merchant order queue (⭐ 60s countdown), the rider job offer (⭐ 15s countdown), and any live map screen — those use opaque surfaces. Do not trade frames on the two screens §2 marks as most failure-critical.

## 11. Open decisions — resolve before scaffolding further

1. **Customer acquisition mitigation** for mobile-only onboarding (in-store QR, launch incentive, etc.) — product decision, but may affect onboarding-flow code (deep links, referral codes).
2. Zone type and boundaries for zone 1 (university / condo cluster / office district — see §1, all equally valid), first 10 restaurants, first 5 riders, on-call ownership, runway — business-side questions from the plan's appendix, not code questions, but they gate whether Phase 0 (manual, no-code validation) has actually passed. Don't be surprised if engineering work is asked to pause until these are answered.
3. **Payment gateway** — Opn or Xendit? Needed before the payment module can be built against a real API. Until this is answered the app uses a **mocked** PromptPay QR screen (decided 2026-07-21) — visually complete, no real payment.
4. Phase 1 now includes auto-dispatch and semi-automated refund verification, which is more scope than earlier plan revisions assumed — confirm the extended timeline is acceptable before committing to a launch date.
5. **PDPA data controller identity** — legal name, address, and contact email of the person or company operating Wingdai. Required on the privacy policy before the app can be submitted to either app store. Cannot be guessed or looked up; must be supplied.

---

*This file should be updated whenever a decision in §11 is resolved (move it into §10), or when the phase in §2 advances.*