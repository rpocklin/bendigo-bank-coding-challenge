export const CURRENCIES = {
  AUD: { code: "AUD", exponent: 2 },
} as const;

export type CurrencyCode = keyof typeof CURRENCIES;

/** Largest loan principal, in major currency units, before the exponent is applied. */
export const MAX_LOAN_MAJOR = 10_000_000n;

export function maxLoanDigits(exponent: number): bigint {
  return MAX_LOAN_MAJOR * 10n ** BigInt(exponent);
}

/** One minor unit. Exponent 2 means 0.01. Exponent 0 means 1. */
export function minLoanDigits(): bigint {
  return 1n;
}
