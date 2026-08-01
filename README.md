# Wingdai

A hyperlocal food-delivery platform for Thailand — React Native (Expo) app and a NestJS API on
Postgres/PostGIS, built as a single monorepo.

> แพลตฟอร์มส่งอาหารแบบโซนหนาแน่น — แอปเดียวรองรับลูกค้า ร้าน ไรเดอร์ และแอดมิน

The product thesis is what drives the engineering: deliveries only pay for themselves when the
average trip is 1–1.5 km inside one dense zone. Short trips let a rider finish 4–5 orders an hour
instead of ~2, and that efficiency is what funds a **15% commission instead of the industry's
30–35%** — which means restaurants don't inflate menu prices, which means the customer pays the
same price as walking into the store.

Most of the non-obvious decisions below exist to protect that.

---

## What's built

One React Native app serves four roles. Roles are **capabilities on an account**, not separate
account types — a customer can open a restaurant and switch into the merchant stack without
re-registering, and a rider can also order food.

| Role | Screens |
|---|---|
| Customer | browse, search, cart, checkout, PromptPay, live tracking, order history, receipts, report a problem, addresses, payment method |
| Merchant | order queue with accept countdown, order detail, menu + sold-out toggle, sales summary, restaurant registration |
| Rider | application + approval flow, go online/offline, 15-second job offers, active job, earnings + delivery history |
| Admin | exception dashboard, semi-automated refund decisions, restaurant and rider approvals, manual dispatch override |

Backend: auth (argon2id + JWT, username-or-phone login, phone OTP, Google sign-in), catalog,
orders with a state machine, pricing, double-entry ledger, auto-dispatch, refunds, admin.

---

## Decisions worth reading the code for

**Money is an integer number of satang, everywhere.** No floats anywhere between the API and the
ledger. There is a test that fails on any non-integer amount.

**The ledger is double-entry and append-only.** Every completed order writes balanced entries in
the *same* `db.transaction()` as the order status change. Corrections are reversal entries, never
`UPDATE`. The property test in [`postOrder.test.ts`](services/core-api/src/ledger/postOrder.test.ts)
generates many order shapes and asserts `debits === credits` — it's what caught a bug where the
gateway fee was being credited to revenue, making cash and PromptPay look equally profitable.

**The server computes every price; the client never sends one.** Order creation takes menu item
ids and quantities. A modified client could otherwise buy a ฿500 dish for ฿1, and the 15%
commission would be charged against the fake number — the restaurant would lose real money to a
value the customer typed.

**Auto-dispatch scores riders instead of racing them.** No shared job pool: jobs are offered to one
rider at a time, 15 seconds each. The scoring formula in the product spec was unusable as literally
written (`1/distance` explodes as distance → 0, and the terms had incompatible units), so
[`scoring.ts`](services/core-api/src/dispatch/scoring.ts) normalises every term to 0–1 and
documents each deviation. Hard eligibility gates live in a
[separate module](services/core-api/src/dispatch/eligibility.ts) so a "never" can't be outvoted by
a high score.

**A Thai national ID is checked by its real checksum, not its length.** Any 13 digits pass a
length check; only 1 in 10 pass the checksum, so typos and invented numbers are caught before an
admin ever sees them. Expired licences and insurance are rejected at submission too — otherwise
`eligibility.ts` would silently stop offering that rider jobs and they would never learn why.

**Riders never front money.** Cash collected by a rider is platform money held in
`rider_cash_held`, not a loan from the rider. If a customer picks cash and can't pay, the app
offers to switch that order to PromptPay — it never suggests a personal transfer to the rider,
because money that skips the ledger silently breaks daily reconciliation.

**"Unknown" is rendered as absent, never as a placeholder number.** A restaurant nobody has
reviewed shows no rating chip rather than a fake `★ 4.8`; a rider who has never been online gets
`—` for orders/hour rather than `0`, which reads as "did badly".

**Dark mode and Thai/English from the first commit**, both through a semantic token layer
(`bg-surface`, `text-primary`, …) rather than raw palette values. Riders work at night; a bright
screen while driving is a safety issue. Retrofitting either would mean editing every file.

---

## Stack

| Layer | Choice | Why |
|---|---|---|
| App | React Native + Expo SDK 57 | one codebase, OTA updates via EAS |
| Navigation | React Navigation | a stack per role |
| Server state / client state | TanStack Query / Zustand | |
| Forms | react-hook-form + zod | |
| Maps | MapLibre + Protomaps | Google Maps bills per map load, and tracking screens are stared at for minutes |
| API | NestJS 11 (Node 22) | modular monolith: auth, catalog, orders, payment, ledger, dispatch |
| DB access | Drizzle ORM | SQL-first, real transactions, clean raw-SQL escape hatch for PostGIS |
| Database | Supabase Postgres + PostGIS | managed data plane only — no business logic in Edge Functions or plpgsql |
| Token storage | expo-secure-store | Keychain/Keystore; a 30-day session token must not sit in a plain file |

Supabase Auth is deliberately **not** used: login accepts a username *or* a phone number, which
would mean faking synthetic emails. Auth is argon2id + JWT issued by the API.

---

## Running it

### Web (fastest — no native build needed)

```bash
cd apps/mobile
npm install
npm run web
```

The app runs against an in-memory mock repository by default, so it works with no backend and no
database. On web it is framed to phone width; `maplibre-gl` replaces the native map renderer, the
session token falls back to `localStorage`, and Google sign-in is hidden rather than shown as a
button that would error.

### iOS / Android

Needs a dev build — MapLibre, Google Sign-In and secure-store are native modules, so Expo Go
won't work.

```bash
cd apps/mobile
npx expo run:ios     # or: npx expo run:android
```

### With the real API

```bash
cd services/core-api
cp .env.example .env        # fill in DATABASE_URL / DATABASE_POOL_URL / JWT_SECRET
npm install && npm run db:setup && npm run db:seed
npm run dev

# then point the app at it
cd ../../apps/mobile
WINGDAI_API_URL=http://localhost:3000/api npx expo start
```

Screens never import backend types directly — they go through
[`src/data/repositories`](apps/mobile/src/data/repositories), so swapping the mock repo for the
HTTP one is a one-file change.

---

## Tests

```bash
cd apps/mobile       && npx jest            # 347 tests — screens, stores, pricing, i18n, contrast
cd services/core-api && npm test            # 112 tests — ledger properties, dispatch scoring, refunds
cd services/core-api && npm run api:smoke   # 178 checks against a live database
cd apps/mobile       && npm run api:check   # 65 checks that the app's repo contract matches the API
```

`api:check` is the suite that has caught the most real bugs — it drives the same repository
interface the screens use against the running API, so a shape mismatch fails there rather than in
the UI.

---

## Not done yet

An honest list, because a portfolio that claims to be finished is easy to disprove:

- **Rider cash settlement.** `cash_held_satang` only ever increases; there is no settlement path,
  so a rider is eventually cut off from cash orders.
- **Payouts and reconciliation.** The ledger is correct and double-entry, but the weekly payout run
  and daily gateway reconciliation aren't built.
- **Real payments.** PromptPay is a mocked QR screen — the payment gateway hasn't been chosen.
- **SMS.** OTP codes are returned in the dev response instead of being sent.
- **File storage.** Rider ID/licence photos and delivery-confirmation photos have no upload path,
  so the rider application collects every field except the document images and says so on screen.
- **Realtime.** Rider location and the merchant queue poll on an interval; the spec calls for
  WebSocket push and that swap hasn't happened.
- **Rider↔customer contact.** Riders currently have no way to reach customers. The intended design
  is masked/proxy numbers, which needs the same telephony vendor as SMS.

---

## Repo layout

```
apps/mobile          React Native + Expo — role-based stacks, UI primitives, i18n
services/core-api    NestJS — auth, catalog, orders, ledger, dispatch, refunds, admin
docs/design          design system spec
CLAUDE.md            product and engineering rules the code is written against
```

Code comments are in Thai. They explain *why* a rule exists rather than restating what the line
does, since most of these rules cost money or trust when they're broken.
