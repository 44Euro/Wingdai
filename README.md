# Wingdai

[![CI](https://github.com/44Euro/Wingdai/actions/workflows/ci.yml/badge.svg)](https://github.com/44Euro/Wingdai/actions/workflows/ci.yml)

**[อ่านฉบับภาษาไทย →](README.th.md)**

A food delivery platform for Thailand. One monorepo: a React Native (Expo) app that serves all four
roles, and a NestJS API on Postgres/PostGIS.

The whole product rests on one number. Delivery only pays for itself when the average trip is
1–1.5 km inside a single dense neighbourhood. At that distance a rider finishes 4–5 orders an hour
instead of about 2, and that efficiency is what funds a **15% commission instead of the 30–35%**
the big platforms charge. Restaurants that pay 15% don't need to inflate their menu prices, so the
customer pays what they'd pay walking into the shop.

Most of the odd-looking decisions further down exist to protect that number.

---

## Try it

**[▶ wingdai.vercel.app](https://wingdai.vercel.app)** — nothing to install, no signup. The login
screen has a one-tap test account for each role.

It's talking to a real deployment, not fixtures. The app calls
[the NestJS API](https://wingdai-api.vercel.app/api/health), which reads a live Postgres + PostGIS
database on Supabase.

| Role | Username | Password | What you get |
|---|---|---|---|
| Customer | `somchai` | `wingdai1234` | browse, cart, checkout, live tracking, receipts |
| Merchant | `malee` | `wingdai1234` | incoming orders, menu and stock, store hours, payouts |
| Rider | `rider_ann` | `wingdai1234` | go online, job offers, earnings, cash ceiling |
| Admin | `admin_root` | `wingdai1234` | exception queue, refunds, approvals, payouts |
| Super admin | `super_root` | `wingdai1234` | commission + fee config, feature flags, audit log |

<p align="center">
  <img src="docs/screenshots/00-login.png" width="180" alt="Login with one-tap demo accounts" />
  <img src="docs/screenshots/01-customer.png" width="180" alt="Customer home with nearby kitchens" />
  <img src="docs/screenshots/02-restaurant.png" width="180" alt="Restaurant menu with required options" />
  <img src="docs/screenshots/03-merchant.png" width="180" alt="Merchant order queue" />
  <img src="docs/screenshots/04-rider.png" width="180" alt="Rider jobs" />
  <img src="docs/screenshots/05-super.png" width="180" alt="Platform metrics against the targets in the spec" />
</p>

At boot the app pings `/api/health` and uses the API if it answers. If it doesn't (database asleep,
deploy mid-rollout) it falls back to in-memory seed data and puts a "demo mode" label on itself
instead of filling every screen with error toasts. That choice is made once, in
[`src/data/index.ts`](apps/mobile/src/data/index.ts), and no screen knows which source it got. Both
paths are tested, because a fallback nobody exercises is a fallback that doesn't work.

---

## What's built

One app, four roles. A role is a **capability on an account**, not a separate account type, so a
customer can open a restaurant and switch into the merchant stack without registering again, and a
rider can order food like anyone else.

| Role | Screens |
|---|---|
| Customer | browse, search, cart, checkout, PromptPay, live tracking, order history, receipts, report a problem, addresses, payment method |
| Merchant | order queue with accept countdown, order detail, menu + sold-out toggle, sales summary, restaurant registration |
| Rider | application + approval flow, go online/offline, 15-second job offers, active job, earnings + delivery history |
| Admin | exception dashboard, semi-automated refund decisions, restaurant and rider approvals, rider cash settlement, manual dispatch override |

On the server: auth (argon2id + JWT, login by username or phone, phone OTP, Google sign-in),
catalog, orders with a state machine, pricing, a double-entry ledger, auto-dispatch, refunds, admin.

---

## Decisions worth reading the code for

**Money is an integer number of satang, everywhere.** No floats anywhere between the API and the
ledger. A test fails on any non-integer amount.

**The ledger is double-entry and append-only.** Every completed order writes balanced entries in the
*same* `db.transaction()` as the order status change. Corrections are reversal entries, never an
`UPDATE`. The property test in
[`postOrder.test.ts`](services/core-api/src/ledger/postOrder.test.ts) generates a lot of order
shapes and asserts `debits === credits`. It's what caught a bug where the gateway fee was credited
to revenue, which made cash and PromptPay look equally profitable.

**The server computes every price. The client never sends one.** Order creation takes menu item ids
and quantities, nothing else. Otherwise a modified client could buy a ฿500 dish for ฿1, and the 15%
commission would be charged against the fake number. The restaurant would lose real money to a
value the customer typed.

**Auto-dispatch scores riders instead of racing them.** There's no shared job pool. Jobs go to one
rider at a time, 15 seconds each. The scoring formula in the product spec was unusable as literally
written (`1/distance` explodes as distance approaches 0, and the terms had incompatible units), so
[`scoring.ts`](services/core-api/src/dispatch/scoring.ts) normalises every term to 0–1 and
documents each deviation. Hard eligibility gates live in
[their own module](services/core-api/src/dispatch/eligibility.ts) so that a "never" can't be
outvoted by a high score.

**A Thai national ID is checked by its real checksum, not its length.** Any 13 digits pass a length
check; only 1 in 10 pass the checksum. Typos and invented numbers get caught before an admin ever
sees them. Expired licences and insurance are rejected at submission too, because otherwise
`eligibility.ts` quietly stops offering that rider jobs and they never find out why.

**Riders never front money.** Cash a rider collects is platform money sitting in `rider_cash_held`,
not a loan from the rider, and it flows back: an admin records the handover, which credits
`rider_cash_held` and debits `cash` in the same transaction as the balance change. Without that leg
a rider silently hits the ฿1,500 ceiling and never gets offered cash work again. That's the bug the
smoke suite was hiding by zeroing the column with raw SQL. And if a customer picks cash and then
can't pay, the app offers to switch the order to PromptPay. It never suggests transferring money to
the rider personally, because money that skips the ledger breaks daily reconciliation without
anyone noticing.

**"Unknown" is rendered as absent, never as a placeholder number.** A restaurant nobody has reviewed
shows no rating chip instead of a fake `★ 4.8`. A rider who has never been online gets `—` for
orders per hour instead of `0`, which reads as "did badly".

**Dark mode and Thai/English have been there since the first commit**, both built on semantic tokens
(`bg-surface`, `text-primary`, …) rather than raw palette values. Riders work at night and a bright
screen while driving is a safety problem. Retrofitting either one would have meant editing every
file in the app.

**Names are swapped at the data layer, not in the screens.** Shops, dishes and option groups each
carry an optional English name. When the app is in English,
[one function](apps/mobile/src/lib/localiseNames.ts) at the HTTP boundary substitutes it before the
data reaches any screen. There are fifty-odd places that render a name; if each one had to choose,
one of them would be wrong, and the one that's wrong is the one a user finds. A shop with no
English name falls back to Thai, because a missing name is worse than a name in the wrong language.

---

## Stack

| Layer | Choice | Why |
|---|---|---|
| App | React Native + Expo SDK 57 | one codebase, OTA updates through EAS |
| Navigation | React Navigation | one stack per role |
| Server state / client state | TanStack Query / Zustand | |
| Forms | react-hook-form + zod | |
| Maps | MapLibre + Protomaps | Google Maps bills per map load, and people stare at a tracking screen for minutes |
| API | NestJS 11 (Node 22) | modular monolith: auth, catalog, orders, payment, ledger, dispatch |
| DB access | Drizzle ORM | SQL-first, real transactions, a clean escape hatch to raw SQL for PostGIS |
| Database | Supabase Postgres + PostGIS | managed data plane only, no business logic in Edge Functions or plpgsql |
| Token storage | expo-secure-store | Keychain/Keystore. A 30-day session token shouldn't sit in a plain file |

Supabase Auth is deliberately not used. Login accepts a username *or* a phone number, and making
that work would have meant inventing fake email addresses. Auth is argon2id + JWT issued by the API.

---

## Running it

### Web (fastest, no native build)

```bash
cd apps/mobile
npm install
npm run web
```

It runs against an in-memory mock repository by default, so it works with no backend and no
database. On web it's framed to phone width, `maplibre-gl` replaces the native map renderer, the
session token falls back to `localStorage`, and Google sign-in is hidden rather than shown as a
button that would only error.

### iOS / Android

Needs a dev build. MapLibre, Google Sign-In and secure-store are native modules, so Expo Go won't
work.

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
EXPO_PUBLIC_WINGDAI_API_URL=http://localhost:3000/api npx expo start
```

Screens never import backend types. They go through
[`src/data/repositories`](apps/mobile/src/data/repositories), so swapping the mock repo for the HTTP
one is a one-file change.

### Deploying

Two Vercel projects, both from this repo:

```bash
# API — Vercel runs dist/main.js as a normal Node server, so the connection pool
# and the shutdown hooks in db.module.ts behave exactly as they do locally
cd services/core-api && vercel deploy --prod

# web — always through build:web, never a bare `expo export`
cd apps/mobile && npm run build:web
vercel deploy dist --prod
npm run verify:web -- https://wingdai.vercel.app
```

`build:web` chains `scripts/prepare-web.mjs`, which does two things a plain `expo export` doesn't.

Expo emits the bundled fonts under `assets/node_modules/...`, and Vercel drops every path containing
`node_modules` at upload time. A `!` line in `.vercelignore` can't bring back files inside a
directory that was excluded wholesale. So the script moves them to `assets/vendor/` and rewrites the
paths the bundle points at. Then it fails loudly if anything is still under `node_modules`, because
the failure mode is silent: fonts 404 and Latin text quietly falls back to a serif.

It also writes `dist/vercel.json` with the SPA rewrite. Uploading a prebuilt folder means
`apps/mobile/vercel.json` is never read, so without this every path except `/` returns 404. That
kills `restaurant/:id` and `order/:id` from `src/app/linking.ts`, the links the merchant QR screen
prints, and plain page refresh.

`npm run verify:web` checks all three against the deployed URL. Run it after every deploy.

---

## Tests

```bash
cd apps/mobile       && npx jest            # 936 tests — screens, stores, pricing, i18n, contrast
cd services/core-api && npm test            # 310 tests — ledger properties, dispatch scoring, refunds
cd services/core-api && npm run api:smoke   # checks against a live database
cd apps/mobile       && npm run api:check   # checks that the app's repo contract matches the API
```

The first two run in CI on every push. They need no database and no secrets, because they're pure
logic. CI also runs the whole demo data pipeline against a throwaway PostGIS container: seed, boot
the API, place orders, walk them to delivered. That job is there because every bug in that pipeline
used to surface only during a real 20-minute production run.

The last two need a live database and are run by hand. They're the ones that catch integration
mistakes, so they gate "done" rather than the build.

`api:check` has caught more real bugs than anything else here. It drives the same repository
interface the screens use against the running API, so a shape mismatch fails there instead of in the
UI.

---

## Not done yet

- **Real payments.** PromptPay and card are mocked screens. No gateway has been chosen, so no money
  moves. The ledger already models the gateway fee as its own account, so wiring a real provider is
  an integration, not a redesign.
- **SMS.** OTP codes are printed to the server log instead of being sent.
- **Automatic reconciliation.** The ledger is double-entry and correct, but the daily comparison
  against a gateway report isn't built. There's nothing to compare against yet.
- **Realtime.** Rider location and the merchant queue poll on an interval. The spec calls for
  WebSocket push and that swap hasn't happened.
- **Maps in production.** Tiles come from OpenStreetMap's raster server and routes from the public
  OSRM demo. Both are fine for a prototype and explicitly against policy for production traffic. The
  replacements (self-hosted `.pmtiles` and OSRM) are a hosting decision, not a code change.
- **Not in an app store.** The web build is public, but store submission needs a PDPA data
  controller identity, which is a legal fact rather than an engineering one. The consent screen is
  built and says so on its own face: it's a sample document, not a binding one.
- **Shared demo state.** Everyone hits the same database, so whatever one visitor changes the next
  visitor sees. A GitHub Actions cron wipes and reseeds it nightly at 02:00 ICT, which caps the
  damage at 24 hours, but inside a day visitors do see each other's edits.

Food and storefront photos come from Wikimedia Commons under CC BY / CC BY-SA / CC0. Every file,
photographer and licence is listed in [`docs/photo-credits.md`](docs/photo-credits.md), generated by
`npm run db:photos`.

---

## Repo layout

```
apps/mobile           React Native + Expo — role-based stacks, UI primitives, i18n
services/core-api     NestJS — auth, catalog, orders, ledger, dispatch, refunds, admin
docs/design           design system spec
docs/product-spec.md  the product and engineering rules the code is written against
```

Code comments are in Thai. They explain *why* a rule exists rather than restating what the line
does, since most of these rules cost money or trust when someone breaks them.
