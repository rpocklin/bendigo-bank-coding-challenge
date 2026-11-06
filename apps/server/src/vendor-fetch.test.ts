import { createServer } from "node:https";
import { describe, expect, it } from "vitest";
import { readProductionTls } from "@quote/contract/tls";
import { runtimeEnv } from "@quote/contract/runtime-env";
import { trustedVendorFetch } from "./vendor-fetch.js";

describe("trusted vendor fetch", () => {
  it("accepts the self-signed certificate used by the mock", async () => {
    const env = runtimeEnv("production");
    if (!("TLS_CERT" in env)) {
      throw new Error("production env is missing TLS_CERT");
    }
    const tls = readProductionTls(env);
    const server = createServer(
      { key: tls.key, cert: tls.cert },
      (_req, res) => {
        res.writeHead(200, { "content-type": "text/plain" });
        res.end("ok");
      },
    );
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("test server did not bind");
    }
    try {
      const response = await trustedVendorFetch(tls.cert)(
        `https://127.0.0.1:${address.port}/`,
      );
      expect(response.status).toBe(200);
      expect(await response.text()).toBe("ok");
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });
});
