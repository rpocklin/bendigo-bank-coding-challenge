import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { ProductionEnv } from "./runtime-env.js";

export function repoFile(relativePath: string): string {
  return fileURLToPath(new URL(`../../../${relativePath}`, import.meta.url));
}

export function readProductionTls(env: ProductionEnv): {
  key: Buffer;
  cert: Buffer;
} {
  const certPath = repoFile(env.TLS_CERT);
  const keyPath = repoFile(env.TLS_KEY);
  try {
    return {
      cert: readFileSync(certPath),
      key: readFileSync(keyPath),
    };
  } catch (error) {
    throw new Error(
      `Production TLS files could not be read (${env.TLS_CERT}, ${env.TLS_KEY})`,
      { cause: error },
    );
  }
}
