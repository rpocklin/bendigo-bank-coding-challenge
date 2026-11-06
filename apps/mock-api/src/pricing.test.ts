import { parseLoanAmount, parseQuoteRequest } from "@quote/contract";
import { describe, expect, it } from "vitest";
import { priceQuote } from "./pricing.js";

describe("priceQuote", () => {
  it("uses the HIGH percentage and does not import HTTP types", () => {
    const parsed = parseQuoteRequest({
      currency: "AUD",
      loanAmount: "10000.00",
      loanTermInMonths: 12,
      riskBand: "HIGH",
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.loanAmount).toEqual(parseLoanAmount("10000.00", 2));
    const quote = priceQuote(
      parsed.value,
      "8d3c1c2e-6f0a-4d1b-9c2e-0a1b2c3d4e5f",
    );
    expect(quote.commissionRate).toBe("1.50000");
    expect(quote.totalCommission).toBe("150.000000000");
  });
});
