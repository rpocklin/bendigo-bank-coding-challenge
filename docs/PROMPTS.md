# User Prompt 
You are a principal software and dev ops engineer with excellent experience in clean code design following prinicipals of KISS, YAGNI, Lean and pragmatic programming and clean domain design.

Read the REQUIREMENTS.md and consider overall architecture focusing on Typescript as a language, then consider simple frameworks we can choose such as Nest.js, Fastify etc and also consider testing, performance and integration / e2e testing for both the backend and the frontend.

Summarise the imporant decision points and key milestones and consider how we should break up this work into discrete phases with validation gates, coding standards, testability and architecture.

Our first step should be language, framework and library choices, key areas to invest time in for contracts, specifications or domain modelling and key test scenarios.

Consider using https://github.com/github/spec-kit for defining our milestones, tasks, dependencies and tracking of progress.

# Planning #1
This is good summary - we should spend ample time on defining the API contracts, what about supporting an OpenAPI spec (either code-first or spec-first?) with Hono / Zod OpenAPI?  We need to be careful about financial currencies (no rounding or floats, and sufficient decimal places used), min / maxes and strict enum typing where it makes sense, and if we should support defaults or optional fields.

Also consider the URL structure, supporting human and agent-friendly endpoints as well as consider the physical folder layout in our repo (mono-repo) so we can succinctly work on separate deployables and isolate changes.

# Planning #2
what data types will we use for totalCommission, commissionRate and loanAmount?

Explain the reasoning behind requiring a BFF, it is an extra deployable.  Should we have a shared module for the contracts package?

# Planning #3
We should consider internationalisation on error messages and also currency, so factor that into our design.

We should align on one financial data structure for the 3 numeric fields for consistency in math and calculations.  Consider if commissionRate should be fractional or represent a full percentage with decimals ie. 100.00, 32.12345 etc


# Planning #5
We should consider internationalisation on error messages and also currency, so factor that into our design.

We should align on one financial data structure for the 3 numeric fields for consistency in math and calculations.  Consider if commissionRate should be fractional or represent a full percentage with decimals ie. 100.00, 32.12345 etc

# Planning #6
apps/vendor is not a good name it should be apps/mock-api or similar.

We also need to consider correlation-ids, idempotency-keys, network throttling / backoff, graceful failure handling, logging, performance tests and observability, telemetry.

Lastly consider documentation generation for Hono Routes, Swagger UI and/or Scalar.

# Planning #7

Let's define the high-level design, risks and focus areas into an ARCHITECTURE.md.

# Planning #8

Let's define the implementation phases into PHASES.md along with validation gates and checks, including a critical review for goals, testing gaps and potential cleanup or refactoring at each PHASE.


# Planning #9

Good process - let's zoom-in on the UI / UX now - we are building this for bendigo bank so let's generate https://github.com/google-labs-code/design.md using their existing website https://www.bendigobank.com.au/  as a reference for fonts, images, colours, accessibility and design language.  Design the UI based off the existing look and feel, navigate to several pages to determine common designs and formats for relevant components we will use.


# Planning #9

I have reviewed the PHASES.md - remove PNPM and use Yarn unless there is a specific reason against it.  Use workspaces for our separate apps and deployables.

Let's also consider running tests for each workspace and a CI validation task in each workspace package.json for tests/code quality and linting using shared standards, and an overall one in the root.

Lastly we have a specific DOCUMENTATION phase at the end to validate and ensure our OpenAPI + Hono Docs generate as expected, and that we have a human/agentic supported README.md as a final phase in PHASES.md

# Planning #10

As part of internal document I want to have diagrams in validated mermaid (MMD) format.  An overall architecture diagram and key sequence diagrams for successful and failure scenarios, add this to the documentation phase and put it into a /docs/architecture/ folder - consider if anything else should go within our /docs/ folder to keep the root clean (apart from README.md)


# Implementation

Implement our plan as described in PHASES.md

# Refinements

Can we have a dev env.json which enables the docs and a production env.json which disables them?

We should move the default "port" and "MOCK_API_KEY out of server.ts into required fields on env.example, dev and production JSON files.

We need to ensure we are running the frontend and backend on https (for production mode), please configure both as necessary (self-signed certificates are fine for now) and update the ports to reflect 443 (or 4443) if that's not possible.

Ensure we are using HTTPS (in production mode) between our internal API and the vendor Commission Quote API.  Follow the same pattern (but with different ports).  Ensure we update documentation and tests.

Make our mock API always use port 3xxx (in all modes) so it's clear when we are referencing internal vs external hosts.  Ensure we update documentation and tests.

Remove the "AUD" assumptions anywhere is our error or currency handling, add one explicit test for another currency and have it correctly fail.

What errors does our quote and mock api currently handle / throw?

Implement the following exception handling for mock: 404, 503, 429 and 403.  Consider the best response for the staff quote API in these circumstances and why - Discuss

Implement these and also 403 with tests for all

Now review our own internal API for error handling for 4xx and 5xx

Implement these gaps and tests

# Final Review - Backend

Review each service (web/int api, ext api) review all code, folder structure and consider which are the most complex areas of code, longest files and why.  Recommend changes and look for opportunities to refactor, reduce duplication (extract code into shared sections or helpers - even in tests).  Also highlight any technical debt and recommend best actions.

Fix the technical debt highlighted.

We need to implement key integration tests using a new workspace - no UI, backend only.

# Final Review - Frontend

Make the UI look more modern (while being accessible)

Add a loading spinner that resets upon success or failure and move the warning above the call to action not below it.  Verify the UI responds well to smaller widths and mobile dimensions.

Add a random delay of 250 - 500ms to the mock API to simulate a real api, ensure all tests still pass and the E2E with this delay.

# Final Review - Architecture and documentation

Do a final review of our docs, architecture MMD, folder structure, root README, package.json, linting, test coverage, CI checks and confirm we have implemented all requirements in docs/requirements.md for submission

Fix the 2 docs that aren't up to date.
