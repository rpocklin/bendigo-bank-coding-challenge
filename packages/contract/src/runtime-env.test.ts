import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseRuntimeEnv, runtimeEnv } from "./runtime-env.js";

const valid = {
  docs: true,
  SERVER_PORT: 4000,
  MOCK_API_PORT: 3010,
  MOCK_API_BASE_URL: "http://127.0.0.1:3010",
  MOCK_API_KEY: "dev-key",
};

function exampleEnv(): Record<string, string> {
  const text = readFileSync(
    new URL("../../../.env.example", import.meta.url),
    "utf8",
  );
  const values: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    values[trimmed.slice(0, separator)] = trimmed.slice(separator + 1);
  }
  return values;
}

describe("runtime env", () => {
  it("loads the dev and production files", () => {
    const dev = runtimeEnv("development");
    const production = runtimeEnv("production");
    expect(dev.docs).toBe(true);
    expect(production.docs).toBe(false);
    expect(dev.SERVER_PORT).toBe(4000);
    expect(dev.MOCK_API_PORT).toBe(3010);
    expect(dev.MOCK_API_BASE_URL).toBe("http://127.0.0.1:3010");
    expect(dev.MOCK_API_KEY).toBe("dev-key");
    expect(production.SERVER_PORT).toBe(4443);
    expect(production.MOCK_API_PORT).toBe(3443);
    expect(production.MOCK_API_BASE_URL).toBe("https://127.0.0.1:3443");
    expect(production.MOCK_API_KEY).toBe("dev-key");
    if (!("TLS_CERT" in production)) {
      throw new Error("production env is missing TLS_CERT");
    }
    expect(production.TLS_CERT).toBe("certs/localhost-cert.pem");
    expect(production.TLS_KEY).toBe("certs/localhost-key.pem");
    expect(runtimeEnv(undefined).docs).toBe(true);
  });

  it("requires the same port and key fields in .env.example", () => {
    const example = exampleEnv();
    const dev = runtimeEnv("development");
    expect(example.SERVER_PORT).toBe(String(dev.SERVER_PORT));
    expect(example.MOCK_API_PORT).toBe(String(dev.MOCK_API_PORT));
    expect(example.MOCK_API_BASE_URL).toBe(dev.MOCK_API_BASE_URL);
    expect(example.MOCK_API_KEY).toBe(dev.MOCK_API_KEY);
    expect(example.MOCK_API_KEY?.length).toBeGreaterThan(0);
  });

  it("rejects a missing key, a blank key, and a port outside 1-65535", () => {
    const { MOCK_API_KEY: _key, ...withoutKey } = valid;
    expect(() => parseRuntimeEnv(withoutKey, "dev")).toThrow(/MOCK_API_KEY/);
    expect(() =>
      parseRuntimeEnv({ ...valid, MOCK_API_KEY: "  " }, "dev"),
    ).toThrow(/MOCK_API_KEY/);
    expect(() => parseRuntimeEnv({ ...valid, SERVER_PORT: 0 }, "dev")).toThrow(
      /SERVER_PORT/,
    );
    expect(() =>
      parseRuntimeEnv({ ...valid, MOCK_API_PORT: 65536 }, "dev"),
    ).toThrow(/MOCK_API_PORT/);
    expect(() =>
      parseRuntimeEnv({ ...valid, SERVER_PORT: 4000.5 }, "dev"),
    ).toThrow(/SERVER_PORT/);
  });

  it("requires production to use port 443 or 4443 and name its certificate", () => {
    const production = {
      ...valid,
      docs: false,
      SERVER_PORT: 4443,
      MOCK_API_PORT: 3443,
      MOCK_API_BASE_URL: "https://127.0.0.1:3443",
      TLS_CERT: "certs/localhost-cert.pem",
      TLS_KEY: "certs/localhost-key.pem",
    };
    expect(parseRuntimeEnv(production, "production").SERVER_PORT).toBe(4443);
    expect(
      parseRuntimeEnv({ ...production, SERVER_PORT: 443 }, "production")
        .SERVER_PORT,
    ).toBe(443);
    expect(() =>
      parseRuntimeEnv({ ...production, SERVER_PORT: 4000 }, "production"),
    ).toThrow(/SERVER_PORT/);
    const { TLS_CERT: _cert, ...withoutCert } = production;
    expect(() => parseRuntimeEnv(withoutCert, "production")).toThrow(
      /TLS_CERT/,
    );
    expect(() =>
      parseRuntimeEnv({ ...valid, MOCK_API_PORT: 4010 }, "dev"),
    ).toThrow(/MOCK_API_PORT/);
    expect(() =>
      parseRuntimeEnv(
        { ...production, MOCK_API_BASE_URL: "http://127.0.0.1:3443" },
        "production",
      ),
    ).toThrow(/MOCK_API_BASE_URL/);
  });

  it("rejects a file that is not the schema", () => {
    expect(() =>
      parseRuntimeEnv({ ...valid, extra: true }, "production"),
    ).toThrow(/production/);
    expect(() => parseRuntimeEnv({ ...valid, docs: "yes" }, "dev")).toThrow(
      /docs/,
    );
    expect(() =>
      parseRuntimeEnv({ ...valid, MOCK_API_BASE_URL: "not a url" }, "dev"),
    ).toThrow(/MOCK_API_BASE_URL/);
  });
});
