import { describe, expect, it } from "vitest";
import {
  fold,
  foldDigits,
  foldedIncludes,
  formatPhone,
  normalisePhone,
  withinBound,
} from "./text";

describe("fold — Arabic search", () => {
  it("collapses alef variants: staff type the bare alef", () => {
    // A customer saved as أحمد must be findable by typing احمد.
    expect(fold("أحمد")).toBe(fold("احمد"));
    expect(fold("إبراهيم")).toBe(fold("ابراهيم"));
    expect(fold("آمنة")).toBe(fold("امنه"));
  });

  it("collapses ta marbuta and alef maqsura", () => {
    expect(fold("فاطمة")).toBe(fold("فاطمه"));
    expect(fold("مصطفى")).toBe(fold("مصطفي"));
  });

  it("strips diacritics and tatweel", () => {
    expect(fold("مُحَمَّد")).toBe(fold("محمد"));
    expect(fold("محـــمد")).toBe(fold("محمد"));
  });

  it("folds case for Latin", () => {
    expect(fold("Ahmed Al Nasr")).toBe(fold("ahmed al nasr"));
  });
});

describe("foldDigits", () => {
  it("normalises Arabic-Indic digits", () => {
    expect(foldDigits("٠٥٠١٢٣٤٥٦٧")).toBe("0501234567");
  });
});

describe("foldedIncludes", () => {
  it("matches everything on an empty needle", () => {
    expect(foldedIncludes("anything", "")).toBe(true);
  });

  it("finds an Arabic name typed without hamza", () => {
    expect(foldedIncludes("أحمد النصر", "احمد")).toBe(true);
  });
});

describe("normalisePhone — the practical primary key", () => {
  it("treats every written form of one number as the same customer", () => {
    const forms = [
      "050 123 4567",
      "+971501234567",
      "00971501234567",
      "0501234567",
      "٠٥٠١٢٣٤٥٦٧",
      "971 50 123 4567",
    ];
    const normalised = forms.map((f) => normalisePhone(f));
    expect(new Set(normalised).size).toBe(1);
    expect(normalised[0]).toBe("971501234567");
  });

  it("returns empty for junk rather than a bogus key", () => {
    expect(normalisePhone("")).toBe("");
    expect(normalisePhone("n/a")).toBe("");
  });
});

describe("formatPhone", () => {
  it("renders a UAE number in the local grouping", () => {
    expect(formatPhone("971501234567")).toBe("+971 50 123 4567");
  });
});

describe("withinBound — Number(null) is 0", () => {
  it("does not let a null price pass a max filter as though it were free", () => {
    expect(withinBound(null, null, 10_000)).toBe(false);
    expect(withinBound(undefined, null, 10_000)).toBe(false);
    // The bug this guards: Number(null) === 0, and 0 <= 10000.
    expect(Number(null)).toBe(0);
  });

  it("passes a real value inside the bounds", () => {
    expect(withinBound(5_000, 1_000, 10_000)).toBe(true);
    expect(withinBound(500, 1_000, 10_000)).toBe(false);
    expect(withinBound(50_000, 1_000, 10_000)).toBe(false);
  });
});
