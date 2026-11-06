import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";
import { Scalar } from "@scalar/hono-api-reference";
import {
  correlationId,
  errorBody,
  errorBodySchema,
  parseQuoteRequest,
  quoteRequestSchema,
  quoteResponseSchema,
  writeLog,
} from "@quote/contract";
import { quoteDelayMs, wait } from "./delay.js";
import { priceQuote } from "./pricing.js";

export { MAX_QUOTE_DELAY_MS, MIN_QUOTE_DELAY_MS } from "./delay.js";

export const failureStatuses = [403, 404, 429, 500, 503] as const;
export type FailureStatus = (typeof failureStatuses)[number];

export type MockOptions = {
  apiKey: string;
  failureRate: number;
  failureStatus?: FailureStatus;
  retryAfter?: string;
  random?: () => number;
  quoteId?: () => string;
  docs?: boolean;
};

function failureCode(status: FailureStatus) {
  if (status === 403) return "forbidden" as const;
  if (status === 404) return "not_found" as const;
  if (status === 429) return "rate_limited" as const;
  return "vendor_unavailable" as const;
}

type Env = { Variables: { correlationId: string } };

const quoteRoute = createRoute({
  method: "post",
  path: "/v1/quotes",
  operationId: "createQuote",
  summary: "Create a commission quote",
  tags: ["Quotes"],
  security: [{ ApiKey: [] }],
  request: {
    body: {
      content: { "application/json": { schema: quoteRequestSchema } },
      required: true,
    },
  },
  responses: {
    200: {
      description: "Commission quote",
      content: { "application/json": { schema: quoteResponseSchema } },
    },
    400: {
      description: "The request is not valid",
      content: { "application/json": { schema: errorBodySchema } },
    },
    401: {
      description: "Missing or wrong api-key",
      content: { "application/json": { schema: errorBodySchema } },
    },
    403: {
      description: "The key is not allowed to price this quote",
      content: { "application/json": { schema: errorBodySchema } },
    },
    404: {
      description: "The pricing route is not available",
      content: { "application/json": { schema: errorBodySchema } },
    },
    429: {
      description: "Too many quote requests",
      content: { "application/json": { schema: errorBodySchema } },
    },
    500: {
      description: "The quote service failed",
      content: { "application/json": { schema: errorBodySchema } },
    },
    503: {
      description: "The quote service cannot price right now",
      content: { "application/json": { schema: errorBodySchema } },
    },
  },
});

const document = {
  openapi: "3.1.0",
  info: {
    title: "Commission Quote API",
    version: "1.0.0",
    description:
      "Mock of the third-party commission quote API. commissionRate is a percentage with 5 fractional digits. totalCommission for AUD has 9 fractional digits.",
  },
} as const;

export function createMockApp(options: MockOptions) {
  const app = new OpenAPIHono<Env>({
    defaultHook: async (result, c) => {
      if (!result.success) {
        const raw = await c.req.json().catch(() => undefined);
        const parsed = parseQuoteRequest(raw);
        return c.json(
          parsed.ok
            ? errorBody("invalid_request", [{ code: "missing_body" }])
            : parsed.error,
          400,
        );
      }
      return undefined;
    },
  });

  app.openAPIRegistry.registerComponent("securitySchemes", "ApiKey", {
    type: "apiKey",
    in: "header",
    name: "api-key",
  });

  app.use("*", async (c, next) => {
    const id = correlationId(c.req.header("x-correlation-id"));
    c.set("correlationId", id);
    c.header("x-correlation-id", id);
    const started = performance.now();
    await next();
    writeLog({
      time: new Date().toISOString(),
      level: "info",
      service: "mock-api",
      msg: "request",
      correlationId: id,
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      durationMs: Math.round(performance.now() - started),
    });
  });

  app.use("/v1/quotes", async (c, next) => {
    if (c.req.method === "POST") await wait(quoteDelayMs());
    await next();
  });

  app.openapi(quoteRoute, async (c) => {
    const presented = c.req.header("api-key");
    if (presented !== options.apiKey) {
      return c.json(errorBody("unauthorized"), 401);
    }
    const body = parseQuoteRequest(c.req.valid("json"));
    if (!body.ok) {
      return c.json(body.error, 400);
    }
    const random = options.random ?? Math.random;
    if (random() < options.failureRate) {
      const status = options.failureStatus ?? 500;
      if (status === 429 || status === 503) {
        c.header("retry-after", options.retryAfter ?? "1");
      }
      return c.json(errorBody(failureCode(status)), status);
    }
    const quoteId = options.quoteId?.() ?? crypto.randomUUID();
    return c.json(priceQuote(body.value, quoteId), 200);
  });

  app.notFound((c) => c.json(errorBody("not_found"), 404));

  app.onError((error, c) => {
    if (error instanceof HTTPException && error.status === 400) {
      return c.json(
        errorBody("invalid_request", [{ code: "missing_body" }]),
        400,
      );
    }
    const name = error instanceof Error ? error.name : "Error";
    writeLog({
      time: new Date().toISOString(),
      level: "error",
      service: "mock-api",
      msg: `unhandled ${name}`,
      correlationId: correlationId(c.req.header("x-correlation-id")),
      method: c.req.method,
      path: c.req.path,
      status: 500,
      durationMs: 0,
    });
    return c.json(errorBody("vendor_unavailable"), 500);
  });

  app.get("/health", (c) => c.json({ status: "ok" }));
  if (options.docs !== false) {
    app.doc31("/v1/openapi.json", document);
    app.get(
      "/v1/docs",
      Scalar({ url: "/v1/openapi.json", pageTitle: "Commission Quote API" }),
    );
  }

  return app;
}

export const openApiDocument = document;
