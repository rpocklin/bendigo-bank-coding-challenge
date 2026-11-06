import { describe, expect, it } from "vitest";
import { readProductionTls } from "./tls.js";
import { runtimeEnv } from "./runtime-env.js";

describe("production TLS", () => {
  it("reads the self-signed certificate named by env/production.json", () => {
    const env = runtimeEnv("production");
    if (!("TLS_CERT" in env)) {
      throw new Error("production env is missing TLS_CERT");
    }
    const tls = readProductionTls(env);
    expect(tls.cert.toString()).toContain("BEGIN CERTIFICATE");
    expect(tls.key.toString()).toContain("BEGIN PRIVATE KEY");
  });
});
