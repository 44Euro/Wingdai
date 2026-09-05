# Wingdai — product & engineering spec

The rules this codebase is written against, derived from the Wingdai product plan. Several of them
exist because getting them wrong is expensive — money, legal exposure, or rider trust — not just
"nice to have." Code comments throughout the repo cite section numbers from this file.

---

## 1. What this product is

Wingdai is a **hyperlocal food-delivery platform** for Thailand. The thesis: delivery economics only work when the average delivery distance is short (1–1.5 km). **The strategy is zone-type-agnostic** — a university area, a condo cluster, and an office district all qualify equally; the founder picks whichever dense area they can access first, not a specific demographic.

**What enforces "short" is a per-order distance cap, not a zone boundary** (decided 2026-08-03). Restaurants may register anywhere in Thailand; an order is accepted only when the restaurant→dropoff distance is within 5 km. A drawn zone would reject a restaurant 300 m away on the wrong side of the line while accepting one 4 km away on the right side — the cap measures the thing that actually costs money. See §7. Short distance lets one rider complete 4–5 orders/hour instead of ~2. That efficiency is what funds a **15% commission (GP)** instead of the industry's 30–35% — which means restaurants don't need to inflate menu prices, which means **the customer pays the same price as walking into the store.**

Don't assume the founder or the target zone is student-specific anywhere in the product — the business model generalizes across zone types and across who's running it. Zone-type is a config/data decision, not a hardcoded assumption (see §7).

Every architectural and product decision below exists to protect that thesis. A feature request that conflicts with it gets raised, not silently built.

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
- **Support tickets** (design AD4) — customer opens a conversation, admin answers, admin closes. Moved into Phase 1 in wave 2 (2026-08-05) because refunds are not the only thing customers need to say. A ticket **never moves money or changes an order** — anything needing a refund still walks the §6.4 path.
- **Bilingual UI (Thai + English), auto-selected from device locale** — moved *into* Phase 1 by an explicit decision on 2026-07-21. This was previously on the "do not build yet" list; it is no longer. Thai is the source language, English is the second locale. Every user-facing string goes through the i18n layer from the first commit — retrofitting i18n is far more expensive than starting with it.

**Do NOT build yet, even if it looks easy to add:**
- Group Order
- Promotions / coupons / discount codes
- Fully automated ledger + payout runs (see the note in §6.2 — Phase 1 can log refund/payout data without building the automated reconciliation engine yet)
- Any grocery/non-restaurant vertical, any "super app" feature (rides, courier, bill pay)
- Loyalty points, AI recommendations
- ~~in-app chat~~ — the project owner moved chat into Phase 1 on 2026-08-03 (see §10); not built yet. The support-ticket thread shipped in wave 2 is its foundation, but a ticket is a conversation with **staff**, not with the rider or restaurant — do not quietly widen it into order chat.

A request for something on the "do not build yet" list gets confirmed before it is built — it usually means someone forgot which phase this is, not that the plan changed.

**Note on scope:** Phase 1 is meaningfully larger now than in earlier plan revisions (auto-dispatch and semi-automated refund verification both moved in from Phase 2). Budget more time accordingly — don't silently compress the timeline to match the old Phase 1 estimate.

---

## 3. Non-negotiable product principles

These override convenience or "faster to build this way." A shortcut that violates one of them gets raised rather than shipped silently.

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
- **Sign in with Google** (live as of 2026-07-30): a third entry point alongside username/phone + password. Three rules that are not negotiable:
  1. **Google does not replace the phone OTP.** A Google user who has no Wingdai account still walks the short form (username + phone) → OTP → role picker before they get in. Riders and restaurants must be able to phone the customer; a Google-verified email does not give us that.
  2. **The `id_token` is verified server-side**, never trusted from the app. Everything the client reports about the user (email, name, sub) is editable by a modified client; only the signature check against Google's public keys is proof.
  3. **Accounts are linked by Google's `sub`, never by matching email.** Our `email` field is never verified (see the bullet above), so auto-linking on a matching email would let whoever controls that Gmail walk into an account that merely typed the address — and conversely lets someone claim an account by registering with a stranger's address. A Google user whose phone is already registered is told to sign in with their password instead.
- A `password_hash` may be **null** — that is a Google-only account. `login` treats it exactly like "no such account" (same message, same timing) so nobody can probe which numbers are linked to Google.

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
| Session token storage | **expo-secure-store** (Keychain / Keystore) | Not AsyncStorage — the session token lives 30 days and grants full account access, so it must not sit in a plain file readable on a rooted device |
| Google sign-in | `@react-native-google-signin/google-signin` | **Not `expo-auth-session`** — the Expo v57 docs point Google specifically at a dedicated library. Needs a dev build, which §10 already requires for MapLibre |

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

**Configurable since wave 2 (2026-08-05), and that does not weaken the rule — it is what enforces it.** The live rate lives in `platform_pricing.commission_rate_bp` (default 1500 bp) and is changed only from the super-admin screen (SA6), which requires a second confirmation showing old → new and writes an `audit_log` row **in the same transaction** as the change. If the audit write fails, the price change rolls back. `commissionOf(foodTotalSatang, rateBp)` stays a pure function — the service reads the rate and passes it in, so ledger property tests still run without a database.

Existing orders never move: `orders.commission_satang` stores the **amount**, and `orders.commission_rate_bp` stores the rate that was actually used, so a rate change today cannot rewrite yesterday's books.

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

**The fee rate is unset, not zero (2026-09-05).** The ฿1.36 above is 80 bp, the bottom of the PromptPay range in §6.5 — it shows the *shape* of the entries once a gateway is settling money, not a number this system produces today. `PAYMENT_FEE_BP` is `null` for PromptPay and card, so no real order currently writes a `payment_fee_expense` row at all. That is the honest state: §11.3 has not picked a gateway, the QR screen is mocked, and nobody has deducted a fee from anything. Putting 80 bp in now would post an expense the platform never incurred and debit `cash` less than it actually received — the same class of error as the corrected table above, arriving from the other direction.

`null` is deliberately not `0`. Cash is `0` because there is no gateway to charge it, forever; PromptPay and card are `null` because the rate is unknown. Same arithmetic today, opposite futures, and once a gateway lands the distinction is what tells you which channels still need a number.

**A payment channel cannot be switched on while its fee rate is unknown.** `setFlag` refuses to enable `card_payment` until `PAYMENT_FEE_BP.card` holds a real rate. Without that, flipping the switch would make every card order post the full `platform_revenue` with no fee line, and card — which costs 3.2–3.65% against PromptPay's 0.8–1.8% — would read as exactly as profitable as cash. §6.5 warns about that directly, and the corrected table above already had to fix that same mistake once; the flag is the other door into it. Disabling is never blocked, so an emergency shut-off still works.

**Same order paid in cash** — the rider collects money that belongs to the platform, so it lands in `rider_cash_held` rather than `cash`, and there is no gateway fee:

| Account | Debit | Credit |
|---|---|---|
| `rider_cash_held` | ฿170.00 | |
| `restaurant_payable` | | ฿127.50 |
| `rider_payable` | | ฿30.00 |
| `platform_revenue` | | ฿12.50 |
| **Total** | **฿170.00** | **฿170.00** ✓ |

**The rider never fronts the food cost.** The restaurant is paid by the platform on the weekly run no matter how the customer paid. Requiring riders to carry working capital would gate recruitment on having cash on hand and would push cancellation losses onto them — both are direct threats to the rider supply the whole model depends on. At payout, `rider_cash_held` is netted against `rider_payable`; a rider with ฿170 collected and ฿30 earned owes the platform ฿140, deducted from their cashless earnings. Enforce a cash-in-hand ceiling (`rider_profiles.cash_limit_satang`, default ฿1,500) — over the ceiling, stop offering cash orders until they settle.

**Tips (added 2026-09-05).** A tip is a separate movement from the order it hangs off, and it follows one rule: **the tip is collected before the rider is credited.** Crediting `rider_payable` the moment the customer taps creates a payable against money nobody has paid — the platform then settles a tip it never received.

**A tip is always collected by the platform, never handed over in cash.** Tipping opens only once the order is `delivered`, and by then the rider has left; there is no moment at which the customer could put the tip in their hand. That holds even for a cash-on-delivery order — the cash changed hands at the door, before the job closed. So the tip always travels the gateway, whatever the order itself was paid with:

| Account | Debit | Credit |
|---|---|---|
| `cash` (net settled by the gateway) | tip − fee | |
| `payment_fee_expense` | fee | |
| `rider_payable` | | tip (gross) |

Same shape as the corrected order entries above, and for the same reason: the gateway never remits the gross amount, and the fee must show as an expense rather than shrink what the rider is owed. **The rider receives 100% of the tip; no commission is ever taken from it.**

**Tipping is therefore gated behind the payment gateway and is not enabled in Phase 1.** There is nothing to collect through until §11.3 is answered, and a tip button that credits a rider without taking the customer's money is a payable built on nothing. This is the same switch that keeps card payment disabled — one unanswered question, one gate.

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

**Batching — deferred, not built (2026-09-04).** The intended rule is: if 2+ orders from the same/nearby restaurant are headed to nearby drop-offs within a 5-minute window, assign them to one rider. It is deliberately not implemented yet, and dispatch offers one order at a time.

The reason is the same one this section already gives for the prep-time constants: there is no historical order data. Batching needs a drop-off proximity threshold and a batching window, and both are only honest once the scoring weights have been tuned against real Orders per Rider Hour (§8) — picking 5 minutes and "nearby" today would be guessing, and a wrong batch costs a rider two late deliveries instead of one on-time one. Revisit once the launch-week numbers exist.

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

**Delivery fee is distance-based, not flat (decided 2026-08-05, design SA6).**

```
deliveryFee = base + max(0, ceil(distanceKm) − 1) × perKm     // default base ฿15, perKm ฿6
```

Rounded up per kilometre on purpose: a customer must be able to predict the price before ordering, and a fee that moves with GPS decimals reads as a random-price machine. Short trips staying cheap is the mechanism that makes customers pick the nearer restaurant, which is what actually raises orders/rider-hour (§1). Both sides compute it — `services/core-api/src/orders/pricing.ts` is the real amount, `apps/mobile/src/features/cart/pricing.ts` is the preview — and **the two formulas must stay identical**; when they drifted, the app showed ฿15 at checkout and the server charged ฿21. When the distance is not known yet, the app shows "from ฿15", never a bare ฿15.

Phase 1 ships **three** payment methods (decided 2026-07-29): **PromptPay QR**, **cash on delivery**, and **card**. PromptPay stays the *default* and the path of least resistance — §3 rule 5 is unchanged, and the customer's chosen default is stored per account (they can change it in Profile → Payment method).

Status of each:
- **PromptPay** — mocked QR screen until the gateway question in §11 is answered.
- **Cash on delivery** — works end to end; the rider collects. Cash orders need their own ledger treatment (rider holds platform money) — get this right before launch.
- **Card** — listed in the picker but **not selectable yet**, labelled "payment gateway pending". Enable it the moment §11.3 is resolved — but enabling is one action with two halves: set the card fee rate *and* flip the flag. The server enforces that pairing (§6.2), so the flag alone is refused. The fee delta (0.8–1.8% vs 3.2–3.65%) must be visible in internal margin reporting — don't let card become invisible overhead.

**Cash shortfall — the customer picked cash but doesn't have enough (resolved 2026-07-30).** Grab and LINE MAN riders handle this informally by taking a personal bank transfer, sometimes after fronting the food cost themselves. **Wingdai does not support that, and the app must never suggest it.** Three reasons, in order of severity:
1. A rider who fronts food cost needs working capital to take jobs at all — §6.2 rules that out explicitly, because it gates rider recruitment on having cash on hand.
2. Money transferred to a rider's personal account never passes through the ledger, so §6.2's daily reconciliation silently breaks.
3. It moves the platform's collection risk onto the rider without any agreement to that effect.

The supported path is a **"Switch to PromptPay" action on the order tracking screen (C6)**: the customer pays the platform directly, and the rider's cash-collection duty for that order disappears. Allowed while the order is still active and unpaid; once `delivered`, the money is considered collected and any problem goes through the refund flow (§6.4) instead — changing payment method retroactively is never the answer. The rule lives in `canPayNowWithPromptPay` (`apps/mobile/src/lib/rules.ts`) and must be re-checked server-side when the order module lands, not trusted from the client.

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

**`Restaurant` registration (submitted by a `user`-type account, not a separate signup) should capture:** name, cuisine category, address + coordinates, operating hours, storefront photo, a business/ID document, payout bank details, and a minimum starter menu before submission is allowed. **The address does not have to fall inside a `Zone`** — see the distance-model note below.

Notes:
- **Zones are not a gate — a 5 km per-order radius is** (implemented 2026-08-03, superseding the earlier zone-gated design). A restaurant can register anywhere in Thailand, and an order is accepted only if the restaurant→dropoff distance is within `MAX_DELIVERY_RADIUS_KM` (`services/core-api/src/orders/deliveryRadius.ts`, currently 5). What makes the economics work is the **trip being short**, not the two parties sharing a zone — and a zone boundary drawn on a map rejects a restaurant 300 m away on the wrong side of the line while accepting one 4 km away on the right side. `Zone` still exists for reporting, rider-application preferences, and demand analysis; it no longer decides whether an order or a restaurant is allowed.
- **Riders scope their own work with a "work base" (design R7), not a zone.** A pinned point plus a radius of 1–20 km (`rider_status.base_location` / `base_radius_km`), which **really does gate dispatch** — see `services/core-api/src/dispatch/eligibility.ts`, where `outside_work_base` is a hard reason, not a score penalty.
- **`Zone` should carry a `type` field** (e.g. `university` | `condo_cluster` | `office_district` | `mixed`), since the beachhead strategy applies equally across zone types (§1). Don't hardcode zone-type-specific assumptions (e.g. a semester calendar) into core zone or dispatch logic — keep seasonal/demand-pattern config (closure periods, peak hours, etc.) as per-zone-instance data, not as branching logic keyed on zone type.
- **`account_type` has four values: `user | rider | admin | super_admin`** (shipped 2026-08-05). `super_admin` is "an admin who can also change platform rules", **not** a separate role that cannot do admin work — otherwise one person needs two accounts. Every `/admin/*` route accepts both, and **nowhere may compare `accountType === 'admin'` directly**: use `isAdmin()` / `isSuperAdmin()` in `services/core-api/src/auth/roles.ts`. `/super/*` is guarded by `SuperAdminGuard` and accepts `super_admin` only.
- **Support tickets** (`support_tickets`, `support_ticket_messages`) — status is `open | closed` only. The design's `escalated` was dropped: escalate to whom, on a one-person team? A ticket's first message is a row in the thread, not a column on the ticket. Only the ticket owner and admins can read a thread — not the rider or restaurant on the order, since tickets often complain about exactly those people.
- **`orders.leave_at_door`** — the *customer* asks for it at checkout; the rider cannot set it. If riders could tick it themselves they would avoid meeting customers on every order, which deletes the only reason the delivery PIN exists.
- **Platform config lives in three tables** (wave 2): `platform_pricing` (single row — commission, delivery base, per-km, service fee), `feature_flags` (four real keys, see §10), and `audit_log` (append-only, enforced by a trigger in `drizzle/guards.sql`, never UPDATE or DELETE).
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
- **Google sign-in is live, and does not replace the phone OTP** (decided 2026-07-30) — verified server-side, linked by Google `sub`, never auto-linked by email. See §4.2.
- **The server computes every amount; the app never sends prices** (decided 2026-07-30) — order creation takes `menuItemId` + quantity + chosen option ids, and the API reads prices from `menu_items` itself. A modified client could otherwise buy a ฿500 dish for ฿1, and the 15% commission (§6.1) would be charged against the fake number — the restaurant loses real money to a value the customer typed. The cart's totals are a preview for the user, nothing more.
- **"Unknown" is shown as absent, never as a placeholder number** (decided 2026-07-30) — `Restaurant.rating` and `distanceKm` are nullable and the UI hides the whole chip when null. There is no review system until wave 3, so "★ 4.8" on a restaurant nobody has reviewed is a lie, not a placeholder; and distance is only knowable once we know where the customer is. Same rule as "never ship UI elements that do nothing".
- **Cash shortfall is solved in-app, never by the rider** (decided 2026-07-30) — a customer who picked cash and can't pay switches that order to PromptPay from the tracking screen. Riders never front money and never take personal transfers. See §6.5.
- **Notifications are derived from orders, not a separate table** (decided 2026-07-29) — Phase 1 has no push infrastructure or notification entity, so the in-app notification list (design C20) is generated from the customer's own order events. Swap the data source when the backend lands; the screen doesn't change.
- **Design handoff features that stay banned** — the handoff contains screens for wallet/credit, loyalty points, group order, and promotions. Take the visual language only. When a design screen's *content* is a banned feature, replace it with content backed by real data rather than dropping the screen or faking the data.
- **Visual language: "Wingdai rounded-soft"** (decided 2026-07-27). The app follows the design handoff (`docs/design/Wingdai App (standalone).html`): warm off-white ground `#F6F1EA`, white rounded cards (radius 20–24) with soft ambient shadows, pill buttons/chips, a floating teal pill bottom-nav, brand orange `#F15A22` + brand teal `#0E3B3A`. **All new screens must be composed from the primitives in `apps/mobile/src/ui/` — no raw colors, radii, or shadows in screen files.** The tokens themselves live in `apps/mobile/src/theme/tokens/`.
  - Note the AA carve-out documented there: `#F15A22` fails contrast for text (3.37:1 with white), so it is a **graphics-only** token (`brandAccent`). Text-bearing fills use `#CC4310` (`brandSolid`) and brand-colored text uses `#B23A0C` (`brandLink`). Don't "fix" this by loosening the contrast tests.
  - The handoff contains screens for features §2 bans (deals/promo codes, group order, wallet/points, card & cash payment, merchant promotions). Take the **visual language only** — never the banned features, and never ship UI elements that do nothing.
- **Glass/blur is restricted to low-stakes screens** (decided 2026-07-21). React Native has no `backdrop-filter`; `expo-blur` looks good on iOS but is emulated and frame-expensive on Android. Blur is allowed on onboarding, profile, and receipt screens. It is **banned** on the merchant order queue (⭐ 60s countdown), the rider job offer (⭐ 15s countdown), and any live map screen — those use opaque surfaces. Do not trade frames on the two screens §2 marks as most failure-critical.

### Decided 2026-08-03 (rider wave)

- **Delivery is gated by a 5 km per-order radius, not by zones.** See §1 and §7. Riders scope their own work with a pinned "work base" + radius, which really gates dispatch.
- **Delivery confirmation needs a 4-digit PIN from the customer.** The customer sees it on their tracking screen; the rider never receives it in any payload and must ask for it in person. A rider therefore **cannot close a job without meeting the customer**, and the PIN feeds the dispute checks in §6.4. The design showed 3 digits; 4 was chosen because 3 digits is a 1-in-1000 guess and the rider gets unlimited attempts.
- **Chat and reviews move into Phase 1, by explicit decision of the project owner** — an exception to the §2 "do not build yet" list and to the "take the visual language only" rule below. Reviews ship complete: stars, comments, and photos (wave 3). Wallet/credit, loyalty points, group order, promotions and Wingdai+ stay banned.
- ~~**A fourth account type `super_admin` is approved for wave 2.** Not built yet.~~ — **shipped 2026-08-05**, see the wave-2 block below and §7.
- **Riders keep the cash they collect and never hand it back; it is netted against their withdrawable balance instead.** This is what Grab and LINE MAN actually do. The ledger treatment in §6.2 is unchanged — the money is still the platform's while the rider holds it, and `rider_cash_held` still nets against `rider_payable` at payout.
- **Rider payout is semi-automatic** (design R12): the rider requests, an admin confirms, and the ledger entries are written in the same transaction as the approval. There is no automatic nightly payout run.
- **Rider issue reports never change order status** (design R9). A report lands in the admin exception queue (§7) and an admin decides — the rider is not the one who cancels an order or authorises a refund.
- **Animations use React Native's built-in `Animated`, not Reanimated**, and live only in `apps/mobile/src/ui/motion/`. Screens must not import `Animated` themselves; `__tests__/app/motionDiscipline.test.ts` scans the source and fails the build if they do. Contained this way, swapping engines later is one folder, not every screen.
- **Map tiles come from OpenStreetMap raster and routes from the public OSRM server — both are prototype-only.** MapLibre's demotiles have no street-level roads, so a delivery route can't be drawn on them at all. Neither OSM's tile policy nor OSRM's demo server is meant for production traffic; before store submission both must be replaced (self-hosted `.pmtiles` per the Protomaps decision above, self-hosted OSRM/Valhalla per §5). Both endpoints live in one file each so the swap is a constant change.
- **The rider marker updates once per minute, not in realtime**, and the app interpolates between pings so the marker glides instead of jumping (§5 calls this client-side interpolation). The customer sees the rider's position only while the order is still running — once delivered or cancelled the API returns `null`.
- **Rider documents and delivery photos go to Supabase Storage in two buckets**: `rider-docs` (private, signed URLs only) and `public-media` (public). Not local URIs.

### Decided 2026-08-05 (admin + super-admin wave)

- **`super_admin` is live and `account_type` really has four values now.** It is an admin with extra powers, never a separate person — the same human runs the daily queue and changes platform rules, switching stacks with the existing `RoleSwitcher`. See §7 for the `isAdmin()` rule that replaces every direct `=== 'admin'` comparison.
- **Commission and fees are configurable from SA6, with a confirmation step and an audit row in the same transaction.** §6.1's "never let it drift silently" is now enforced by mechanism rather than by memory. Old orders never move, because the amount *and* the rate used are frozen on the order row.
- **Delivery fee became distance-based** (`base + per-km after the first km`), replacing the flat ฿15. Both the server and the app's cart preview compute it, and they must stay identical — see §6.5.
- **`audit_log` is append-only, like the ledger, and for the same reason**: a log you can edit is not evidence. There is no route that updates or deletes a row, a trigger blocks it at the database, and a test scans the source to keep it that way. It records only actions that touch **money or access** — replying to a support ticket is neither, so tickets are deliberately absent, otherwise the audit screen degrades into a feed nobody can search.
- **Four feature flags exist and each one really changes server behaviour**: `cash_payment`, `card_payment`, `auto_dispatch`, `registration_open`. A flag that only hides a button in the app is a flag a modified client walks straight past. PromptPay deliberately has no flag — §3 rule 5 makes it the path that can never be switched off, otherwise a state exists where nobody can pay at all. The design's Group ordering / Surge pricing / Scheduled orders flags were not built: §2 and §3 ban all three, and we do not ship switches for features that do not exist.
- **Zones are a report, not a switch.** SA2 creates and edits zones and shows per-zone numbers, but there is no "disable zone" toggle — since 2026-08-03 zones gate nothing, so the toggle would be a button that does nothing.
- **Support tickets are in Phase 1** (§2), and a ticket never moves money. The admin ticket screen links to an existing refund case when there is one and otherwise explains that refunds start from the customer's report — it cannot open a case on the customer's behalf. Same principle as R9: money has exactly one path.
- **"Leave it at my door" is requested by the customer at checkout, and replaces the PIN with a photo.** Hand-to-hand delivery needs both PIN and photo; a door drop needs the photo alone, because nobody is there to read out a code. The rider cannot set this — if they could, they would tick it on every order and the PIN would stop meaning anything. The server re-checks it on `PATCH delivered`; hiding the field in the app is not enforcement.
- **A photo is now required to close any job**, not just door drops. It used to be enforced only by the app's button state, which a modified client ignores.

## 11. Open decisions — resolve before scaffolding further

1. **Customer acquisition mitigation** for mobile-only onboarding (in-store QR, launch incentive, etc.) — product decision, but may affect onboarding-flow code (deep links, referral codes).
2. First 10 restaurants, first 5 riders, on-call ownership, runway — business-side questions from the plan's appendix, not code questions, but they gate whether Phase 0 (manual, no-code validation) has actually passed. Don't be surprised if engineering work is asked to pause until these are answered. (Zone boundaries no longer gate launch — see the 5 km radius decision in §10 — but picking the first dense area to sell into still does.)
3. **Payment gateway** — Opn or Xendit? Needed before the payment module can be built against a real API. Until this is answered the app uses a **mocked** PromptPay QR screen (decided 2026-07-21) — visually complete, no real payment.
4. Phase 1 now includes auto-dispatch and semi-automated refund verification, which is more scope than earlier plan revisions assumed — confirm the extended timeline is acceptable before committing to a launch date.
5. **PDPA data controller identity** — legal name, address, and contact email of the person or company operating Wingdai. Required on the privacy policy before the app can be submitted to either app store. Cannot be guessed or looked up; must be supplied.

---

*This file should be updated whenever a decision in §11 is resolved (move it into §10), or when the phase in §2 advances.*