import { z } from "zod";
import {
  commissionScale,
  parseLoanAmount,
  parseRate,
  RATE_SCALE,
} from "./commission.js";
import { CURRENCIES, type CurrencyCode } from "./currency.js";
import {
  detailCodes,
  errorCodes,
  sentence,
  type DetailCode,
  type ErrorCode,
  type MessageParams,
} from "./messages.js";
import { formatDecimal, parseDecimal, type ScaledDecimal } from "./money.js";

export const riskBands = ["LOW", "MEDIUM", "HIGH"] as const;
export type RiskBand = (typeof riskBands)[number];

const currencyCodeSchema = z.enum(["AUD"]).meta({
  description:
    "ISO 4217 currency. Version 1 allows AUD only. There is no default.",
  examples: ["AUD"],
});

export const quoteRequestSchema = z
  .strictObject({
    currency: currencyCodeSchema,
    loanAmount: z.string().meta({
      description:
        "Canonical decimal whose scale is the currency exponent. AUD uses exactly 2 fractional digits, from 0.01 to 10000000.00.",
      examples: ["10000.00"],
    }),
    loanTermInMonths: z
      .int()
      .min(1)
      .max(360)
      .meta({
        description: "Whole months from 1 to 360.",
        examples: [360],
      }),
    riskBand: z.enum(riskBands).meta({
      description: "Case-sensitive risk band.",
      examples: ["HIGH"],
    }),
  })
  .meta({
    description:
      "Loan details for a commission quote. Every field is required.",
  });

export const quoteResponseSchema = z
  .strictObject({
    quoteId: z.uuid().meta({
      description: "Identifier for this quote.",
      examples: ["8d3c1c2e-6f0a-4d1b-9c2e-0a1b2c3d4e5f"],
    }),
    currency: currencyCodeSchema,
    commissionRate: z.string().meta({
      description:
        "Percentage with exactly 5 fractional digits. 1.50000 means 1.5 percent, not the fraction 0.015.",
      examples: ["1.50000"],
    }),
    totalCommission: z.string().meta({
      description:
        "Exact commission. Scale is the currency exponent plus 7. AUD uses exactly 9 fractional digits. 10000.00 at 1.50000 percent is 150.000000000.",
      examples: ["150.000000000"],
    }),
  })
  .meta({ description: "Commission quote. Every field is required." });

export const errorDetailSchema = z.strictObject({
  field: z.string().optional(),
  code: z.enum(detailCodes),
  params: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
});

export const errorBodySchema = z.strictObject({
  code: z.enum(errorCodes),
  message: z.string(),
  details: z.array(errorDetailSchema).optional(),
});

export type QuoteRequestInput = z.infer<typeof quoteRequestSchema>;
export type QuoteResponse = z.infer<typeof quoteResponseSchema>;
export type ErrorBody = z.infer<typeof errorBodySchema>;

export type QuoteRequest = {
  currency: CurrencyCode;
  loanAmount: ScaledDecimal;
  loanTermInMonths: number;
  riskBand: RiskBand;
};

export type ErrorDetail = {
  field?: string;
  code: DetailCode;
  params?: MessageParams;
};

export function errorBody(code: ErrorCode, details?: ErrorDetail[]): ErrorBody {
  const first = details?.[0];
  const message = first ? sentence(first.code, first.params) : sentence(code);
  return details && details.length > 0
    ? { code, message, details }
    : { code, message };
}

function issueDetail(
  issue: z.core.$ZodIssue,
  currency: CurrencyCode | undefined,
): ErrorDetail {
  const field = issue.path[0];
  const fieldName = typeof field === "string" ? field : undefined;

  if (issue.code === "unrecognized_keys") {
    const key = "keys" in issue ? issue.keys[0] : undefined;
    return {
      field: key,
      code: "unknown_field",
      params: { field: key ?? "unknown" },
    };
  }
  if (fieldName === "loanAmount") {
    if (!currency) {
      return {
        field: fieldName,
        code: "missing_field",
        params: { field: fieldName },
      };
    }
    return {
      field: fieldName,
      code: "invalid_amount",
      params: { currency, scale: CURRENCIES[currency].exponent },
    };
  }
  if (fieldName === "loanTermInMonths") {
    return { field: fieldName, code: "invalid_term" };
  }
  if (fieldName === "riskBand") {
    return { field: fieldName, code: "invalid_risk_band" };
  }
  if (fieldName === "currency") {
    return { field: fieldName, code: "invalid_currency" };
  }
  if (fieldName === "commissionRate") {
    return {
      field: fieldName,
      code: "invalid_rate",
      params: { scale: RATE_SCALE },
    };
  }
  if (fieldName === "totalCommission") {
    if (!currency) {
      return { field: fieldName, code: "invalid_currency" };
    }
    return {
      field: fieldName,
      code: "invalid_commission",
      params: {
        currency,
        scale: commissionScale(CURRENCIES[currency].exponent),
      },
    };
  }
  if (fieldName === "quoteId") {
    return { field: fieldName, code: "invalid_quote_id" };
  }
  if (
    issue.code === "invalid_type" &&
    (issue.input === undefined || issue.input === null)
  ) {
    return {
      field: fieldName,
      code: "missing_field",
      params: { field: fieldName ?? "body" },
    };
  }
  return {
    field: fieldName,
    code: "missing_field",
    params: { field: fieldName ?? "body" },
  };
}

function detailsFrom(
  error: z.ZodError,
  currency: CurrencyCode | undefined,
): ErrorDetail[] {
  return error.issues.map((issue) => issueDetail(issue, currency));
}

export function parseQuoteRequest(
  input: unknown,
): { ok: true; value: QuoteRequest } | { ok: false; error: ErrorBody } {
  if (input === undefined || input === null || input === "") {
    return {
      ok: false,
      error: errorBody("invalid_request", [{ code: "missing_body" }]),
    };
  }
  const parsed = quoteRequestSchema.safeParse(input);
  if (!parsed.success) {
    const currency = currencyOf(input);
    const details = detailsFrom(parsed.error, currency);
    const rawAmount =
      typeof input === "object" && input !== null && "loanAmount" in input
        ? input.loanAmount
        : undefined;
    if (currency) {
      const exponent = CURRENCIES[currency].exponent;
      if (
        typeof rawAmount === "string" &&
        !parseLoanAmount(rawAmount, exponent) &&
        !details.some((detail) => detail.field === "loanAmount")
      ) {
        details.unshift({
          field: "loanAmount",
          code: "invalid_amount",
          params: { currency, scale: exponent },
        });
      }
    }
    return { ok: false, error: errorBody("invalid_request", details) };
  }
  const exponent = CURRENCIES[parsed.data.currency].exponent;
  const loanAmount = parseLoanAmount(parsed.data.loanAmount, exponent);
  if (!loanAmount) {
    return {
      ok: false,
      error: errorBody("invalid_request", [
        {
          field: "loanAmount",
          code: "invalid_amount",
          params: { currency: parsed.data.currency, scale: exponent },
        },
      ]),
    };
  }
  return {
    ok: true,
    value: {
      currency: parsed.data.currency,
      loanAmount,
      loanTermInMonths: parsed.data.loanTermInMonths,
      riskBand: parsed.data.riskBand,
    },
  };
}

export function parseQuoteResponse(
  input: unknown,
): { ok: true; value: QuoteResponse } | { ok: false; error: ErrorBody } {
  const parsed = quoteResponseSchema.safeParse(input);
  if (!parsed.success) {
    const currency = currencyOf(input);
    return {
      ok: false,
      error: errorBody(
        "vendor_unavailable",
        detailsFrom(parsed.error, currency),
      ),
    };
  }
  const exponent = CURRENCIES[parsed.data.currency].exponent;
  const rate = parseRate(parsed.data.commissionRate);
  const total = parseDecimal(
    parsed.data.totalCommission,
    commissionScale(exponent),
  );
  if (!rate) {
    return {
      ok: false,
      error: errorBody("vendor_unavailable", [
        {
          field: "commissionRate",
          code: "invalid_rate",
          params: { scale: RATE_SCALE },
        },
      ]),
    };
  }
  if (!total) {
    return {
      ok: false,
      error: errorBody("vendor_unavailable", [
        {
          field: "totalCommission",
          code: "invalid_commission",
          params: {
            currency: parsed.data.currency,
            scale: commissionScale(exponent),
          },
        },
      ]),
    };
  }
  return { ok: true, value: parsed.data };
}

function currencyOf(input: unknown): CurrencyCode | undefined {
  if (typeof input !== "object" || input === null || !("currency" in input)) {
    return undefined;
  }
  const currency = input.currency;
  if (typeof currency !== "string" || !(currency in CURRENCIES)) {
    return undefined;
  }
  return currency as CurrencyCode;
}

export function amountWire(amount: ScaledDecimal): string {
  return formatDecimal(amount);
}
