import {
  amountWire,
  commission,
  formatRate,
  parseRate,
  type QuoteRequest,
  type QuoteResponse,
  type RiskBand,
} from "@quote/contract";

/** Stand-in tariff. Percentages with scale 5, not fractions of one. */
export const bandRates: Record<RiskBand, string> = {
  LOW: "0.50000",
  MEDIUM: "1.00000",
  HIGH: "1.50000",
};

export function priceQuote(
  request: QuoteRequest,
  quoteId: string,
): QuoteResponse {
  const rate = parseRate(bandRates[request.riskBand]);
  if (!rate) {
    throw new Error("Band rate is not a valid percentage.");
  }
  const total = commission(request.loanAmount, rate);
  return {
    quoteId,
    currency: request.currency,
    commissionRate: formatRate(rate),
    totalCommission: amountWire(total),
  };
}
