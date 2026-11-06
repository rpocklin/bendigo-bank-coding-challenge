/**
 * A non-negative decimal. `digits` is the integer value of all digits.
 * `scale` is the number of digits after the decimal point.
 * The value is `digits / 10^scale`.
 */
export type ScaledDecimal = {
  readonly digits: bigint;
  readonly scale: number;
};

const WHOLE = "(?:0|[1-9][0-9]*)";

export function parseDecimal(
  input: string,
  scale: number,
): ScaledDecimal | undefined {
  if (!Number.isInteger(scale) || scale < 0) {
    return undefined;
  }
  const pattern =
    scale === 0
      ? new RegExp(`^${WHOLE}$`)
      : new RegExp(`^${WHOLE}\\.[0-9]{${scale}}$`);
  if (!pattern.test(input)) {
    return undefined;
  }
  const digits = BigInt(input.replace(".", ""));
  return { digits, scale };
}

export function formatDecimal(value: ScaledDecimal): string {
  if (value.scale === 0) {
    return value.digits.toString();
  }
  const raw = value.digits.toString().padStart(value.scale + 1, "0");
  const whole = raw.slice(0, raw.length - value.scale);
  const fraction = raw.slice(raw.length - value.scale);
  return `${whole}.${fraction}`;
}

/** Exact product. The result scale is the sum of the input scales. */
export function multiply(
  left: ScaledDecimal,
  right: ScaledDecimal,
): ScaledDecimal {
  return {
    digits: left.digits * right.digits,
    scale: left.scale + right.scale,
  };
}

/**
 * Exact division by 10^places. Digits stay the same and the scale grows,
 * so this never rounds.
 */
export function shiftScale(
  value: ScaledDecimal,
  places: number,
): ScaledDecimal {
  return { digits: value.digits, scale: value.scale + places };
}
