# Phases

About four hours. A phase is finished when its gate is green and its critical review is answered in a few lines in this file. Do not start the next phase on a red gate.

The submission still has to do the brief: the form gets a quote, bad input and vendor failures are visible, the mock requires `api-key`, tests cover the paths that matter, and the root `README.md` explains how to run it. `docs/architecture/ARCHITECTURE.md` is the design these phases implement. `docs/DESIGN.md` is the screen. The brief itself is `docs/requirements.md`.

## Workspaces and checks

Yarn 4, through Corepack. Workspaces are `apps/*` and `packages/*`. The install mode is `nodeLinker: node-modules`. Yarn's Plug'n'Play linker is the one mode we skip: Vite's resolver spends the timebox on linker issues, and the apps do not need it.

One Biome config and one strict TypeScript base live at the repo root. Workspaces do not add their own lint rules.

Every workspace `package.json` has the same script names:

| Script | What it runs |
| --- | --- |
| `typecheck` | `tsc --noEmit` for that package |
| `lint` | Biome against that package, using the root config |
| `test` | Vitest for that package only |
| `ci` | `typecheck`, then `lint`, then `test` |

`apps/mock-api` and `apps/server` add `openapi:check` to their `ci` script. It regenerates `openapi.json` and fails if the committed file differs.

The root `package.json` is private and has no application source. Its scripts fan out in dependency order:

| Script | What it runs |
| --- | --- |
| `test` | `yarn workspaces foreach -Apt run test` |
| `lint` | `yarn workspaces foreach -Apt run lint` |
| `typecheck` | `yarn workspaces foreach -Apt run typecheck` |
| `ci` | `yarn workspaces foreach -Apt run ci` |
| `dev` | mock API, server, and web together |

A workspace is checked on its own with `yarn workspace @quote/contract ci` (and the same for `@quote/mock-api`, `@quote/server`, and `@quote/web`). The root `yarn ci` is the gate a reviewer runs. It does not replace the per-workspace scripts.

## Phases

| Phase | Budget | Done when |
| --- | --- | --- |
| 0 Contract | 40 min | Workspace exists. `yarn workspace @quote/contract ci` is green |
| 1 Mock API | 50 min | Auth, pricing, random failure, OpenAPI, and Scalar are green |
| 2 Server | 50 min | Key stays on the server. Timeout, 429, and correlation are tested |
| 3 Form | 55 min | Loading, success, and error. Amounts are not rounded on screen |
| 4 Run path | 20 min | `yarn ci` and `yarn dev` from a clean install |
| 5 Documentation | 25 min | OpenAPI, Scalar, Mermaid, and the root README all match the system |

## Phase 0 — Contract

### Goal

`packages/contract` is the only place that knows how money, rates, and error sentences work.

### Work

- `ScaledDecimal`: parse, format, multiply, scale-shift by 2 for `/100`.
- Currency table with a single AUD row, exponent 2.
- `RATE_SCALE = 5`. Commission helper: `loanAmount * (rate / 100)` at scale `exponent + 5 + 2`.
- Zod schemas for the quote request, the quote response, and the error body. Strict objects. No defaults. No optional quote fields.
- English catalog keyed by every error code. `Accept-Language` helper that returns `en`.
- Root Yarn workspace, `packages/contract` scripts (`typecheck`, `lint`, `test`, `ci`), and the shared Biome and TypeScript config. Later packages copy those four script names.

### Validation gate

`yarn workspace @quote/contract ci` is green.

### Checks

- `10000.00` AUD at `1.50000` percent equals `150.000000000`.
- `100.01` AUD at `0.50000` percent equals `0.500050000`.
- `100.5`, `1e2`, `0100.00`, `100.999`, and an empty string are rejected.
- A rate of `0.0150` (a fraction written by mistake) fails scale 5. `100.00001` and `0.00000` are rejected.
- A currency other than `AUD` is rejected. The amount scale is taken from the AUD exponent, not from a literal `2` in the quote schema.
- Every error code used by the schemas has an `en` sentence. A missing key fails the test.
- JSON numbers are not accepted for the three decimal fields.

### Critical review

Answer these before leaving the phase:

- Can a second currency be added as a table row without editing multiply or the commission helper?
- Is there any `number` arithmetic, `Math.round`, or `toFixed` on these fields?
- Are `loanAmount`, `commissionRate`, and `totalCommission` the same `ScaledDecimal` type, with the percentage convention documented on the rate schema?
- Which tests are still missing? The likely gap is a negative digit string and a scale-0 currency fixture that proves the exponent is data. Add the negative case. Add the scale-0 fixture only if it can be done without publishing JPY on the public schema.
- What should be deleted? Any leftover branded types that split the three fields, and any fraction-style examples (`0.0050`).

## Phase 1 — Mock API

### Goal

`apps/mock-api` is a separate deployable that speaks the contract, demands the API key, and publishes its own OpenAPI document.

### Work

- Hono app via `@hono/zod-openapi`. `POST /v1/quotes`, `GET /v1/openapi.json`, `GET /health`.
- Scalar at `GET /v1/docs` pointed at that document. Do not also mount Swagger UI.
- `api-key` checked before the body is priced. Wrong or missing key is 401.
- Pricing is a pure function: LOW `0.50000`, MEDIUM `1.00000`, HIGH `1.50000`.
- `FAILURE_RATE` environment variable for the running process. Tests inject the rate. No simulate header.
- Correlation id generated or propagated. JSON logs to stdout without the API key and without the body.
- Commit `apps/mock-api/openapi.json`.

### Validation gate

`yarn workspace @quote/mock-api ci` is green, including `openapi:check`. `GET /v1/docs` returns the Scalar page when the server is running.

### Checks

- Missing key and wrong key are 401 and share the `unauthorized` code.
- One rejection each for amount, term, risk band, and currency.
- HIGH band on `10000.00` AUD returns rate `1.50000` and commission `150.000000000`.
- Failure rate 1 returns 500 `vendor_unavailable`. Failure rate 0 does not flake.
- A non-UUID correlation id is replaced. A valid one is echoed.
- The OpenAPI document contains the security scheme, the percentage description, the scale-9 commission example, and the error responses. It does not contain a simulate header.

### Critical review

- Does the mock import only `@quote/contract` and Hono, never `apps/server` or `apps/web`?
- Is pricing free of HTTP types so the commission tests do not boot a server?
- Did Scalar end up beside Swagger UI? Delete the extra one.
- Are examples in the committed spec still using a 4-digit fraction? Replace them.
- Testing gap to close before moving on: unknown JSON key, and a body that is missing entirely (400, not an empty object).
- Cleanup: any copy of the band table outside the pricing function.

## Phase 2 — Server

### Goal

`apps/server` is the only caller of the mock. Staff can get a quote without ever holding the key.

### Work

- `POST /v1/quotes` validates with the shared schema, then calls `MOCK_API_BASE_URL` with `api-key` from the environment and a 2 second deadline.
- One attempt. No retry loop.
- Map mock 401 to a staff-safe `vendor_unavailable` (the staff member cannot fix a server key). Map connection failure to `vendor_unavailable`, timeout to `vendor_timeout`, and 429 to `rate_limited` with `Retry-After` forwarded.
- Refuse a mock body that does not match the response schema.
- Propagate `x-correlation-id`. Same JSON log shape as the mock.
- Commit `apps/server/openapi.json`. The server document has no `api-key` scheme.
- In-process smoke: 100 successful quotes in under two seconds.

### Validation gate

`yarn workspace @quote/server ci` is green, including the smoke and `openapi:check`. A test proves the response and the logs do not contain the API key.

### Checks

- The key is sent to the mock and is absent from the staff response, the error body, and log lines.
- Invalid staff input returns 400 and does not call the mock.
- Injected mock 500, connection refusal, timeout, and 429 hit the mapped codes above.
- A garbage mock body becomes `vendor_unavailable` rather than a 200.
- Correlation id that arrived from the form is the id on the mock request and on the staff response.

### Critical review

- Is the mock client the only module that knows the key and the base URL?
- Did a retry sneak in "for resilience"? Remove it. Idempotency is not built, so a retry can create two quotes.
- Is the two-second deadline enforced with a test that does not sleep for two seconds? Use a fake clock or a client that never resolves, raced against a short deadline in the test.
- Testing gap: 429 without `Retry-After`, and a mock 400 (the server should treat a vendor validation failure as `vendor_unavailable`, because the staff request was already validated).
- Cleanup: delete any path that logs `JSON.stringify(body)` or the request headers wholesale.
- The smoke test is a regression net. If it is flaky, the budget is too tight for the machine, not a reason to delete the assertion. Raise the budget slightly and record the number. Do not turn it into a load-test framework.

## Phase 3 — Form

### Goal

A staff member can submit the three loan fields and see either a quote or a catalog message. Display does not round the commission.

### Work

- One page, following `docs/DESIGN.md`. Amount, term, risk band, currency shown as AUD (the only catalog row). Generate Quote.
- Client-side parse with the shared schema before `fetch`. Invalid input never hits the network.
- Loading flag disables the button until the request settles.
- Success shows quote id, percentage rate, and total commission. Format with `Intl.NumberFormat` using the document locale and the currency code, with fraction digits pinned to the value scale.
- Errors look up `details[].code` or `code` in the shared `en` catalog, then fall back to `message`.
- Send `Accept-Language` and `x-correlation-id`.

### Validation gate

`yarn workspace @quote/web ci` is green. Two UI tests: a successful quote renders `150.000000000` grouped however the locale requires, and a failed quote shows the catalog sentence and leaves the form usable.

### Checks

- Empty amount, `100.5`, and a cleared risk band do not call `fetch`.
- The button does not submit twice while loading.
- The screen never shows the API key. The web package has no env var for it.
- The percentage is labelled as a percentage so `1.50000` cannot be read as a fraction of one.

### Critical review

- Does the form import schemas from `@quote/contract` and contain no copy of the bounds?
- Is there a second English string for an error the catalog already has? Use the catalog.
- Testing gap: `Content-Language` is irrelevant to the UI test, but a unit test should show that an unknown `Accept-Language` still resolves to `en`. That test belongs in `packages/contract` if it was skipped in phase 0. Add it now.
- Cleanup: remove unused component-library setup, router, or global state. One page does not need them.
- Display review: if the formatted commission is `150.00`, the formatter rounded and the phase is not done.

## Phase 4 — Run path

### Goal

From a clean checkout, one install starts both deployables and runs every workspace check.

### Work

- Root `dev` starts the mock, the server, and Vite.
- `.env.example` matches `env/dev.json`: `SERVER_PORT` `4000`, `MOCK_API_PORT` `3010`, `MOCK_API_BASE_URL` `http://127.0.0.1:3010`, `MOCK_API_KEY`, `FAILURE_RATE`, and `WEB_PORT`. `env/production.json` is staff HTTPS `4443` and mock HTTPS `3443`. The mock port is always `3000`–`3999`. No real secrets.
- Confirm each workspace `ci` script is the same four steps, plus `openapi:check` on the two Hono apps.

### Validation gate

From a clean shell, `corepack enable`, `yarn install`, and `yarn ci` succeed. `yarn dev` serves the form, and one quote completes against the mock.

### Checks

- `yarn workspace @quote/contract ci`, then mock-api, server, and web, each green on their own.
- `yarn ci` from the root runs those same scripts and does not skip a workspace.
- The web dev server proxies to the server. The browser request does not go to the mock host.
- `FAILURE_RATE=1` makes the form show the catalog error. Set it back afterwards.

### Critical review

- Does any workspace lint with a different tool, or skip `typecheck` inside `ci`? Make them match.
- Does the root `ci` script reimplement the tests instead of calling workspace `ci`? It should only fan out.
- Testing gap: a workspace that is not in `workspaces` will not run. List `yarn workspaces list` and expect contract, mock-api, server, and web.
- Cleanup: a second lockfile, a `package-lock.json`, or a workspace that depends on another app.

## Phase 5 — Documentation

### Goal

The published docs match the running routes, and `README.md` is enough for a reviewer and for an agent that has not seen this conversation.

### Work

- Regenerate `apps/mock-api/openapi.json` and `apps/server/openapi.json`. `openapi:check` in each app's `ci` is what fails on drift.
- With both servers up, `GET /v1/openapi.json` returns that committed document, and `GET /v1/docs` renders it in Scalar. One renderer per app.
- Confirm the Mermaid sources in `docs/architecture/` still match the code: `overview.mmd`, `sequence-success.mmd`, and `sequence-failure.mmd`. Each file must parse. Add a diagram only when a new runtime path appears. Do not redraw these in the root README.
- Root `README.md` is the only markdown at the repo root. It has two audiences in one file, and it points at `docs/README.md` for the internal design.

For a person:

- What the app does, in a few lines.
- Prerequisites: Node and Yarn via Corepack.
- `yarn install`, `yarn dev`, `yarn ci`, and the per-workspace `yarn workspace <name> ci` form.
- The three development URLs: web server `http://127.0.0.1:5173`, internal API `http://127.0.0.1:4000/v1/docs`, external API `http://127.0.0.1:3010/v1/docs`. Production has two: `https://127.0.0.1:4443` for the web server and internal API, and `https://127.0.0.1:3443` for the external API. The env vars in `.env.example` match `env/dev.json`.
- The percentage convention and the scale-9 commission, including the two worked examples.
- What was specified and not built: idempotency storage, backoff, a rate limiter, OpenTelemetry, and any locale other than English.
- How AI was used, as the brief requires.

For an agent:

- The workspace map and the rule that apps import `@quote/contract` and never each other.
- Where schemas, money, and the English catalog live.
- The commands that are safe to run: `yarn ci`, `yarn workspace @quote/mock-api openapi:check`, `yarn dev`.
- The files to read before changing behaviour: `docs/architecture/ARCHITECTURE.md`, `docs/DESIGN.md`, `docs/PHASES.md`, and the `.mmd` diagrams next to the architecture note.
- Do not log `api-key`, do not retry the quote call, do not round commission in the UI.

### Validation gate

`yarn ci` is still green after the doc pass. A fresh reader can start the app from the root README without this chat. Fetching each `/v1/openapi.json` matches the committed file, and each `/v1/docs` page loads. Every file in `docs/architecture/*.mmd` parses as Mermaid.

### Checks

- The mock document has the `api-key` scheme. The server document does not.
- Both documents describe `commissionRate` as a percentage at scale 5 and `totalCommission` at scale 9 for AUD.
- The README commands are the commands that just worked. No leftover package-manager name.
- The agent section names the workspaces, including `@quote/integration`, and the contract package.
- `overview.mmd` shows the browser, the web server, both deployables, and `packages/contract` as a library import. Development has three processes. Production has two, because the internal API serves the built web server.
- `sequence-success.mmd` shows one call to the mock and the full-scale commission on screen.
- `sequence-failure.mmd` shows a client rejection with no network call, a vendor failure, a timeout with no retry, a 429, and a 503 mapped to `service_unavailable`. The API key never appears in a response.

### Critical review

This is the submission review. Walk the brief, not the architecture.

- Goals: a quote is created, bad numbers are rejected, the mock can fail, the key is enforced, tests exist, and the README starts the app.
- Testing gaps to accept or close: there is no browser end-to-end test. That is acceptable if phase 3's UI tests and phase 2's HTTP tests cover success and failure. Add one end-to-end test only if this gate is green and time is left. There is no test that a second locale renders. That is acceptable because only `en` exists. The catalog key test is the stand-in.
- Docs gap: if Scalar failed to mount and Swagger UI replaced it, the root README and `docs/architecture/ARCHITECTURE.md` name the renderer that actually shipped. One renderer only. If a diagram disagrees with a route, fix the `.mmd` file, do not leave a second picture in prose.
- Refactor pass: a second decimal helper, a hardcoded `"AUD"` inside arithmetic, a logged header map, a retry, and a second docs page. Remove them.
- Dead weight: unused dependencies, an `apps/vendor` directory, a BFF package, fraction examples in comments, design notes left at the repo root, and a README that pastes `docs/architecture/ARCHITECTURE.md` instead of pointing at it.

## After the timebox

Do these only when a later session asks for them, in this order:

1. Idempotency store and the replay rules in `docs/architecture/ARCHITECTURE.md`. Add a sequence diagram in the same change.
2. The two-retry backoff policy, and only after that store exists.
3. A second currency row, then a second message catalog.
4. An OpenTelemetry exporter over the existing log fields.
