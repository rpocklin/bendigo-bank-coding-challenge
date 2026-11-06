import { runtimeEnv } from "@quote/contract/runtime-env";
import { readProductionTls } from "@quote/contract/tls";
import { serve } from "@hono/node-server";
import { createServer } from "node:https";
import { createMockApp } from "./app.js";
import { parseFailureRate } from "./failure-rate.js";

const env = runtimeEnv();
const port = env.MOCK_API_PORT;
const failureRate = parseFailureRate(process.env.FAILURE_RATE);

const app = createMockApp({
  apiKey: env.MOCK_API_KEY,
  failureRate,
  docs: env.docs,
});

if ("TLS_CERT" in env) {
  const tls = readProductionTls(env);
  serve(
    {
      fetch: app.fetch,
      port,
      createServer,
      serverOptions: { key: tls.key, cert: tls.cert },
    },
    () => {
      console.log(
        JSON.stringify({
          service: "mock-api",
          msg: "listening",
          protocol: "https",
          port,
        }),
      );
    },
  );
} else {
  serve({ fetch: app.fetch, port }, () => {
    console.log(
      JSON.stringify({
        service: "mock-api",
        msg: "listening",
        protocol: "http",
        port,
      }),
    );
  });
}
