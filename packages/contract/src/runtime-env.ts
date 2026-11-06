import { readFileSync } from "node:fs";
import { z } from "zod";

const port = z.int().min(1).max(65535);
const vendorPort = z.int().min(3000).max(3999);

const sharedEnv = {
  docs: z.boolean(),
  MOCK_API_KEY: z.string().trim().min(1),
};

function alignVendorUrl(
  value: { MOCK_API_PORT: number; MOCK_API_BASE_URL: string },
  ctx: z.RefinementCtx,
  protocol: "http" | "https",
) {
  let url: URL;
  try {
    url = new URL(value.MOCK_API_BASE_URL);
  } catch {
    ctx.addIssue({
      code: "custom",
      path: ["MOCK_API_BASE_URL"],
      message: "must be a valid URL",
    });
    return;
  }
  if (url.protocol !== `${protocol}:`) {
    ctx.addIssue({
      code: "custom",
      path: ["MOCK_API_BASE_URL"],
      message: `must use ${protocol}`,
    });
  }
  if (url.port !== String(value.MOCK_API_PORT)) {
    ctx.addIssue({
      code: "custom",
      path: ["MOCK_API_BASE_URL"],
      message: "must use MOCK_API_PORT",
    });
  }
}

export const devEnvSchema = z
  .strictObject({
    ...sharedEnv,
    SERVER_PORT: port,
    MOCK_API_PORT: vendorPort,
    MOCK_API_BASE_URL: z.url(),
  })
  .superRefine((value, ctx) => alignVendorUrl(value, ctx, "http"));

export const productionEnvSchema = z
  .strictObject({
    ...sharedEnv,
    SERVER_PORT: z.union([z.literal(443), z.literal(4443)]),
    MOCK_API_PORT: vendorPort,
    MOCK_API_BASE_URL: z.url(),
    TLS_CERT: z.string().trim().min(1),
    TLS_KEY: z.string().trim().min(1),
  })
  .superRefine((value, ctx) => alignVendorUrl(value, ctx, "https"));

export type DevEnv = z.infer<typeof devEnvSchema>;
export type ProductionEnv = z.infer<typeof productionEnvSchema>;
export type RuntimeEnv = DevEnv | ProductionEnv;

export function parseRuntimeEnv(input: unknown, name: string): RuntimeEnv {
  const schema = name === "production" ? productionEnvSchema : devEnvSchema;
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "file"}: ${issue.message}`)
      .join("; ");
    throw new Error(`env/${name}.json is invalid: ${details}`);
  }
  return parsed.data;
}

export function runtimeEnv(
  nodeEnv: string | undefined = process.env.NODE_ENV,
): RuntimeEnv {
  const name = nodeEnv === "production" ? "production" : "dev";
  const file = new URL(`../../../env/${name}.json`, import.meta.url);
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch (error) {
    throw new Error(`env/${name}.json could not be read`, { cause: error });
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (error) {
    throw new Error(`env/${name}.json is not valid JSON`, { cause: error });
  }
  return parseRuntimeEnv(json, name);
}
