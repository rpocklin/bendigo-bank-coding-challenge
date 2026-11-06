# Commission Quote Application

Staff enter loan details and receive a commission quote. The third-party quote API is not available yet, so this repo runs a mock of it.

There are three roles:

| Role | Package | What it does |
| --- | --- | --- |
| Web server | `apps/web` | Serves the quote form |
| Internal API | `apps/server` | Validates the staff request, holds the vendor key, and calls the external API |
| External API | `apps/mock-api` | The vendor stand-in. Requires an `api-key` header |

The browser talks to the web server and the internal API. The internal API is the only caller of the external API, and it is the only process that holds the key.

Development runs each role as its own process. Production builds the form, and the internal API serves that build, so the web server and the internal API share one process. The external API stays its own process.

Internal design lives in [docs/README.md](docs/README.md).

## Prerequisites

- Node.js 22 or newer
- Yarn 4, through Corepack

```bash
corepack enable
corepack prepare yarn@4.10.3 --activate
```

## Run

```bash
yarn install
yarn dev
```

Ports, the mock base URL, and `MOCK_API_KEY` are required in `env/dev.json` and `env/production.json`. `.env.example` lists the same fields. Startup reads the JSON file for the current mode and exits if a field is missing or invalid. There is no fallback port or key in the server.

Development (`yarn dev`, HTTP) runs three processes:

| URL | Role |
| --- | --- |
| http://127.0.0.1:5173 | Web server. Vite proxies `/v1` to the internal API |
| http://127.0.0.1:4000/v1/docs | Internal API, Scalar. Served only when docs are enabled |
| http://127.0.0.1:4000/v1/openapi.json | Internal API, OpenAPI 3.1. Same switch as the page above |
| http://127.0.0.1:3010/v1/docs | External API, Scalar. Served only when docs are enabled |
| http://127.0.0.1:3010/v1/openapi.json | External API, OpenAPI 3.1. Same switch as the page above |

Production (`yarn start`, HTTPS) runs two processes:

| URL | Role |
| --- | --- |
| https://127.0.0.1:4443 | Web server and internal API. One process serves the built form and the API |
| https://127.0.0.1:3443 | External API. Only the internal API calls this |

`yarn dev` reads `env/dev.json`, which sets `"docs": true`. The web server, the internal API, and the external API listen over HTTP.

`yarn start` reads `env/production.json`. It builds the form and the internal API serves that build and the API together at https://127.0.0.1:4443. Port 443 is not available without root, so production uses 4443. The external API listens on https://127.0.0.1:3443. The internal API calls that address and trusts the same self-signed certificate (`certs/localhost-cert.pem`). The browser warns until the certificate is trusted. Docs stay off, so `/v1/docs` and `/v1/openapi.json` answer 404. Swagger UI is not mounted.

The external API always uses a port from 3000 to 3999: `3010` in development and `3443` in production. The internal API uses `4000` in development and `4443` in production. The web server uses `5173` in development and shares `4443` with the internal API in production.

`MOCK_API_KEY` is `dev-key` in both JSON files. The server and the mock read that file. The form has no key.

`FAILURE_RATE` defaults to `0.15` when it is unset. Set it to `1` and restart to force a mock failure, then set it back to `0.15`. A blank value or a number outside 0 to 1 stops the mock at startup. `0` is a real rate and disables random failure.

Each quote on the external API waits a random 250–500 ms before it answers. That stays inside the internal API's 2 second deadline.

## Checks

```bash
yarn ci
yarn workspace @quote/contract ci
yarn workspace @quote/mock-api ci
yarn workspace @quote/server ci
yarn workspace @quote/web ci
yarn workspace @quote/integration ci
```

`yarn ci` runs each workspace `ci` script: typecheck, Biome, tests, and for the two HTTP apps an OpenAPI diff. Regenerate a stale document with:

```bash
yarn workspace @quote/mock-api openapi:write
yarn workspace @quote/server openapi:write
```

## Money

`commissionRate` is a percentage represented with a fixed scale of 5 decimal places. For example, `1.50000` represents 1.5%.

`totalCommission` is calculated as:

`amount × commissionRate ÷ 100`

For AUD amounts with a scale of 2, the resulting commission has a fixed scale of 9 decimal places (2 + 5 + 2). This preserves the exact mathematical result without rounding.

**Examples:**

- `10000.00 × 1.50000 ÷ 100 = 150.000000000`
- `100.01 × 0.50000 ÷ 100 = 0.500050000`

All calculations use exact decimal arithmetic, not binary floating-point arithmetic.

The mock bands are LOW `0.50000`, MEDIUM `1.00000`, and HIGH `1.50000`.

## Not built

These are specified in `docs/architecture/ARCHITECTURE.md` and left out of this version:

- Idempotency storage. A double submit can create two quotes. The button stays disabled while a request is in flight.
- Retry and backoff.
- A rate limiter. A downstream 429 is mapped, and `Retry-After` is forwarded.
- OpenTelemetry.
- Any message catalog other than English.

## For agents

Workspaces: `@quote/contract`, `@quote/web` (web server), `@quote/server` (internal API), `@quote/mock-api` (external API), `@quote/integration` (backend integration tests). The web server, internal API, and external API may depend on `@quote/contract`. They do not import each other. `@quote/integration` is the test workspace that imports both APIs. The internal API calls the external API with `MOCK_API_BASE_URL`. In development that is three processes. In production the web server is the built form served by the internal API, and the external API remains a second process.

Schemas, the decimal type, and the English catalog are in `packages/contract/src`.

Read before changing behaviour:

- `docs/architecture/ARCHITECTURE.md`
- `docs/architecture/overview.mmd`, `sequence-success.mmd`, `sequence-failure.mmd`
- `docs/DESIGN.md`
- `docs/PHASES.md`

Safe commands: `yarn ci`, `yarn workspace @quote/mock-api openapi:check`, `yarn dev`.

Do not log `api-key`. Do not retry the quote call. Do not round the commission in the UI.

## AI usage

An AI coding agent in Cursor drafted the design notes, the workspace layout, the contract and both HTTP apps, the form, the tests, and this README from `docs/requirements.md` and the phase plan. The money rules, the API-key boundary, and the phase gates were specified in the design docs before the code was written, and then checked with `yarn ci`.

A transcript of all human requests to Cursor can be found in `docs/PROMPTS.md` for full transparency.


## Later
* Full Bendigo Bank branding and header in UI
* Add docker-compose for full E2E tests across all apps (including browser tests in Playwright)
* Add extra currency support (USD, GBP, EUR etc)
