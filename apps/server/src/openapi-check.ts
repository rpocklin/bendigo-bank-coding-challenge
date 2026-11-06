import { readFileSync, writeFileSync } from "node:fs";
import { createServerApp } from "./app.js";

const app = createServerApp({
  baseUrl: "http://127.0.0.1:3010",
  apiKey: "example",
  fetchImpl: async () => new Response(null, { status: 500 }),
});
const response = await app.request("/v1/openapi.json");
const body = JSON.stringify(await response.json(), null, 2);
const file = new URL("../openapi.json", import.meta.url);

if (process.argv.includes("--write")) {
  writeFileSync(file, `${body}\n`);
  process.exit(0);
}

const current = readFileSync(file, "utf8");
if (current !== `${body}\n`) {
  console.error(
    "apps/server/openapi.json does not match the generated document.",
  );
  process.exit(1);
}
