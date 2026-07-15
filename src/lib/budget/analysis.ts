import Decimal from "decimal.js";

import { money, serializeMoney } from "@/lib/money/decimal";
import { RECONCILIATION_TOLERANCE, roundToNearest5 } from "@/lib/money/rounding";

/**
 * Deterministic, explainable budget analysis (v0.9.0). Given the household's
 * recurrence-normalized monthly budget lines — already converted to the
 * reporting currency by the caller — it summarizes where the money goes, how it
 * compares to the 50/30/20 guideline, where the realistic savings opportunities
 * are, and whether the plan balances to zero (within the whole-amount ±5
 * tolerance). It reads only and persists nothing.
 *
 * Kinds map to the 50/30/20 buckets as: needs = essential EXPENSE; wants =
 * non-essential EXPENSE; savings = SAVING + INVESTMENT + RETIREMENT (plus any
 * unallocated surplus). Income is the INCOME total.
 *
 * Every figure that reaches the UI is also surfaced rounded to the nearest 5
 * (`*Rounded`/number fields) for the zero-cent budget; ratios are percentages.
 */

export type BudgetLineKind = "INCOME" | "EXPENSE" | "SAVING" | "INVESTMENT" | "RETIREMENT";

export interface BudgetLineInput {
  name: string;
  /** Category group label, used for the spend-by-group breakdown. */
  group: string;
  category: string;
  kind: BudgetLineKind;
  essential: boolean;
  /** Recurrence-normalized monthly amount in the reporting currency. */
  monthlyAmount: string;
  /** True for an EXPENSE provision — an annual/periodic bill saved monthly. */
  provision?: boolean;
}

export interface BudgetAnalysisInput {
  reportingCurrency: string;
  lines: BudgetLineInput[];
  /** Balance tolerance in whole units; defaults to the reconciliation tolerance (±5). */
  toleranceUnits?: number;
}

export interface SpendSlice {
  label: string;
  monthly: string;
  /** Rounded to nearest 5, as a number for charts. */
  monthlyRounded: number;
  /** Share of total expense, 0..100. */
  percentOfExpense: number;
}

export interface SavingsOpportunity {
  category: string;
  group: string;
  monthly: string;
  monthlyRounded: number;
  percentOfIncome: number;
  /** Suggested monthly amount freed if trimmed by the suggested fraction, rounded to 5. */
  suggestedMonthlySaving: number;
  note: string;
}

export interface GuidelineComparison {
  /** Recommended share of income for this bucket, 0..100. */
  targetPercent: number;
  actualPercent: number;
  actualMonthly: string;
  /** targetPercent * income - actual; positive means room left, negative means over. */
  varianceMonthly: string;
  status: "under" | "on_target" | "over";
}

export interface BudgetAnalysisResult {
  reportingCurrency: string;
  totalIncome: string;
  totalExpense: string;
  totalSavingAllocations: string;
  /** Of which: EXPENSE lines flagged as provisions (annual bills saved monthly). */
  provisionsMonthly: string;
  /** The saving-allocation split by kind (their sum is totalSavingAllocations). */
  savingMonthly: string;
  investingMonthly: string;
  retirementMonthly: string;
  /** income - expense - saving allocations. */
  netMonthly: string;
  /** (saving allocations + positive net) / income, 0..100. */
  savingsRatePercent: number;
  essentialMonthly: string;
  discretionaryMonthly: string;
  /** essential / total expense, 0..100. */
  essentialRatioPercent: number;
  topSpendCategories: SpendSlice[];
  spendByGroup: SpendSlice[];
  needsWantsSavings: {
    needs: GuidelineComparison;
    wants: GuidelineComparison;
    savings: GuidelineComparison;
  };
  savingsOpportunities: SavingsOpportunity[];
  /** True when income - (expense + saving allocations) is within ±tolerance. */
  balancesToZero: boolean;
  insights: string[];
}

const SAVING_KINDS: ReadonlySet<BudgetLineKind> = new Set<BudgetLineKind>(["SAVING", "INVESTMENT", "RETIREMENT"]);

function pct(part: Decimal, whole: Decimal): number {
  if (whole.isZero()) return 0;
  return Number(part.dividedBy(whole).times(100).toDecimalPlaces(2));
}

function aggregate(map: Map<string, { value: Decimal; group: string }>, key: string, group: string, value: Decimal): void {
  const existing = map.get(key);
  if (existing) {
    existing.value = existing.value.plus(value);
  } else {
    map.set(key, { value, group });
  }
}

export function computeBudgetAnalysis(input: BudgetAnalysisInput): BudgetAnalysisResult {
  const tolerance = input.toleranceUnits ?? RECONCILIATION_TOLERANCE;

  let totalIncome = new Decimal(0);
  let totalExpense = new Decimal(0);
  let totalSaving = new Decimal(0);
  let provisions = new Decimal(0);
  let saving = new Decimal(0);
  let investing = new Decimal(0);
  let retirement = new Decimal(0);
  let essential = new Decimal(0);
  let discretionary = new Decimal(0);
  let needs = new Decimal(0);
  let wants = new Decimal(0);

  const expenseByCategory = new Map<string, { value: Decimal; group: string }>();
  const expenseByGroup = new Map<string, { value: Decimal; group: string }>();

  for (const line of input.lines) {
    const amount = money(line.monthlyAmount);
    switch (line.kind) {
      case "INCOME":
        totalIncome = totalIncome.plus(amount);
        break;
      case "EXPENSE":
        totalExpense = totalExpense.plus(amount);
        if (line.provision) {
          provisions = provisions.plus(amount);
        }
        if (line.essential) {
          essential = essential.plus(amount);
          needs = needs.plus(amount);
        } else {
          discretionary = discretionary.plus(amount);
          wants = wants.plus(amount);
        }
        aggregate(expenseByCategory, line.category, line.group, amount);
        aggregate(expenseByGroup, line.group, line.group, amount);
        break;
      default:
        // SAVING / INVESTMENT / RETIREMENT
        if (SAVING_KINDS.has(line.kind)) {
          totalSaving = totalSaving.plus(amount);
          if (line.kind === "SAVING") saving = saving.plus(amount);
          if (line.kind === "INVESTMENT") investing = investing.plus(amount);
          if (line.kind === "RETIREMENT") retirement = retirement.plus(amount);
        }
        break;
    }
  }

  const netMonthly = totalIncome.minus(totalExpense).minus(totalSaving);
  const positiveNet = Decimal.max(netMonthly, new Decimal(0));
  const savingsForRate = totalSaving.plus(positiveNet);
  const savingsRatePercent = pct(savingsForRate, totalIncome);

  const toSlices = (map: Map<string, { value: Decimal; group: string }>): SpendSlice[] =>
    [...map.entries()]
      .map(([label, { value }]) => ({
        label,
        monthly: serializeMoney(value),
        monthlyRounded: roundToNearest5(value),
        percentOfExpense: pct(value, totalExpense),
      }))
      .sort((a, b) => Number(money(b.monthly).minus(money(a.monthly))));

  const topSpendCategories = toSlices(expenseByCategory).slice(0, 8);
  const spendByGroup = toSlices(expenseByGroup);

  const guideline = (targetPercent: number, actual: Decimal): GuidelineComparison => {
    const actualPercent = pct(actual, totalIncome);
    const target = totalIncome.times(targetPercent).dividedBy(100);
    const variance = target.minus(actual); // positive => room left
    let status: GuidelineComparison["status"];
    if (variance.abs().lessThanOrEqualTo(new Decimal(tolerance))) {
      status = "on_target";
    } else if (variance.greaterThan(0)) {
      status = "under";
    } else {
      status = "over";
    }
    return {
      targetPercent,
      actualPercent,
      actualMonthly: serializeMoney(actual),
      varianceMonthly: serializeMoney(variance),
      status,
    };
  };

  const savingsBucket = totalSaving.plus(positiveNet);
  const needsWantsSavings = {
    needs: guideline(50, needs),
    wants: guideline(30, wants),
    savings: guideline(20, savingsBucket),
  };

  // Savings opportunities: discretionary (non-essential) categories that are a
  // meaningful share of income. Suggest trimming each by 15%.
  const TRIM_FRACTION = 0.15;
  const OPPORTUNITY_MIN_PERCENT = 5;
  const discretionaryCategories = new Map<string, { value: Decimal; group: string }>();
  for (const line of input.lines) {
    if (line.kind === "EXPENSE" && !line.essential) {
      aggregate(discretionaryCategories, line.category, line.group, money(line.monthlyAmount));
    }
  }
  const savingsOpportunities: SavingsOpportunity[] = [...discretionaryCategories.entries()]
    .map(([category, { value, group }]) => {
      const percentOfIncome = pct(value, totalIncome);
      return {
        category,
        group,
        monthly: serializeMoney(value),
        monthlyRounded: roundToNearest5(value),
        percentOfIncome,
        suggestedMonthlySaving: roundToNearest5(value.times(TRIM_FRACTION)),
        note: `Discretionary spend of ${serializeMoney(value)} ${input.reportingCurrency}/month (${percentOfIncome}% of income). Trimming 15% frees about ${roundToNearest5(value.times(TRIM_FRACTION))} ${input.reportingCurrency}/month.`,
      };
    })
    .filter((o) => o.percentOfIncome >= OPPORTUNITY_MIN_PERCENT)
    .sort((a, b) => b.percentOfIncome - a.percentOfIncome);

  const balancesToZero = netMonthly.abs().lessThanOrEqualTo(new Decimal(tolerance));

  // Explainable insights.
  const insights: string[] = [];
  if (totalIncome.isZero()) {
    insights.push("No income is recorded, so ratios cannot be computed. Add your income sources first.");
  } else {
    insights.push(`Income ${serializeMoney(totalIncome)} ${input.reportingCurrency}/month; expenses ${serializeMoney(totalExpense)}; explicit savings ${serializeMoney(totalSaving)}.`);
    if (netMonthly.greaterThan(new Decimal(tolerance))) {
      insights.push(`You have ${serializeMoney(netMonthly)} ${input.reportingCurrency}/month unallocated — consider directing it to a goal or savings.`);
    } else if (netMonthly.lessThan(new Decimal(-tolerance))) {
      insights.push(`Your plan is over budget by ${serializeMoney(netMonthly.negated())} ${input.reportingCurrency}/month — expenses and savings exceed income.`);
    } else {
      insights.push("Your plan balances to zero within rounding tolerance — every franc has a job.");
    }
    insights.push(`Savings rate is ${savingsRatePercent}% of income (guideline: 20%).`);
    if (!totalExpense.isZero()) {
      insights.push(`Essential spending is ${pct(essential, totalExpense)}% of expenses; the rest is discretionary.`);
    }
    if (needsWantsSavings.needs.status === "over") {
      insights.push(`Needs are ${needsWantsSavings.needs.actualPercent}% of income, above the 50% guideline — fixed costs are high relative to income.`);
    }
  }

  return {
    reportingCurrency: input.reportingCurrency,
    totalIncome: serializeMoney(totalIncome),
    totalExpense: serializeMoney(totalExpense),
    totalSavingAllocations: serializeMoney(totalSaving),
    provisionsMonthly: serializeMoney(provisions),
    savingMonthly: serializeMoney(saving),
    investingMonthly: serializeMoney(investing),
    retirementMonthly: serializeMoney(retirement),
    netMonthly: serializeMoney(netMonthly),
    savingsRatePercent,
    essentialMonthly: serializeMoney(essential),
    discretionaryMonthly: serializeMoney(discretionary),
    essentialRatioPercent: pct(essential, totalExpense),
    topSpendCategories,
    spendByGroup,
    needsWantsSavings,
    savingsOpportunities,
    balancesToZero,
    insights,
  };
}
