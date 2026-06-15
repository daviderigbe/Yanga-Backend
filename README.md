# Elysia with Bun runtime

## Getting Started
To get started with this template, simply paste this command into your terminal:
```bash
bun create elysia ./elysia-example
```

## Development
To start the development server run:
```bash
bun run dev
```

Open http://localhost:3000/ with your browser to see the result.

## Kwik Dispatch Staging

Copy the Kwik variables from `.env.example` into the local `.env` file and provide the
staging account email/password. Keep `DISPATCH_MODE=manual` until credentials and
seller pickup addresses are ready, then change it to `live`.

Checkout now quotes and dispatches from the seller's `PICKUP` address to the buyer's
shipping address. If a seller has no `PICKUP` address, the backend falls back to that
seller's `SHIPPING` address. The pickup and dropoff addresses both need Lagos contact
phone numbers plus latitude/longitude for live Kwik dispatch. Multi-seller checkout is
blocked until split shipments are added.

The live Kwik flow uses:

- `POST /vendor_login` to obtain the API access token and account identifiers.
- `POST /send_payment_for_task` and `POST /get_bill_breakdown` for a delivery quote.
- `POST /v2/create_task_via_vendor` after Paystack payment verification.
- `GET /view_task_by_relationship_id` to sync delivery status.
- `POST /cancel_vendor_task` to cancel an active dispatch task.

Application endpoints are documented in Swagger under the `Dispatch` tag:

- `POST /api/dispatch/quote`
- `POST /api/dispatch/orders/:orderId/create`
- `POST /api/dispatch/orders/:orderId/sync`
- `POST /api/dispatch/orders/:orderId/cancel`
- `GET /api/dispatch/orders/:orderId/shipment`
- `PATCH /api/dispatch/shipments/:shipmentId/status`
