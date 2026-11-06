import { describe, expect, it } from "vitest";
import {
  commission,
  parseLoanAmount,
  parseRate,
  RATE_SCALE,
} from "./commission.js";
import { CURRENCIES, maxLoanDigits } from "./currency.js";
import { formatDecimal, multiply, parseDecimal, shiftScale } from "./money.js";
import {
  detailCodes,
  en,
  errorCodes,
  resolveLocale,
  type CatalogCode,
} from "./messages.js";
import { parseQuoteRequest, parseQuoteResponse } from "./schemas.js";

describe("ScaledDecimal", () => {
  it("prices 10000.00 AUD at 1.50000 percent as 150.000000000", () => {
    const amount = parseLoanAmount("10000.00", CURRENCIES.AUD.exponent);
    const rate = parseRate("1.50000");
    expect(amount).toBeDefined();
    expect(rate).toBeDefined();
    if (!amount || !rate) return;
    expect(formatDecimal(commission(amount, rate))).toBe("150.000000000");
  });

  it("prices 100.01 AUD at 0.50000 percent as 0.500050000", () => {
    const amount = parseLoanAmount("100.01", CURRENCIES.AUD.exponent);
    const rate = parseRate("0.50000");
    expect(amount && rate && formatDecimal(commission(amount, rate))).toBe(
      "0.500050000",
    );
  });

  it("rejects non-canonical amount strings", () => {
    for (const input of [
      "100.5",
      "1e2",
      "0100.00",
      "100.999",
      "",
      "-1.00",
      "0.00",
    ]) {
      expect(
        parseLoanAmount(input, CURRENCIES.AUD.exponent),
        input,
      ).toBeUndefined();
    }
  });

  it("rejects a fraction written with the wrong scale, an oversized rate, and zero", () => {
    expect(parseRate("0.0150")).toBeUndefined();
    expect(parseRate("100.00001")).toBeUndefined();
    expect(parseRate("0.00000")).toBeUndefined();
    expect(parseRate("1.50000")?.scale).toBe(RATE_SCALE);
  });

  it("reads the amount scale from the exponent, including a scale of 0", () => {
    expect(parseDecimal("5", 0)).toEqual({ digits: 5n, scale: 0 });
    const major = parseDecimal("5", 0);
    const rate = parseRate("1.00000");
    expect(major && rate && formatDecimal(commission(major, rate))).toBe(
      "0.0500000",
    );
    expect(maxLoanDigits(0)).toBe(10_000_000n);
    expect(parseDecimal("10000000", 0)?.digits).toBe(maxLoanDigits(0));
    expect(parseDecimal("10000001", 0)?.digits).toBe(10_000_001n);
  });

  it("divides by 100 by shifting scale and multiplies digits", () => {
    const amount = parseDecimal("10000.00", 2);
    const rate = parseDecimal("1.50000", 5);
    expect(amount && rate).toBeTruthy();
    if (!amount || !rate) return;
    const fraction = shiftScale(rate, 2);
    expect(fraction).toEqual({ digits: rate.digits, scale: 7 });
    expect(multiply(amount, fraction)).toEqual(commission(amount, rate));
  });
});

describe("quote schema", () => {
  const valid = {
    currency: "AUD",
    loanAmount: "10000.00",
    loanTermInMonths: 360,
    riskBand: "HIGH",
  };

  it("rejects JPY without treating the amount as AUD", () => {
    const result = parseQuoteRequest({ ...valid, currency: "JPY" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("invalid_request");
    expect(result.error.message).toBe(en.invalid_currency);
    expect(result.error.details).toEqual([
      { field: "currency", code: "invalid_currency" },
    ]);
    expect(JSON.stringify(result.error)).not.toContain("AUD");
  });

  it("rejects JSON numbers for the decimal fields", () => {
    const result = parseQuoteRequest({ ...valid, loanAmount: 10000 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.details?.[0]?.code).toBe("invalid_amount");
  });

  it("rejects an unknown field", () => {
    const result = parseQuoteRequest({ ...valid, extra: true });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.details?.[0]?.code).toBe("unknown_field");
  });

  it("rejects a response rate that is not a 5-digit percentage", () => {
    const result = parseQuoteResponse({
      quoteId: "8d3c1c2e-6f0a-4d1b-9c2e-0a1b2c3d4e5f",
      currency: "AUD",
      commissionRate: "0.0150",
      totalCommission: "150.000000000",
    });
    expect(result.ok).toBe(false);
  });
});

describe("catalog", () => {
  it("has an English sentence for every error and detail code", () => {
    const codes = [...errorCodes, ...detailCodes] as CatalogCode[];
    for (const code of codes) {
      expect(en[code].length, code).toBeGreaterThan(0);
    }
  });

  it("resolves every Accept-Language value to en", () => {
    expect(resolveLocale(undefined)).toBe("en");
    expect(resolveLocale("fr")).toBe("en");
    expect(resolveLocale("en-AU,fr;q=0.8")).toBe("en");
  });
});
