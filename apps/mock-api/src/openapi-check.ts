import { readFileSync, writeFileSync } from "node:fs";
import { createMockApp } from "./app.js";

const app = createMockApp({
  apiKey: "example",
  failureRate: 0,
  random: () => 1,
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
    "apps/mock-api/openapi.json does not match the generated document.",
  );
  process.exit(1);
}
