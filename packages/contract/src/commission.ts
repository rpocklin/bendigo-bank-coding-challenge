import { maxLoanDigits, minLoanDigits } from "./currency.js";
import {
  formatDecimal,
  multiply,
  parseDecimal,
  shiftScale,
  type ScaledDecimal,
} from "./money.js";

/** Fractional digits on a percentage. 1.50000 means 1.5 percent. */
export const RATE_SCALE = 5;

const MIN_RATE_DIGITS = 1n;
const MAX_RATE_DIGITS = 100n * 10n ** BigInt(RATE_SCALE);

export function commissionScale(exponent: number): number {
  return exponent + RATE_SCALE + 2;
}

/** `amount * (rate / 100)`. Dividing by 100 only adds 2 to the scale. */
export function commission(
  amount: ScaledDecimal,
  rate: ScaledDecimal,
): ScaledDecimal {
  return multiply(amount, shiftScale(rate, 2));
}

export function parseRate(input: string): ScaledDecimal | undefined {
  const rate = parseDecimal(input, RATE_SCALE);
  if (!rate || rate.digits < MIN_RATE_DIGITS || rate.digits > MAX_RATE_DIGITS) {
    return undefined;
  }
  return rate;
}

export function parseLoanAmount(
  input: string,
  exponent: number,
): ScaledDecimal | undefined {
  const amount = parseDecimal(input, exponent);
  if (
    !amount ||
    amount.digits < minLoanDigits() ||
    amount.digits > maxLoanDigits(exponent)
  ) {
    return undefined;
  }
  return amount;
}

export function formatRate(rate: ScaledDecimal): string {
  return formatDecimal(rate);
}
