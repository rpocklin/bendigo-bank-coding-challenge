# Architecture

Commission quote application for the lending take-home. Staff enter a loan and receive a commission quote. The third-party quote API does not exist yet, so this repo ships a mock that honours the agreed contract and a small application in front of it.

Timebox is about four hours. The design has to be a credible base for a later live-coding session. Anything that does not fit the timebox is written down here and left unbuilt.

## Shape

Three roles. Two production deployables: the internal API and the external API. The web server is a package. In production the internal API serves its build, so those two roles share one process.

| Role | Package | Development | Production |
| --- | --- | --- | --- |
| Web server | `apps/web` | Its own process, HTTP `5173`. Proxies `/v1` to the internal API | The built form, served by the internal API on `4443` |
| Internal API | `apps/server` | Its own process, HTTP `4000` | HTTPS `4443`. Also the web server. Validates the staff request, holds the vendor key, calls the external API |
| External API | `apps/mock-api` | Its own process, HTTP `3010` | Its own process, HTTPS `3443`. Requires an `api-key` header, prices the quote, and fails at random |

`SERVER_PORT` is 443 or 4443 in production. This machine cannot bind 443, so `env/production.json` uses 4443 with the self-signed certificate in `certs/`. The external port is always in `3000`–`3999`. The internal API trusts that same certificate when it calls `https://127.0.0.1:3443`.

`packages/contract` is the only shared module. It holds the decimal type, the currency table, the Zod schemas, and the English message catalog. It depends on Zod and nothing else. The web server, the internal API, and the external API import it. No app imports another app. The internal API reaches the external API only by `MOCK_API_BASE_URL` from `env/dev.json` or `env/production.json`. Those files also require `SERVER_PORT`, `MOCK_API_PORT`, and `MOCK_API_KEY`. Startup rejects a file that fails that schema.

The browser never sees the API key. The internal API is the only holder of that key.

```
development, three processes
browser --> web server :5173 --> internal API :4000 --> external API :3010

production, two processes
browser --> internal API :4443 (also serves the built web server) --> external API :3443
```

## Focus

Spend the time on these, in this order:

1. One exact decimal type, and the percentage convention for `commissionRate`.
2. Schemas, bounds, and error codes in `packages/contract`, emitted as OpenAPI 3.1.
3. The API key staying on the server, with failures the form can show.
4. A message catalog and currency exponent table so a second locale or currency is a data change.
5. Correlation ids and structured logs, which are small and make the later session easier.

Do not spend the timebox on a telemetry vendor, a retry framework, an idempotency store, or a second documentation UI.

## Financial model

`loanAmount`, `commissionRate`, and `totalCommission` share one domain type:

```ts
type ScaledDecimal = {
  readonly digits: bigint;
  readonly scale: number;
};
```

`digits` is a non-negative integer. `scale` is the count of fractional digits. The value is `digits / 10^scale`. JSON numbers and TypeScript `number` are not used for these fields. On the wire each one is a canonical decimal string: no exponent, no leading zeros, no sign, and exactly `scale` digits after the point. Wrong scale, extra digits, and padding are rejected. They are not normalised.

Currency is not inside `ScaledDecimal`. A rate has no currency. The two money fields take their scale from a currency table.

```ts
type Currency = {
  readonly code: "AUD";
  readonly exponent: 2;
};
```

Version 1 of the table contains AUD only. `loanAmount` must use that currency's exponent. Adding a currency means adding a row, not editing the arithmetic. JPY (exponent 0) and BHD (exponent 3) are the cases that row has to be able to express later.

`commissionRate` is a percentage, not a fraction of one. Staff and the brief talk about a rate as a percent. `1.50000` means 1.5%. `100.00000` means 100%. `32.12345` is a legal shape. The mock returns `0.50000`, `1.00000`, and `1.50000` for LOW, MEDIUM, and HIGH. The schema allows any percentage from `0.00001` to `100.00000` at scale 5, so a real vendor can return another rate without a contract change. Zero is rejected.

The percentage scale is 5 because that is enough for `32.12345` and it is fixed in one constant, `RATE_SCALE`. A rate that needs a sixth fractional digit is a contract change.

Commission is:

```
total = loanAmount * (commissionRate / 100)
```

Division by 100 is a scale shift of +2. It does not divide the digits and it does not round. Multiplication adds scales and multiplies digits.

```
total.scale = currency.exponent + RATE_SCALE + 2
```

For AUD that is 2 + 5 + 2 = 9. `10000.00` at `1.50000` percent is `150.000000000`. `100.01` at `0.50000` percent is `0.500050000`. Both are exact.

`totalCommission` is stored and returned at that full scale. The UI may group digits for display. It sets `Intl.NumberFormat` minimum and maximum fraction digits to the value's scale so the formatter cannot round. A second, rounded "dollars and cents" figure is a presentation change we have not made.

There is one implementation of parse, format, multiply, and scale-shift, in `packages/contract`. Route handlers do not do arithmetic.

## Internationalisation

Errors are a stable code plus a catalog sentence.

```json
{
  "code": "invalid_request",
  "message": "Enter a loan amount in AUD with 2 decimal places.",
  "details": [
    {
      "field": "loanAmount",
      "code": "invalid_amount",
      "params": { "currency": "AUD", "scale": 2 }
    }
  ]
}
```

`code` and `details[].code` are enums. Agents branch on them. `message` is the English sentence for a client that does not localise. The web app looks up the same code in the catalog for its locale and falls back to `message`.

The catalog ships as `en` in `packages/contract`. The server reads `Accept-Language`, serves `en`, and falls back to `en`. It sets `Content-Language`. A new locale is a new catalog file with the same keys. Logs stay on the error code, in English field names, so a locale change does not split operations.

Currency display uses `Intl.NumberFormat` with the request locale and the ISO currency code. The API does not return `"$10,000.00"`. Formatting stays in the web package.

No field on the quote is optional and none have defaults. A missing `currency` is invalid. It is not assumed to be AUD.

## HTTP

The internal API and the external API expose the same paths on different hosts. Development is HTTP. Production is HTTPS with `certs/localhost-cert.pem`. The internal API trusts that certificate only when it calls the external API.

| Mode | Web server | Internal API | External API |
| --- | --- | --- | --- |
| Development | http://127.0.0.1:5173 | http://127.0.0.1:4000 | http://127.0.0.1:3010 |
| Production | https://127.0.0.1:4443, served by the internal API | https://127.0.0.1:4443 | https://127.0.0.1:3443 |

In development the web server proxies `/v1` to `4000`. It does not proxy to the external API. Port `443` is not used: this machine cannot bind it, so the production internal API listens on `4443`.

| Method and path | Purpose |
| --- | --- |
| `POST /v1/quotes` | Create a quote. `operationId`: `createQuote`. JSON body required. |
| `GET /v1/openapi.json` | OpenAPI 3.1 for agents and for the committed spec. Omitted when docs are off. |
| `GET /v1/docs` | Scalar, rendering that same document for humans. Omitted when docs are off. |
| `GET /health` | Process is up. It does not call the other service. |

The mock documents `api-key` as a header security scheme. The server document does not mention that header.

Request body:

| Field | Type | Rule |
| --- | --- | --- |
| `currency` | enum | `AUD` in v1 |
| `loanAmount` | decimal string | Scale equals the currency exponent. For AUD, `0.01` through `10000000.00` |
| `loanTermInMonths` | integer | 1 through 360 |
| `riskBand` | enum | `LOW`, `MEDIUM`, `HIGH` |

Response body adds `quoteId` (UUID), `commissionRate` (percentage, scale 5), and `totalCommission` (scale 9 for AUD), and repeats `currency`.

Unknown JSON keys are rejected. `loanTermInMonths` stays a JSON integer because every legal value is well inside the safe integer range.

### Error codes

| HTTP | `code` | When |
| --- | --- | --- |
| 400 | `invalid_request` | Schema, scale, bounds, unknown keys, missing body |
| 401 | `unauthorized` | Mock API key missing or wrong. Checked before a simulated failure |
| 403 | `forbidden` | Mock only. The key is not allowed to price. The server maps this to 500 `vendor_unavailable` |
| 404 | `not_found` | No staff route matches. A vendor 404 is mapped to 500 `vendor_unavailable` |
| 429 | `rate_limited` | Downstream 429. `Retry-After` is forwarded when present |
| 500 | `vendor_unavailable` | Mock failure, a vendor 403 or 404, connection failure, or a body we refuse to parse |
| 500 | `internal_error` | An unexpected exception in the staff API. The response does not include the exception |
| 503 | `service_unavailable` | The vendor cannot price right now. `Retry-After` is forwarded when present |
| 504 | `vendor_timeout` | Server deadline exceeded. Deadline is 2 seconds |

The server never returns the API key, a stack trace, or the mock's raw body.

## Correlation, idempotency, and backoff

`x-correlation-id` is in scope. If the inbound value is a UUID, both services use it and return it. Otherwise they generate one. The server sends the same value to the mock. Every log line includes it. Arbitrary client text is not copied into logs.

`Idempotency-Key` is not in scope. A quote is not stored, so accepting the header would promise a replay we cannot honour. A double submit creates two quotes with two ids. The form disables the button while a request is in flight. That is the whole protection in v1.

The future shape, when a store exists: the server saves the response under the key for 24 hours, replays it for the same body, and returns 409 for the same key with a different body. Until that exists the server calls the mock once.

Backoff is specified and not built. There is no automatic retry. A retry of a non-idempotent create can double the quote. When idempotency exists, the policy is at most two extra attempts, only on 429 and 503, waiting for `Retry-After` when it is present, otherwise exponential backoff with jitter. 400 and 401 are never retried.

Throttling is not built. We do not add a token bucket to the mock. We do map a 429 so the client path is real when a vendor starts sending one.

`FAILURE_RATE` on the mock is the random-failure control. Tests pass a rate into the app factory. There is no public simulate header and nothing about failure injection in the OpenAPI document.

## Logging and telemetry

Each service writes one JSON object per line to stdout:

`time`, `level`, `service`, `msg`, `correlationId`, `method`, `path`, `status`, `durationMs`.

The `api-key` header is redacted. Request and response bodies are not logged. There is no third-party logger and no OpenTelemetry SDK in v1. Those fields are the telemetry contract. An exporter can wrap them later without changing the routes.

The performance check is a Vitest smoke inside `apps/server`: 100 in-process quote calls with failure rate 0, all succeeding, total under two seconds. It catches accidental hot-path work. It is not a capacity test and it is not a service-level objective.

## Documentation

Route documentation is the OpenAPI operation: summary, `operationId`, examples, security, and the error responses. `@hono/zod-openapi` emits OpenAPI 3.1 from the Zod schemas at `GET /v1/openapi.json`.

Scalar (`@scalar/hono-api-reference`) is mounted at `GET /v1/docs` and reads that document. Swagger UI is not mounted. `env/dev.json` sets `docs` to true, and `yarn dev` loads it. `env/production.json` sets `docs` to false, and `yarn start` loads it. With docs off, both `/v1/docs` and `/v1/openapi.json` are absent. The committed `openapi.json` files are still produced by the check, which builds the app with docs on.

Each app commits `openapi.json`. A check regenerates the document and fails if the file changed. The web package does not publish a third spec.

The runtime picture is the Mermaid in this folder: `overview.mmd`, `sequence-success.mmd`, and `sequence-failure.mmd`. `overview.mmd` shows the processes. The sequence diagrams show one quote: the form in the browser, the internal API, and the external API. The web server delivers the form and is not a hop in those sequences. This prose does not keep a second copy.

## Repository

```
README.md                         how to run the app, written in the documentation phase
.env.example                      development ports: staff 4000, mock 3010, form 5173
env/dev.json                      development runtime: HTTP 4000 and HTTP 3010
env/production.json               production runtime: HTTPS 4443 and HTTPS 3443
certs/                            self-signed certificate for both production listeners
apps/mock-api/                    Hono server, pricing, its openapi.json
apps/server/                      Hono server, mock client, its openapi.json, serves the UI
apps/web/                         Vite + React form and the locale-aware display
packages/contract/                ScaledDecimal, currencies, schemas, en catalog
docs/README.md                    index of the internal docs
docs/requirements.md              the take-home brief
docs/PHASES.md                    phases and gates
docs/DESIGN.md                    the quote screen
docs/architecture/ARCHITECTURE.md this design
docs/architecture/*.mmd           architecture and sequence diagrams
```

Yarn 4 workspaces (`apps/*`, `packages/*`) with the `node-modules` linker. Root scripts only delegate. `yarn workspace @quote/mock-api ci` checks that app alone. `yarn ci` runs every workspace `ci` script.

Package names: `@quote/contract`, `@quote/mock-api`, `@quote/server`, `@quote/web`, and `@quote/integration` for the backend test that calls the running mock.

## Risks

| Risk | Why it matters | What we do |
| --- | --- | --- |
| Scale-9 commission looks like a bug | Reviewers expect cents | The worked examples in tests are `150.000000000` and `0.500050000`. The README says display must not round |
| Percent and fraction get mixed | `1.5` and `0.015` differ by 100× | The field is documented as a percentage. Tests assert `1.50000` for the HIGH band |
| Currency exponent hardcoded as 2 | The next currency silently mis-scales | Exponent is read from the currency table. AUD is the only row |
| Catalog and error codes drift | The UI shows a raw code or the wrong sentence | The catalog's keys are the error-code enum. A test fails if a code has no English sentence |
| Shared package hides a vendor boundary | The real vendor will publish their own spec | Apps never import each other. Replacing the mock client means checking their document instead of our schema |
| Double submit creates two quotes | Idempotency is deferred | The button is disabled while in flight. The README states the gap |
| Client-supplied correlation ids | Log injection, confused traces | Only UUIDs are propagated. Anything else is replaced |
| Docs drift from routes | Agents call a stale contract | Committed OpenAPI, regenerate-and-diff |
| Timebox gets eaten by platform work | The form never ships | OTel, retries, idempotency storage, and a rate limiter are specified here and not built |

## Assumptions that the brief left open

- Currency is AUD, carried on the payload as a required field.
- Term is 1 to 360 months. Amount is `0.01` to `10000000.00` AUD.
- Commission percentages for the three bands are 0.5, 1.0, and 1.5. They are a stand-in formula, not the future vendor's tariff.
- Our own API has no staff login. The key protects the mock only.
- Quotes are not stored.
