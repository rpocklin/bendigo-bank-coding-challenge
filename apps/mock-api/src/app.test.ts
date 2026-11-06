import { describe, expect, it, vi } from "vitest";
import {
  MAX_QUOTE_DELAY_MS,
  createMockApp,
  type FailureStatus,
} from "./app.js";

const quoteId = "8d3c1c2e-6f0a-4d1b-9c2e-0a1b2c3d4e5f";
const correlation = "11111111-1111-4111-8111-111111111111";

function app(failureRate = 0) {
  return createMockApp({
    apiKey: "test-key",
    failureRate,
    random: () => 0,
    quoteId: () => quoteId,
  });
}

const valid = {
  currency: "AUD",
  loanAmount: "10000.00",
  loanTermInMonths: 360,
  riskBand: "HIGH",
};

function post(
  body: unknown,
  headers: Record<string, string | undefined> = { "api-key": "test-key" },
) {
  return app().request("/v1/quotes", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("mock quote API", () => {
  it("waits 250–500ms before answering a quote", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.999);
    vi.useFakeTimers();
    try {
      const pending = Promise.resolve(post(valid));
      let settled = false;
      void pending.then(() => {
        settled = true;
      });
      await vi.advanceTimersByTimeAsync(MAX_QUOTE_DELAY_MS - 1);
      expect(settled).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      const response = await pending;
      expect(response.status).toBe(200);
    } finally {
      vi.useRealTimers();
      vi.restoreAllMocks();
    }
  });

  it("rejects a missing key and a wrong key as unauthorized", async () => {
    for (const headers of [{}, { "api-key": "nope" }]) {
      const response = await post(valid, headers);
      expect(response.status).toBe(401);
      expect(await response.json()).toMatchObject({ code: "unauthorized" });
    }
  });

  it.each([
    [{ ...valid, loanAmount: "100.5" }, "invalid_amount"],
    [{ ...valid, loanTermInMonths: 0 }, "invalid_term"],
    [{ ...valid, riskBand: "low" }, "invalid_risk_band"],
    [{ ...valid, currency: "USD" }, "invalid_currency"],
  ] as const)("rejects %j", async (body, code) => {
    const response = await post(body);
    expect(response.status).toBe(400);
    const json = (await response.json()) as { details?: { code: string }[] };
    expect(json.details?.[0]?.code).toBe(code);
  });

  it("rejects an unknown key and a missing body", async () => {
    const extra = await post({ ...valid, note: "no" });
    expect(extra.status).toBe(400);
    expect(
      ((await extra.json()) as { details?: { code: string }[] }).details?.[0]
        ?.code,
    ).toBe("unknown_field");

    const missing = await app().request("/v1/quotes", {
      method: "POST",
      headers: { "api-key": "test-key", "content-type": "application/json" },
    });
    expect(missing.status).toBe(400);
    const json = (await missing.json()) as {
      code: string;
      details?: { code: string }[];
    };
    expect(json.code).toBe("invalid_request");
    expect(json.details?.[0]?.code).toBe("missing_body");
  });

  it("returns the HIGH band quote", async () => {
    const response = await post(valid);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      quoteId,
      currency: "AUD",
      commissionRate: "1.50000",
      totalCommission: "150.000000000",
    });
  });

  it.each([
    [403, "forbidden"],
    [404, "not_found"],
    [429, "rate_limited"],
    [503, "vendor_unavailable"],
  ] as const)(
    "returns %s %s after a valid request",
    async (status: FailureStatus, code) => {
      const mock = createMockApp({
        apiKey: "test-key",
        failureRate: 1,
        failureStatus: status,
        random: () => 0,
      });
      const response = await mock.request("/v1/quotes", {
        method: "POST",
        headers: { "api-key": "test-key", "content-type": "application/json" },
        body: JSON.stringify(valid),
      });
      expect(response.status).toBe(status);
      expect(await response.json()).toMatchObject({ code });
      expect(response.headers.get("retry-after")).toBe(
        status === 429 || status === 503 ? "1" : null,
      );
    },
  );

  it("returns not_found for an unknown path", async () => {
    const response = await app().request("/v1/missing");
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: "not_found" });
  });

  it("keeps a missing key as unauthorized when a 403 failure is configured", async () => {
    const mock = createMockApp({
      apiKey: "test-key",
      failureRate: 1,
      failureStatus: 403,
      random: () => 0,
    });
    const response = await mock.request("/v1/quotes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(valid),
    });
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "unauthorized" });
  });

  it("fails every call when the failure rate is 1 and none when it is 0", async () => {
    const always = createMockApp({
      apiKey: "test-key",
      failureRate: 1,
      random: () => 0,
    });
    const failed = await always.request("/v1/quotes", {
      method: "POST",
      headers: { "api-key": "test-key", "content-type": "application/json" },
      body: JSON.stringify(valid),
    });
    expect(failed.status).toBe(500);
    expect(await failed.json()).toMatchObject({ code: "vendor_unavailable" });

    const steady = await post(valid);
    expect(steady.status).toBe(200);
  });

  it("replaces a non-UUID correlation id and echoes a UUID", async () => {
    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((line: unknown) => {
      logs.push(String(line));
    });
    const bad = await post(valid, {
      "api-key": "test-key",
      "x-correlation-id": "not a uuid",
    });
    expect(bad.headers.get("x-correlation-id")).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    const good = await post(valid, {
      "api-key": "test-key",
      "x-correlation-id": correlation,
    });
    expect(good.headers.get("x-correlation-id")).toBe(correlation);
    expect(logs.join("\n")).not.toContain("test-key");
    expect(logs.join("\n")).not.toContain("10000.00");
    vi.restoreAllMocks();
  });

  it("publishes the security scheme and the percentage example", async () => {
    const response = await app().request("/v1/openapi.json");
    const spec = (await response.json()) as {
      components?: { securitySchemes?: { ApiKey?: { name?: string } } };
      paths?: Record<string, unknown>;
    };
    const text = JSON.stringify(spec);
    expect(spec.components?.securitySchemes?.ApiKey?.name).toBe("api-key");
    expect(text).toContain("1.50000");
    expect(text).toContain("150.000000000");
    expect(text).toContain("percentage");
    expect(text.toLowerCase()).not.toContain("simulate");
    const docs = await app().request("/v1/docs");
    expect(docs.status).toBe(200);
    expect(await docs.text()).toContain("Scalar");
  });

  it("logs an unexpected exception and returns vendor_unavailable", async () => {
    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((line: unknown) => {
      logs.push(String(line));
    });
    const broken = createMockApp({
      apiKey: "test-key",
      failureRate: 0,
      random: () => 1,
    });
    broken.get("/explode", () => {
      throw new Error("boom test-key");
    });
    const response = await broken.request("/explode");
    expect(response.status).toBe(500);
    const body = (await response.json()) as { code: string; message: string };
    expect(body.code).toBe("vendor_unavailable");
    expect(body.message).not.toContain("test-key");
    expect(logs.join("\n")).toContain("unhandled Error");
    expect(logs.join("\n")).not.toContain("test-key");
    vi.restoreAllMocks();
  });

  it("hides the docs when production turns them off", async () => {
    const hidden = createMockApp({
      apiKey: "test-key",
      failureRate: 0,
      docs: false,
    });
    expect((await hidden.request("/v1/docs")).status).toBe(404);
    expect((await hidden.request("/v1/openapi.json")).status).toBe(404);
    const health = await hidden.request("/health");
    expect(health.status).toBe(200);
  });
});
