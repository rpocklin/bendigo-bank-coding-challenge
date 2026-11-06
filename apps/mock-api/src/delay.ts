export const MIN_QUOTE_DELAY_MS = 250;
export const MAX_QUOTE_DELAY_MS = 500;

const QUOTE_DELAY_SPAN_MS = MAX_QUOTE_DELAY_MS - MIN_QUOTE_DELAY_MS;

export function quoteDelayMs(random: () => number = Math.random): number {
  const rolled = random();
  const offset =
    !Number.isFinite(rolled) || rolled <= 0
      ? 0
      : Math.min(
          QUOTE_DELAY_SPAN_MS,
          Math.floor(rolled * (QUOTE_DELAY_SPAN_MS + 1)),
        );
  return MIN_QUOTE_DELAY_MS + offset;
}

export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
