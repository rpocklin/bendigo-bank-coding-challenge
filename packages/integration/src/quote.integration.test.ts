import { createServer } from "node:https";
import type { ServerType } from "@hono/node-server";
import { serve } from "@hono/node-server";
import { en } from "@quote/contract";
import { runtimeEnv } from "@quote/contract/runtime-env";
import { readProductionTls } from "@quote/contract/tls";
import {
  MAX_QUOTE_DELAY_MS,
  createMockApp,
  type MockOptions,
} from "@quote/mock-api";
import { createServerApp } from "@quote/server";
import { trustedVendorFetch } from "@quote/server/vendor-fetch";
import { afterEach, describe, expect, it, vi } from "vitest";

const apiKey = "integration-secret-key";
const valid = {
  currency: "AUD",
  loanAmount: "10000.00",
  loanTermInMonths: 360,
  riskBand: "HIGH",
};

const servers: ServerType[] = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        }),
    ),
  );
});

function listen(
  options: MockOptions,
  tls?: { key: Buffer; cert: Buffer },
): Promise<string> {
  const app = createMockApp(options);
  return new Promise((resolve, reject) => {
    const server = serve(
      {
        fetch: app.fetch,
        hostname: "127.0.0.1",
        port: 0,
        ...(tls
          ? { createServer, serverOptions: { key: tls.key, cert: tls.cert } }
          : {}),
      },
      (info) => {
        const protocol = tls ? "https" : "http";
        resolve(`${protocol}://127.0.0.1:${info.port}`);
      },
    );
    server.on("error", reject);
    servers.push(server);
  });
}

function quote(baseUrl: string, fetchImpl?: typeof fetch) {
  const app = createServerApp({
    baseUrl,
    apiKey,
    docs: false,
    ...(fetchImpl ? { fetchImpl } : {}),
  });
  return app.request("/v1/quotes", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(valid),
  });
}

describe("internal API to mock", () => {
  it("returns the HIGH band quote from the running mock", async () => {
    const baseUrl = await listen({
      apiKey,
      failureRate: 0,
      docs: false,
    });
    vi.spyOn(Math, "random").mockReturnValue(0.999);
    const started = performance.now();
    const response = await quote(baseUrl);
    expect(performance.now() - started).toBeGreaterThanOrEqual(
      MAX_QUOTE_DELAY_MS,
    );
    vi.restoreAllMocks();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      currency: "AUD",
      commissionRate: "1.50000",
      totalCommission: "150.000000000",
    });
  });

  it("maps a mock failure to vendor_unavailable and hides the key", async () => {
    const baseUrl = await listen({
      apiKey,
      failureRate: 1,
      docs: false,
    });
    const response = await quote(baseUrl);
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({
      code: "vendor_unavailable",
      message: en.vendor_unavailable,
    });
    expect(JSON.stringify(body)).not.toContain(apiKey);
  });

  it("forwards a mock 503 as service_unavailable with Retry-After", async () => {
    const baseUrl = await listen({
      apiKey,
      failureRate: 1,
      failureStatus: 503,
      retryAfter: "7",
      docs: false,
    });
    const response = await quote(baseUrl);
    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("7");
    expect(await response.json()).toEqual({
      code: "service_unavailable",
      message: en.service_unavailable,
    });
  });

  it("quotes over HTTPS with the shared self-signed certificate", async () => {
    const env = runtimeEnv("production");
    if (!("TLS_CERT" in env)) {
      throw new Error("production env is missing TLS_CERT");
    }
    const tls = readProductionTls(env);
    const baseUrl = await listen({ apiKey, failureRate: 0, docs: false }, tls);
    const response = await quote(baseUrl, trustedVendorFetch(tls.cert));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      commissionRate: "1.50000",
      totalCommission: "150.000000000",
    });
  });
});
