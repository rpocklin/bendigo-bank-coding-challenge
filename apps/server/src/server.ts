import { runtimeEnv } from "@quote/contract/runtime-env";
import { readProductionTls } from "@quote/contract/tls";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { createServer } from "node:https";
import { fileURLToPath } from "node:url";
import { createServerApp } from "./app.js";
import { trustedVendorFetch } from "./vendor-fetch.js";

const env = runtimeEnv();
const port = env.SERVER_PORT;
const tls = "TLS_CERT" in env ? readProductionTls(env) : undefined;
const app = createServerApp({
  baseUrl: env.MOCK_API_BASE_URL,
  apiKey: env.MOCK_API_KEY,
  docs: env.docs,
  ...(tls ? { fetchImpl: trustedVendorFetch(tls.cert) } : {}),
});

if (tls) {
  const root = fileURLToPath(new URL("../../web/dist/", import.meta.url));
  app.use(
    "/*",
    serveStatic({
      root,
      rewriteRequestPath: (requestPath) => requestPath.replace(/^\//, ""),
    }),
  );
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
          service: "server",
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
        service: "server",
        msg: "listening",
        protocol: "http",
        port,
      }),
    );
  });
}
