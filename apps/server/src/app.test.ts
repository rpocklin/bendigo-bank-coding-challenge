import { describe, expect, it, vi } from "vitest";
import { createServerApp } from "./app.js";

const correlation = "22222222-2222-4222-8222-222222222222";
const apiKey = "super-secret-key";
const valid = {
  currency: "AUD",
  loanAmount: "10000.00",
  loanTermInMonths: 360,
  riskBand: "HIGH",
};
const quote = {
  quoteId: "8d3c1c2e-6f0a-4d1b-9c2e-0a1b2c3d4e5f",
  currency: "AUD",
  commissionRate: "1.50000",
  totalCommission: "150.000000000",
};

function jsonResponse(
  body: unknown,
  status: number,
  headers: Record<string, string> = {},
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

describe("staff quote API", () => {
  it("sends the key to the mock and leaves it out of the response and the logs", async () => {
    const seen: string[] = [];
    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((line: unknown) => {
      logs.push(String(line));
    });
    const app = createServerApp({
      apiKey,
      baseUrl: "http://mock.test",
      fetchImpl: async (_input, init) => {
        seen.push(String(new Headers(init?.headers).get("api-key")));
        seen.push(JSON.stringify(init?.body));
        return jsonResponse(quote, 200);
      },
    });
    const response = await app.request("/v1/quotes", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-correlation-id": correlation,
      },
      body: JSON.stringify(valid),
    });
    expect(response.status).toBe(200);
    expect(seen[0]).toBe(apiKey);
    expect(response.headers.get("x-correlation-id")).toBe(correlation);
    const text = `${JSON.stringify(await response.json())}\n${logs.join("\n")}`;
    expect(text).not.toContain(apiKey);
    vi.restoreAllMocks();
  });

  it("does not call the mock for invalid input", async () => {
    const fetchImpl = vi.fn();
    const app = createServerApp({
      apiKey,
      baseUrl: "http://mock.test",
      fetchImpl,
    });
    const response = await app.request("/v1/quotes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...valid, loanAmount: "100.5" }),
    });
    expect(response.status).toBe(400);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("maps vendor failures without echoing the vendor body", async () => {
    const cases: Array<{
      status: number;
      expected: number;
      code: string;
      retry?: string;
    }> = [
      { status: 401, expected: 500, code: "vendor_unavailable" },
      { status: 403, expected: 500, code: "vendor_unavailable" },
      { status: 404, expected: 500, code: "vendor_unavailable" },
      { status: 500, expected: 500, code: "vendor_unavailable" },
      { status: 400, expected: 500, code: "vendor_unavailable" },
      { status: 429, expected: 429, code: "rate_limited", retry: "12" },
      { status: 429, expected: 429, code: "rate_limited" },
      { status: 503, expected: 503, code: "service_unavailable", retry: "30" },
      { status: 503, expected: 503, code: "service_unavailable" },
    ];
    for (const item of cases) {
      const app = createServerApp({
        apiKey,
        baseUrl: "http://mock.test",
        fetchImpl: async () =>
          jsonResponse(
            { code: "unauthorized", message: apiKey },
            item.status,
            item.retry ? { "retry-after": item.retry } : {},
          ),
      });
      const response = await app.request("/v1/quotes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(valid),
      });
      expect(response.status).toBe(item.expected);
      const body = (await response.json()) as { code: string; message: string };
      expect(body.code).toBe(item.code);
      expect(body.message).not.toContain(apiKey);
      expect(response.headers.get("retry-after")).toBe(item.retry ?? null);
    }
  });

  it("maps connection failure and a garbage body to vendor_unavailable", async () => {
    const refused = createServerApp({
      apiKey,
      baseUrl: "http://mock.test",
      fetchImpl: async () => {
        throw new TypeError("fetch failed");
      },
    });
    const down = await refused.request("/v1/quotes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(valid),
    });
    expect((await down.json()) as { code: string }).toMatchObject({
      code: "vendor_unavailable",
    });

    const garbage = createServerApp({
      apiKey,
      baseUrl: "http://mock.test",
      fetchImpl: async () => new Response("not-json", { status: 200 }),
    });
    const bad = await garbage.request("/v1/quotes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(valid),
    });
    expect(bad.status).toBe(500);
    expect(await bad.json()).toMatchObject({ code: "vendor_unavailable" });
  });

  it("times out a call that never resolves", async () => {
    const app = createServerApp({
      apiKey,
      baseUrl: "http://mock.test",
      timeoutMs: 20,
      fetchImpl: (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const error = new Error("The operation was aborted");
            error.name = "TimeoutError";
            reject(error);
          });
        }),
    });
    const response = await app.request("/v1/quotes", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-correlation-id": correlation,
      },
      body: JSON.stringify(valid),
    });
    expect(response.status).toBe(504);
    expect(await response.json()).toMatchObject({ code: "vendor_timeout" });
    expect(response.headers.get("x-correlation-id")).toBe(correlation);
  });

  it("forwards the correlation id to the mock", async () => {
    let forwarded = "";
    const app = createServerApp({
      apiKey,
      baseUrl: "http://mock.test",
      fetchImpl: async (_input, init) => {
        forwarded = String(new Headers(init?.headers).get("x-correlation-id"));
        return jsonResponse(quote, 200);
      },
    });
    const response = await app.request("/v1/quotes", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-correlation-id": correlation,
      },
      body: JSON.stringify(valid),
    });
    expect(forwarded).toBe(correlation);
    expect(response.headers.get("x-correlation-id")).toBe(correlation);
  });

  it("completes 100 quotes in under two seconds", async () => {
    const app = createServerApp({
      apiKey,
      baseUrl: "http://mock.test",
      fetchImpl: async () => jsonResponse(quote, 200),
    });
    const started = performance.now();
    const responses = await Promise.all(
      Array.from({ length: 100 }, () =>
        app.request("/v1/quotes", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(valid),
        }),
      ),
    );
    expect(responses.every((response) => response.status === 200)).toBe(true);
    expect(performance.now() - started).toBeLessThan(2000);
  });

  it("does not document the vendor api-key", async () => {
    const app = createServerApp({ apiKey, baseUrl: "http://mock.test" });
    const document = (await (await app.request("/v1/openapi.json")).json()) as {
      components?: { securitySchemes?: unknown };
    };
    const spec = JSON.stringify(document);
    expect(document.components?.securitySchemes).toBeUndefined();
    expect(spec).not.toContain("api-key");
    expect(spec).toContain("1.50000");
    expect(spec).toContain("percentage");
  });

  it("hides the docs when production turns them off", async () => {
    const app = createServerApp({
      apiKey,
      baseUrl: "http://mock.test",
      docs: false,
      fetchImpl: async () => jsonResponse(quote, 200),
    });
    expect((await app.request("/v1/docs")).status).toBe(404);
    expect((await app.request("/v1/openapi.json")).status).toBe(404);
    const quoteResponse = await app.request("/v1/quotes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(valid),
    });
    expect(quoteResponse.status).toBe(200);
  });

  it("returns not_found for an unknown path", async () => {
    const app = createServerApp({ apiKey, baseUrl: "http://mock.test" });
    const response = await app.request("/v1/missing");
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      code: "not_found",
      message: "No quote route matches this request.",
    });
  });

  it("returns internal_error for a thrown exception and logs the error name", async () => {
    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((line: unknown) => {
      logs.push(String(line));
    });
    const app = createServerApp({ apiKey, baseUrl: "http://mock.test" });
    app.get("/explode", () => {
      throw new Error("boom super-secret-key");
    });
    const response = await app.request("/explode");
    expect(response.status).toBe(500);
    const body = (await response.json()) as { code: string; message: string };
    expect(body).toEqual({
      code: "internal_error",
      message: "The quote could not be completed.",
    });
    expect(body.message).not.toContain(apiKey);
    expect(logs.join("\n")).toContain("unhandled Error");
    expect(logs.join("\n")).not.toContain(apiKey);
    vi.restoreAllMocks();
  });
});
