import { describe, expect, it } from "vitest";
import { parseFailureRate } from "./failure-rate.js";

describe("parseFailureRate", () => {
  it("defaults when the variable is unset", () => {
    expect(parseFailureRate(undefined)).toBe(0.15);
  });

  it("accepts a rate from 0 to 1", () => {
    expect(parseFailureRate("0")).toBe(0);
    expect(parseFailureRate("1")).toBe(1);
    expect(parseFailureRate("0.15")).toBe(0.15);
  });

  it("rejects a blank, a word, and a rate above 1", () => {
    expect(() => parseFailureRate("")).toThrow(/FAILURE_RATE/);
    expect(() => parseFailureRate("abc")).toThrow(/FAILURE_RATE/);
    expect(() => parseFailureRate("1.5")).toThrow(/FAILURE_RATE/);
  });
});
