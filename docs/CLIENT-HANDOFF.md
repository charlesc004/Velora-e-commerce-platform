# VELORA — demonstration handoff

This package contains the source of a working React storefront and admin workspace, an Express API, shared validation/contracts and MongoDB persistence. Products, customers and orders are fictional demonstration data. Mock checkout does not charge money or ship goods.

Use Node.js 22.12 or later. From the extracted project folder:

```sh
npm ci
npm run dev:local
```

Open **http://localhost:5173** and keep the terminal running. The first launch downloads a MongoDB binary and requires network access. Later launches retain changes in `.local/mongo`. Stop with Ctrl+C. Ports 5173, 4000 and 27018 must be free. For an already-running web-only server, `npm run dev:local:api` starts its local backend/database separately; see the README for exact-origin configuration.

| Role          | Email                   | Password          |
| ------------- | ----------------------- | ----------------- |
| Administrator | `admin@velora.local`    | `VeloraDemo2026!` |
| Customer      | `customer@velora.local` | `VeloraDemo2026!` |

A useful demonstration takes about five minutes:

1. Browse the storefront and use category, collection, size, color, stock and price filters. Open a product, choose a variant and add it to the bag.
2. Complete a guest checkout using fictional contact details and **Demo payment**. Reload the order page to verify persistence; keep the private guest order link.
3. Sign in as the customer to inspect account orders, wishlist and saved addresses. Guest bag contents merge during sign-in/registration.
4. Sign in as the administrator and visit `/admin`. Review the dashboard, products, inventory history, orders, customers, discounts, collections and categories. Adjust existing stock through Inventory so changes are audited.
5. Repeat the storefront/admin views at a narrow width to inspect the mobile layouts and navigation.

The checkout only offers payment providers configured on the API. Stripe test checkout requires the owner's separate test credentials and webhook configuration; no credentials are supplied in the archive. Real payments, actual tax/fulfillment services and production deployment are separate work.

The detailed [release review](RELEASE-REVIEW.md) records verification and limits. The [README](../README.md) contains setup, environment, testing and container instructions. The source archive deliberately contains no `node_modules`, running database, private `.env`, downloaded executables or test-session traces.
