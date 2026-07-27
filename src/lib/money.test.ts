import { describe, expect, it } from "vitest";
import { addFils, dirhams, fils, formatMoney, percentOf, splitEvenly } from "./money";

describe("fils", () => {
  it("refuses a fractional minor unit", () => {
    expect(() => fils(12.5)).toThrow();
  });

  it("converts dirhams to fils", () => {
    expect(dirhams(90)).toBe(9000);
    expect(dirhams(22.5)).toBe(2250);
    // 0.1 + 0.2 territory: must not leak a float.
    expect(dirhams(0.3)).toBe(30);
  });
});

describe("splitEvenly", () => {
  it("divides evenly when it can", () => {
    expect(splitEvenly(dirhams(90), 4)).toEqual([2250, 2250, 2250, 2250]);
  });

  it("always sums back to the total, however awkward", () => {
    for (const total of [1, 7, 99, 100, 10_000, 10_001, 33_333]) {
      for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) {
        const shares = splitEvenly(fils(total), n);
        expect(shares).toHaveLength(n);
        expect(addFils(...shares)).toBe(total);
      }
    }
  });

  it("gives the remainder to the earliest shares, deterministically", () => {
    // AED 100.00 across 3 = 3333.33..; the booker sorts first and absorbs a fil.
    expect(splitEvenly(dirhams(100), 3)).toEqual([3334, 3333, 3333]);
  });

  it("refuses a zero split", () => {
    expect(() => splitEvenly(dirhams(90), 0)).toThrow();
  });
});

describe("percentOf", () => {
  it("rounds to the nearest fil", () => {
    expect(percentOf(dirhams(90), 50)).toBe(4500);
    expect(percentOf(fils(333), 50)).toBe(167); // 166.5 -> 167
  });
});

describe("formatMoney", () => {
  it("uses Latin digits in Arabic — money columns get compared and copied", () => {
    const ar = formatMoney(dirhams(90), "ar");
    expect(ar).toMatch(/90\.00/);
    expect(ar).not.toMatch(/[٠-٩]/);
  });

  it("always shows two decimal places", () => {
    expect(formatMoney(dirhams(90), "en")).toMatch(/90\.00/);
  });
});
