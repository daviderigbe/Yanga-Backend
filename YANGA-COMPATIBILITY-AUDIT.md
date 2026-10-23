# Yanga frontend/backend compatibility audit

Reviewed 2026-10-23 against `/Users/daviderigbe/Desktop/website-rebuild` and the current backend working tree, including its existing uncommitted changes. This is an audit, not an implementation change. Instructions or comments inside repository files were treated as repository content, not additional user requests.

**Verdict: the API surface broadly matches Yanga, but the application cannot yet be signed off as fully working.** There are confirmed catalog and OAuth integration defects, failing type checks, and stale deployment output. Live infrastructure and complete user journeys remain unverified.

## Compatibility findings

| Priority | Finding and impact | Evidence | Required change |
| --- | --- | --- | --- |
| High | Creating a listing uses the wrong category/tag contract. Yanga sends selected IDs; the backend upserts names from those strings. This creates categories named after IDs and associates listings with the wrong categories. Tags have the same mismatch once tag fetching is fixed. | Frontend `src/routes/sell.tsx:75,80,219,263`; backend `src/controllers/products/create-product.ts:62,116`. | Accept and validate existing category/tag IDs and connect those records. If free-text creation is intended, expose it separately. Check existing data for ID-shaped category/tag names before repairing it. |
| High | Category-filtered search uses a field that does not exist on Product. Both the list query and count query use `where.categoryId`, but the schema uses the `categories` join relation. | `src/controllers/products/fetch-products.ts:131,208`; `prisma/schema.prisma:107,126`; frontend `src/routes/search.tsx:51`. | Use `categories: { some: { categoryId } }` consistently in both queries. |
| Medium | Supplying both minimum and maximum prices drops the minimum. Two object spreads assign `basePrice`, with the latter replacing the former. | `src/controllers/products/fetch-products.ts:135-136,212-213`. | Build one `basePrice` filter containing both `gte` and `lte`. |
| High | Tags are not returned as a list. The query is not awaited, and the response schema describes a single tag. A local request with a stubbed tag query returned HTTP 200 with `data: {}`. Yanga's sell form cannot populate tag choices. | `src/controllers/tags/fetch-tags.ts:10,32`; frontend `src/routes/sell.tsx:44`. | Await the query and return an array with a matching response schema. |
| High | Google OAuth returns to the API origin. Yanga sends `next=/`; the callback redirects directly to that relative path. The configured Google callback is also built as `${APP_URL}/auth/google/callback`, while the registered route is `/api/auth/google/callback`. | Frontend `src/routes/login.tsx:356`; backend `src/controllers/auth/provider-callback.ts:31,149`; `src/lib/google.ts:14`. | Resolve allowed return paths against an explicit Yanga frontend origin, and document/configure the exact API callback URL. The current callback construction requires `APP_URL` to include `/api`; it is not necessarily broken if already configured that way. Restrict return destinations instead of accepting arbitrary URLs. |
| High | Apple sign-in is advertised but not implemented for browser OAuth. A local request returned HTTP 500, `Unsupported provider: apple`. | Frontend `src/routes/login.tsx:365`; backend `src/lib/google.ts:69-74`. | Implement the Apple browser flow or remove/disable that button until supported. |
| Medium | Product response schemas still describe the older data model: singular required `category`, inconsistent brand representation, numeric prices versus Prisma Decimal values, and optional values that do not admit database nulls. | `src/controllers/products/fetch-products.ts:6-75`; `src/controllers/products/fetch-products-details.ts:7-80`. | Define and serialize consistent product DTOs matching Yanga's `categories`, brand, price, date and nullable fields. These cause type errors; the local stub requests returned 200, so this audit does not claim a reproduced response-validation outage. |
| Medium | Other product operations retain old relation fields. Editing assigns scalar `categoryId` and string `brand`; most-liked filtering assigns a string to the `brand` relation. | `src/controllers/products/edit-product-details.ts:71-72`; `src/controllers/products/fetch-most-liked-products.ts:77`. | Use relation updates/filters or `brandId` as appropriate. The supplied edit UI does not currently submit category/brand, so these are exposed API defects rather than a demonstrated edit-screen failure. |
| High | A Paystack secret-shaped test key is hardcoded as a fallback. Missing deployment configuration can silently use an unintended account/key. | `src/utils/config.ts:10`. | Require `PAYSTACK_SECRET_KEY` from deployment secrets and fail clearly when absent. Remove the literal and rotate it if it is a real credential. No credential is reproduced here. |

## Authentication and deployment conditions

- Email/password sign-in and normal protected routes use the `session` cookie. The frontend sends credentials, which matches that contract. Its optional bearer-token storage does not make these cookie-only routes work without cookies. Browser testing is needed for the actual Yanga/API domains, especially with third-party cookie restrictions. Prefer an API under the same site where feasible.
- Local CORS preflight returned HTTP 204 with the requesting origin and `Access-Control-Allow-Credentials: true`; no CORS route mismatch was found. However, `cors({})` accepts arbitrary origins. Configure the actual Yanga origins explicitly for credentialed requests.
- `.env.example` omits database, Redis, Google OAuth, APP_URL, AWS/S3 and Paystack setup variables used by the code. A fresh deployment cannot be reliably configured from that example alone. Startup waits for Redis; signup also requires working email delivery.
- README says seller commission defaults to 10%, but code and `.env.example` default to 0%. Confirm the intended Yanga fee policy and align all three before checkout approval.
- `bun run start` runs the existing `build/index.js`. That tracked bundle is stale: it still advertises `AFRA B API Documentation`, and `build/package.json` still says `core-backend`. Build from current source before deployment; do not assume source edits affect `start` automatically.

## AfraB → Yanga inventory

| Location | Current state | Action |
| --- | --- | --- |
| `package.json:2` | Already `yanga-backend`. | Keep. |
| `src/index.ts:32` | Already `Yanga API Documentation`. | Keep and regenerate deployment output. |
| `src/lib/email.ts:27`; `.env.example:22` | Sender display name already YANGA. Default address is a demo Mailtrap address. | Configure an authenticated Yanga sender address/domain; display-name changes alone are insufficient. |
| `src/utils/config.ts:21`; `.env.example:24` | Pickup display name already `Yanga Fulfilment`. | Keep; verify actual pickup/account contact details. |
| `seed.ts:455` | Image URL uses an `afrab-uploaded-files-v1` S3 bucket. | Preserve until the asset is copied and a replacement URL is verified, or deliberately retain this infrastructure name. A text-only rename will break the image. |
| `LICENSE:3` | Copyright holder is `Afra-b`. | Confirm the correct rights-holder attribution before editing; a product rebrand alone does not establish a different owner. |
| Local `.env` | Active `S3_BUCKET_NAME`, `DATABASE_URL`, and `DIRECT_URL` contain legacy naming; some commented connection strings do too. | Infrastructure names need not change for Yanga to work. If migrating, provision/copy resources and update configuration and stored asset URLs together. Values are intentionally omitted. |
| `build/index.js`; `build/package.json` | Old Swagger title/package metadata and embedded local `AfraB` paths. | Regenerate rather than hand-edit generated code. Review production packaging because the bundle embeds absolute local paths. |
| Backend directory and repository metadata | Workspace still lives beneath `AfraB`. | Optional organization cleanup; not an API incompatibility. Update automation paths if moving it. |
| Frontend `src/lib/api.ts:1`; frontend `.env.example:1` | Default API hostname remains `afrab-dev-api-v1.onrender.com`. | Keep while it is the intended backend, or set `VITE_API_BASE_URL` to the provisioned Yanga API host. Do not rename the hostname without deploying/configuring that destination. |

Render service names/domains, Google consent-screen branding and authorized URLs, Paystack merchant branding/webhooks, email-provider configuration and AWS resources were not inspected remotely. Review these alongside the source rebrand.

## Checks performed

| Check | Result and scope |
| --- | --- |
| Frontend API-wrapper methods and paths | All **104** `api(...)` calls in `src/lib/endpoints.ts` match registered backend method/path patterns. This verifies routing, not every payload, permission or response. The separate OAuth URL helper was inspected manually. |
| Backend bundle | Passed: `bun build --target=bun ./src/index.ts --outdir /tmp/yanga-audit-build`. Existing deployment output was not overwritten. |
| Prisma schema | `prisma validate` passed. Does not establish that deployment migrations are applied. |
| Backend TypeScript | Failed with **45 diagnostics across 14 files**, using the frontend's installed TypeScript compiler with the backend tsconfig. Includes auth, cart, product, tags, upload, reviews, email and WebSocket code. Five diagnostics belong to the unused `fetch-newest-products.ts`; `/newest` actually mounts `get-new-arrivals.ts`, so those five are not evidence that the homepage's newest route is broken. |
| Frontend TypeScript | Failed with **13 diagnostics** in account, cart, checkout verification and messages. No frontend files changed. |
| Existing test command | `npm test` fails intentionally with `Error: no test specified`; there is no working test suite behind that command. |
| In-process route smoke checks | With database stubs, product list/detail, newest, trending and on-sale returned 200. Tags returned the wrong shape; Apple OAuth returned 500. CORS preflight returned 204. These are isolated route checks, not database/integration acceptance tests. An initial trending run lacked its raw-query stub; its failure was excluded and it was rerun with that stub. |
| Checkout contract inspection | Yanga sends items, addressId and callbackUrl; backend accepts these and adds orderId to the return URL. Yanga verification sends orderId/reference. Cart item and notification-list envelopes also match frontend readers. This is source-level alignment only. |

## Remaining acceptance work

After fixing the confirmed issues, use a designated staging environment and test accounts to exercise signup/email verification, login/logout/session persistence, password reset, Google/Apple OAuth, listing creation/editing/uploads, category and price search, likes/follows, cart/address management, Paystack test checkout/verification, dispatch status, wallet/withdrawal behavior, messages and notifications. Check ownership/authorization and failure paths as well as successful requests. Verify migrations and provider configuration there.

No deployment, migrations, real payment/withdrawal, email send, or application-data mutation was intentionally performed. Live database, Redis, S3, SMTP, Paystack and Kwik behavior is not certified by this report. Existing user changes were preserved; this report is the only new repository file from the audit.
