# VELORA

A premium fashion storefront and administration dashboard in one React application, backed by an Express API and MongoDB. This is a working portfolio store with fictional products and customers. All amounts are stored as integer USD cents; the API owns prices, discounts, stock, reservations, and payment outcomes.

## Run locally

Requires **Node.js 22.12+** and npm. No paid services or Docker are required for the local demo.

```sh
npm ci
npm run dev:local
```

Open **http://localhost:5173**. The API runs at **http://localhost:4000/api/v1**.

`npm run dev:web` starts only the browser application. If it is already running and catalog requests fail because the API/database are stopped, run `npm run dev:local:api` in another terminal. This starts the persistent local database and API while keeping the existing web server. Set `WEB_ORIGIN` to the browser's exact origin when using `http://127.0.0.1:5173` instead of `http://localhost:5173`; for PowerShell, use `$env:WEB_ORIGIN='http://127.0.0.1:5173'` before starting the API. For the complete application from a stopped state, use `npm run dev:local`.

The first launch downloads a MongoDB binary through `mongodb-memory-server`; allow network access and a little extra startup time. Despite the library name, this launcher uses a real MongoDB process, a single-node replica set, the WiredTiger storage engine, and persistent files in `.local/mongo`. Later launches keep your changes and only seed an empty database. Stop the launcher with Ctrl+C. Ports 5173, 4000, and 27018 must be available. Set `LOCAL_MONGO_PORT` to change the database port.

`.env` is optional for this launcher. If you create one from `.env.example`, use a unique signing secret for consistent access-token signing across restarts. Without one, each launch creates a temporary random key; valid database-backed refresh sessions can still restore sign-in. The local launcher supplies its own MongoDB URI. The API always reads the root `.env`, including when invoked through a workspace script.

### Demo accounts

| Role          | Email                   | Password          |
| ------------- | ----------------------- | ----------------- |
| Administrator | `admin@velora.local`    | `VeloraDemo2026!` |
| Customer      | `customer@velora.local` | `VeloraDemo2026!` |

Use **Demo payment** at checkout. It works without Stripe credentials and persists a paid order. API tests exercise declined mock payments and stock restoration. Seeded accounts are intended for local demonstrations only. Never deploy demo credentials.

### Use your own MongoDB or Docker database

```sh
cp .env.example .env
docker compose up -d mongo
npm run seed
npm run dev
```

On PowerShell, use `Copy-Item .env.example .env`. MongoDB is bound to loopback port 27017. The Compose health check initializes replica set `rs0`. The default URI uses `directConnection=true` so a host process can connect even though the replica-set member advertises its container hostname. A standalone MongoDB server is insufficient for transactional checkout.

`npm run seed` is idempotent and retains an existing catalog. To start again, use an empty database name in `MONGODB_URI`, or back up and reset your local database through your MongoDB tools. Do not point seeding commands at customer data.

## What is implemented

- Editorial storefront, responsive product listings, category/collection filters, search, sorting, pagination, product galleries, variants, stock availability, wishlist, and reviews.
- Guest cart persistence, authenticated cart synchronization, and guest-to-account cart merging.
- Registration, login, logout, session restoration, refresh-token rotation, profile/address updates, and password changes.
- Guest and account checkout, authoritative order previews, coupons, shipping choices, order snapshots, mock payment success/failure, and Stripe Checkout test integration.
- Transactional inventory reservations, payment-event deduplication, checkout idempotency, abandoned reservation expiration, and order ownership checks.
- Admin dashboard and database-backed charts; products, taxonomy, variants, inventory adjustments/movement history, orders, customers, and discounts management.
- Local product imagery, reproducible demo data, integration/unit tests, browser journey tests, container configuration, and CI.

## Project structure

```text
apps/
  web/src/
    app/                 Router, Redux store, provider composition
    layouts/             Storefront and admin layouts
    components/ui/       Shared Radix/shadcn-style primitives
    components/shared/   Tables, pagination, loading/error/empty states
    features/            Catalog, authentication, cart, checkout, account, admin
    lib/                 One API base and deterministic formatting helpers
  api/src/
    modules/             Cohesive domain services and HTTP routes
    models.ts            Persistence schemas and indexes
    http.ts              Shared validation, authentication and errors
    config.ts            Environment validation
    seed.ts              Idempotent fictional demo data
packages/contracts/src/  Shared Zod schemas, public DTOs and constants
scripts/                 Local replica-set launcher and seed helper
tests/e2e/               Essential browser journeys
infrastructure/nginx/    Same-origin API proxy and SPA/static serving
.github/workflows/       Automated quality checks
```

### Architecture decisions

One React app uses separate storefront and admin layouts and lazy-loaded routes. Feature modules own their UI, API endpoints, and local interactions. Redux Toolkit owns the persisted guest bag. RTK Query owns remote data, authentication/session state, and caching. URL parameters own shareable catalog filters; component-local state handles dialogs and transient forms. React Hook Form and shared Zod schemas validate genuinely identical browser/API input.

One API base centralizes cookies, requests, refresh recovery, and errors. Shared primitives include Button, Input, Select, Textarea, Field, Dialog, Badge, DataTable, Pagination, PageHeader, and consistent loading/error/empty states. Currency and date formatting are defined once.

The backend keeps HTTP concerns thin and commerce rules in domain modules. Mongoose models are server-only. The contracts package has no React, Express, or Mongoose dependency. No generic repository layer, extra state manager, or redundant service infrastructure is introduced.

The [architecture review](docs/architecture-review.md) records targeted responsibility and duplication refactors, customer-query improvements, and remaining architectural issues. Product and inventory writes live in catalog services, checkout owns its API endpoints, and pricing/settings share one commerce policy.

For final delivery evidence and remaining live-launch boundaries, read the [release review](docs/RELEASE-REVIEW.md). The [client handoff](docs/CLIENT-HANDOFF.md) provides a short setup and demonstration guide. Checkout exposes its configured methods and shipping policy through `/api/v1/checkout/options`.

Orders contain immutable item/price/address snapshots. Reservations decrement available stock with conditional updates inside MongoDB transactions. Payment resolution consumes or releases those reservations, and an explicit expiry routine restores abandoned stock. Unique checkout keys and payment-event IDs protect retries. Inventory adjustments are auditable records rather than silent mutations.

Access and refresh tokens use HttpOnly cookies. Passwords use Argon2. Server authorization checks every privileged operation and customer order read. Mutation origin checks, restrictive CORS, secure headers, bounded payloads, validation, and rate limiting cover cross-cutting HTTP concerns. Cookies become Secure in production; serve production traffic over HTTPS.

## Commands and tests

| Command             | Purpose                                                                 |
| ------------------- | ----------------------------------------------------------------------- |
| `npm run dev:local` | Start persistent local MongoDB, seed if empty, API, and Vite            |
| `npm run dev`       | Start API and Vite against configured MongoDB                           |
| `npm run seed`      | Populate an empty development database                                  |
| `npm run typecheck` | Strict TypeScript validation across workspaces                          |
| `npm run lint`      | ESLint                                                                  |
| `npm run build`     | Build contracts, compile the API, and create the Vite production bundle |
| `npm test`          | Domain unit and API integration tests                                   |
| `npm run test:e2e`  | Chromium browser journeys against an isolated replica set               |
| `npm run format`    | Apply Prettier formatting                                               |

Before the first browser test run:

```sh
npx playwright install chromium
npm run test:e2e
```

Browser tests start their own API, Vite server, and temporary MongoDB replica set on database port 27019. They seed isolated data and discard it after stopping. Stop the normal development servers before running these tests. Screenshots and traces are retained on failures. `E2E_USE_RUNNING_SERVER=true` is available for deliberate debugging against an already-running application; the default isolated launch is preferable for repeatable results.

If the Playwright browser download is unavailable in your region, `E2E_CHROMIUM_PATH` can point to an existing Chromium executable. The implementation environment used the installed Chromium revision 1208 through this option; it did not skip browser tests.

### Executed verification — 19 October 2026

| Check                    | Result                                                                                                                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`      | All three workspaces passed                                                                                                                                                           |
| `npm run lint`           | Passed                                                                                                                                                                                |
| `npm run format:check`   | Passed                                                                                                                                                                                |
| `npm run build`          | Contracts, compiled API, and web bundle passed                                                                                                                                        |
| `npm test`               | 29 unit/API tests passed against a real temporary MongoDB replica set                                                                                                                 |
| `npm run test:e2e`       | 9 Chromium journeys passed, including registration, session restoration, account/address/wishlist persistence, checkout, payment availability, admin CRUD and responsive route checks |
| Compiled API smoke check | `node apps/api/dist/server.js` served successful health and MongoDB catalog responses                                                                                                 |
| `npm audit`              | 0 reported vulnerabilities                                                                                                                                                            |

Desktop and mobile storefronts were also inspected in the browser. Guest-to-account cart merging and persisted wishlists were checked interactively. The mobile storefront capture is in [docs/preview-mobile.png](docs/preview-mobile.png). Docker execution and a live hosted Stripe test session were not verified; signed Stripe webhook fixtures were verified by the API suite.

The API integration suite uses a separate temporary replica set. Unit tests exercise shared validation and important price, discount, inventory, and order-transition rules. Browser tests cover catalog-to-cart, persisted mock checkout, admin product/inventory updates, and denied access. GitHub Actions runs typechecking, linting, builds, unit/API tests, and Chromium tests.

## Stripe test mode

Mock payments are the default local path. To exercise Stripe, put an `sk_test_…` key and a webhook signing secret in `.env`. Live Stripe secret keys are rejected by configuration validation.

```sh
stripe listen --forward-to localhost:4000/api/v1/payments/stripe/webhook
```

Copy the CLI-provided `whsec_…` value into `STRIPE_WEBHOOK_SECRET`, restart the API, choose Stripe at checkout, and complete the hosted test session using Stripe's test payment details. The verified webhook establishes payment status. A browser success redirect alone never marks an order paid. Stripe CLI and credentials are optional external tools and are not included in the repository.

## Containers

MongoDB-only Compose usage is shown above. To build the complete app:

1. Set a unique `JWT_SECRET` with at least 32 characters in `.env`.
2. Set `WEB_ORIGIN=http://localhost:8080` for the local container demo.
3. Start and seed the database, then start the app profile.

```sh
docker compose up -d mongo
docker compose --profile app build
docker compose --profile app run --rm -e NODE_ENV=development api npm run seed
docker compose --profile app up -d
```

Open **http://localhost:8080**. Nginx serves the static application and proxies `/api/` to Express on the same origin. Database data persists in the `mongo-data` Docker volume. The API container runs as a non-root user. The API build typechecks its source and uses esbuild to emit `apps/api/dist/server.js`, including shared contracts. Production runs that JavaScript directly with Node. `tsx` supports development and the explicit demo seed command.

Compose sets `TRUST_PROXY_HOPS=1` for its single Nginx hop so rate limits identify the forwarded client. Direct local runs default to `0`. Keep the API private behind that proxy; review the trusted-hop configuration if deployment adds another proxy or a direct route to the API.

For a public deployment, terminate TLS in front of Nginx, configure the public HTTPS origin, supply deployment-specific secrets, provision authenticated MongoDB with backups, and disable `ENABLE_MOCK_PAYMENTS`. The included Compose file is a development/deployment starting point and deliberately exposes MongoDB only on loopback. It is not a hardened managed database deployment.

Docker configuration is included, but the Docker CLI was unavailable in the implementation environment; container execution requires independent verification on a Docker-enabled host.

## SEO, imagery, and remaining scope

Public pages provide semantic markup, titles, descriptions, canonical URLs, and product structured data. The storefront is client-rendered Vite. Client-side metadata does not guarantee complete crawler or social-preview support. A production catalog should pre-render or server-render home, category, collection, and product routes; prerendering is evaluated as a next deployment step rather than implemented here.

Photographs are stored locally, so runtime catalog rendering does not depend on external image hosts. Source URLs, photographer credits, license links, and placeholder usage are documented in [image sources](apps/web/public/images/SOURCES.md). Several fictional products share photography; production merchandising needs accurate owned images for every variant.

This demo has no live payments, email delivery, password-reset email service, physical fulfillment integration, real tax engine, return/refund operations, or asset upload service. Newsletter subscriptions are persisted without an email provider. Shipping/tax rules are deterministic demonstration rules. Product images are managed as local paths or HTTPS URLs. Reservation expiry runs with the API process; a scaled deployment should use a separately scheduled worker. Production monitoring, backup recovery, regional tax/privacy requirements, and deployment-specific operations remain deployment work.
