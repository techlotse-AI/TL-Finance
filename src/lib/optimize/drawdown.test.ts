import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import { computeDrawdown } from "@/lib/optimize/drawdown";
import { drawdownRequestSchema } from "@/lib/optimize/schemas";

/** The feature-request fixtures are rounded whole amounts; assert ≤ ±0.5%. */
function expectWithinHalfPercent(actual: string, expected: string) {
  const relativeError = new Decimal(actual).minus(expected).abs().dividedBy(expected);
  expect(
    relativeError.lessThanOrEqualTo("0.005"),
    `${actual} is not within 0.5% of ${expected} (relative error ${relativeError.toFixed(6)})`,
  ).toBe(true);
}

// Drawdown fixtures from the feature request: V = 2'640'574 at age 65.
const exampleDrawdown = {
  currency: "CHF",
  startingCapital: "2640574",
  startAge: 65,
  annualReturnRates: ["0.02", "0.03", "0.05"],
  depleteAtAges: [85, 90, 95],
  monthlyExpense: "10929",
};

describe("computeDrawdown", () => {
  it("reproduces the fixed-horizon annuity fixture table", () => {
    const result = computeDrawdown(exampleDrawdown);
    const byRate = new Map(result.byRate.map((entry) => [entry.annualReturnRate, entry]));

    const expected: Record<string, [string, string, string]> = {
      "0.020000": ["13336", "11169", "9736"],
      "0.030000": ["14591", "12466", "11075"],
      "0.050000": ["17265", "15266", "13996"],
    };
    for (const [rate, [at85, at90, at95]] of Object.entries(expected)) {
      const entry = byRate.get(rate)!;
      expectWithinHalfPercent(entry.depleteBy[0]!.monthlyDraw, at85);
      expectWithinHalfPercent(entry.depleteBy[1]!.monthlyDraw, at90);
      expectWithinHalfPercent(entry.depleteBy[2]!.monthlyDraw, at95);
    }
  });

  it("reproduces the endowment fixture column (PMT = V·i)", () => {
    const result = computeDrawdown(exampleDrawdown);
    const byRate = new Map(result.byRate.map((entry) => [entry.annualReturnRate, entry]));

    expectWithinHalfPercent(byRate.get("0.020000")!.endowmentMonthlyDraw, "4361");
    expectWithinHalfPercent(byRate.get("0.030000")!.endowmentMonthlyDraw, "6512");
    expectWithinHalfPercent(byRate.get("0.050000")!.endowmentMonthlyDraw, "10758");
  });

  it("computes fixed-expense depletion ages for a 10'929/mo draw", () => {
    const result = computeDrawdown({ ...exampleDrawdown, annualReturnRates: ["0.02", "0.03", "0.04"] });

    // The request quotes "~91 (2%), ~96 (3%), ~105 (4%)".
    const ages = result.byRate.map((entry) => entry.fixedExpense!.depletionAge!);
    expect(ages[0]).toBeGreaterThanOrEqual(90.2);
    expect(ages[0]).toBeLessThanOrEqual(91.2);
    expect(ages[1]).toBeGreaterThanOrEqual(95.2);
    expect(ages[1]).toBeLessThanOrEqual(96.2);
    expect(ages[2]).toBeGreaterThanOrEqual(104.2);
    expect(ages[2]).toBeLessThanOrEqual(105.2);
    for (const entry of result.byRate) {
      expect(entry.fixedExpense!.sustainable).toBe(false);
    }
  });

  it("reports the 5% fixed-expense case truthfully instead of claiming forever", () => {
    // The request labels this "forever", but V·i ≈ 10'758 < 10'929, so the
    // capital does deplete — around age 150, far beyond the display cap of
    // 120. The engine reports the truth; presentation renders it as
    // "effectively forever".
    const result = computeDrawdown({ ...exampleDrawdown, annualReturnRates: ["0.05"] });
    const fixedExpense = result.byRate[0]!.fixedExpense!;

    expect(fixedExpense.sustainable).toBe(false);
    expect(fixedExpense.depletionAge).toBeGreaterThan(120);
  });

  it("flags a draw at or below V·i as sustainable with no depletion age", () => {
    const result = computeDrawdown({
    ...exampleDrawdown,
      annualReturnRates: ["0.05"],
      monthlyExpense: "10000",
    });
    const fixedExpense = result.byRate[0]!.fixedExpense!;

    expect(fixedExpense.sustainable).toBe(true);
    expect(fixedExpense.depletionMonths).toBeNull();
    expect(fixedExpense.depletionAge).toBeNull();
  });

  it("uses the zero-rate branches exactly", () => {
    const result = computeDrawdown({
      currency: "CHF",
      startingCapital: "120000",
      startAge: 65,
      annualReturnRates: ["0"],
      depleteAtAges: [75],
      monthlyExpense: "1000",
    });
    const entry = result.byRate[0]!;

    // PMT = V/n = 120000/120 and n = V/PMT = 120 months exactly.
    expect(entry.depleteBy[0]).toEqual({ targetAge: 75, months: 120, monthlyDraw: "1000.0000" });
    expect(entry.endowmentMonthlyDraw).toBe("0.0000");
    expect(entry.fixedExpense).toMatchObject({ sustainable: false, depletionMonths: 120, depletionAge: 75 });
  });

  it("keeps the endowment curve flat and ends deplete curves at zero", () => {
    const result = computeDrawdown(exampleDrawdown);
    const entry = result.byRate[1]!; // 3%

    const endowment = entry.curves.find((curve) => curve.mode === "endowment")!;
    for (const point of endowment.points) {
      expect(point.balance).toBe("2640574.0000");
    }

    const depleteAt90 = entry.curves.find((curve) => curve.mode === "deplete_90")!;
    const last = depleteAt90.points.at(-1)!;
    expect(last.age).toBeGreaterThanOrEqual(89.5);
    expect(last.age).toBeLessThanOrEqual(90);
    // The closed-form PMT exhausts the capital at the horizon (± rounding).
    expect(new Decimal(last.balance).lessThanOrEqualTo(5)).toBe(true);
  });

  it("declares its real-terms assumptions", () => {
    const result = computeDrawdown(exampleDrawdown);

    expect(result.assumptions).toEqual({
      compounding: "effective_monthly",
      withdrawalTiming: "end_of_month",
      inflationHandling: "real_terms",
      foreverDisplayCapAge: 120,
    });
  });
});

describe("drawdownRequestSchema", () => {
  it("rejects depletion ages at or below the start age and duplicates", () => {
    expect(() =>
      drawdownRequestSchema.parse({
        currency: "CHF",
        startingCapital: "1000000",
        startAge: 65,
        annualReturnRates: ["0.03"],
        depleteAtAges: [65],
      }),
    ).toThrow();
    expect(() =>
      drawdownRequestSchema.parse({
        currency: "CHF",
        startingCapital: "1000000",
        startAge: 65,
        annualReturnRates: ["0.03"],
        depleteAtAges: [85, 85],
      }),
    ).toThrow();
  });
});
