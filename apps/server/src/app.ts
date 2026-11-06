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
  resolveLocale,
  writeLog,
} from "@quote/contract";
import { requestQuote, type VendorClientOptions } from "./vendor-client.js";

type Env = { Variables: { correlationId: string } };

const quoteRoute = createRoute({
  method: "post",
  path: "/v1/quotes",
  operationId: "createQuote",
  summary: "Create a commission quote",
  tags: ["Quotes"],
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
    429: {
      description: "The quote service is busy",
      content: { "application/json": { schema: errorBodySchema } },
    },
    503: {
      description: "The quote service cannot price right now",
      content: { "application/json": { schema: errorBodySchema } },
    },
    500: {
      description: "The quote service is unavailable",
      content: { "application/json": { schema: errorBodySchema } },
    },
    504: {
      description: "The quote service timed out",
      content: { "application/json": { schema: errorBodySchema } },
    },
  },
});

const document = {
  openapi: "3.1.0",
  info: {
    title: "Staff Commission Quote API",
    version: "1.0.0",
    description:
      "Staff API for commission quotes. commissionRate is a percentage with 5 fractional digits. AUD totalCommission has 9 fractional digits.",
  },
} as const;

export type ServerOptions = Omit<VendorClientOptions, "timeoutMs"> & {
  timeoutMs?: number;
  docs?: boolean;
};

export function createServerApp(options: ServerOptions) {
  const vendor: VendorClientOptions = { timeoutMs: 2000, ...options };
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

  app.use("*", async (c, next) => {
    const id = correlationId(c.req.header("x-correlation-id"));
    c.set("correlationId", id);
    c.header("x-correlation-id", id);
    c.header(
      "content-language",
      resolveLocale(c.req.header("accept-language")),
    );
    const started = performance.now();
    await next();
    writeLog({
      time: new Date().toISOString(),
      level: "info",
      service: "server",
      msg: "request",
      correlationId: id,
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      durationMs: Math.round(performance.now() - started),
    });
  });

  app.openapi(quoteRoute, async (c) => {
    const parsed = parseQuoteRequest(c.req.valid("json"));
    if (!parsed.ok) {
      return c.json(parsed.error, 400);
    }
    const result = await requestQuote(
      vendor,
      parsed.value,
      c.get("correlationId"),
    );
    if (!result.ok) {
      if (result.retryAfter) {
        c.header("retry-after", result.retryAfter);
      }
      return c.json(result.error, result.status);
    }
    return c.json(result.quote, 200);
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
      service: "server",
      msg: `unhandled ${name}`,
      correlationId: correlationId(c.req.header("x-correlation-id")),
      method: c.req.method,
      path: c.req.path,
      status: 500,
      durationMs: 0,
    });
    return c.json(errorBody("internal_error"), 500);
  });

  app.get("/health", (c) => c.json({ status: "ok" }));
  if (options.docs !== false) {
    app.doc31("/v1/openapi.json", document);
    app.get(
      "/v1/docs",
      Scalar({
        url: "/v1/openapi.json",
        pageTitle: "Staff Commission Quote API",
      }),
    );
  }

  return app;
}
