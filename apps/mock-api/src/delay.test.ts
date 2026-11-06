import { describe, expect, it } from "vitest";
import {
  MAX_QUOTE_DELAY_MS,
  MIN_QUOTE_DELAY_MS,
  quoteDelayMs,
} from "./delay.js";

describe("quote delay", () => {
  it("is a random wait from 250ms through 500ms", () => {
    expect(quoteDelayMs(() => 0)).toBe(MIN_QUOTE_DELAY_MS);
    expect(quoteDelayMs(() => 0.5)).toBe(375);
    expect(quoteDelayMs(() => 0.999)).toBe(MAX_QUOTE_DELAY_MS);
    expect(quoteDelayMs(() => 1)).toBe(MAX_QUOTE_DELAY_MS);
  });
});
