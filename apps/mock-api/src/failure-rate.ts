const DEFAULT_FAILURE_RATE = 0.15;

export function parseFailureRate(raw: string | undefined): number {
  if (raw === undefined) return DEFAULT_FAILURE_RATE;
  const text = raw.trim();
  const value = Number(text);
  if (
    text === "" ||
    !/^\d+(?:\.\d+)?$/.test(text) ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 1
  ) {
    throw new Error("FAILURE_RATE must be a number from 0 to 1");
  }
  return value;
}
