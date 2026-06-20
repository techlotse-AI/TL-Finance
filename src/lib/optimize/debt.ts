import Decimal from "decimal.js";

import { money, serializeMoney, serializeRate } from "@/lib/money/decimal";

/**
 * Debt payoff calculator (Optimize-only; Budget never performs debt math).
 *
 * Deterministic avalanche vs snowball schedules from balances, rates, and
 * minimum payments, with an optional extra monthly payment rolled into the
 * focus debt.
 *
 * COMPOUNDING CONVENTION (pinned for unambiguous advice): interest is nominal
 * APR compounded monthly. The monthly periodic rate is `annualInterestRate /
 * 12` and is applied to the outstanding balance at the start of each month
 * before payments. This matches how Swiss/EU consumer-credit and card issuers
 * quote a nominal annual rate; it is NOT the effective annual rate (EAR). To
 * model an EAR, convert first: monthlyRate = (1 + EAR)^(1/12) - 1.
 *
 * The total monthly budget (sum of all minimum payments + extra) is held
 * constant: when a debt clears, its freed minimum rolls into the next focus
 * debt. No forecasting, no AI; every output is explainable via `basis`.
 */

export type DebtStrategy = "avalanche" | "snowball";

export interface DebtInput {
  name: string;
  /** Outstanding principal in the reporting currency. */
  balance: string;
  /** Nominal annual interest rate as a fraction (0.199 = 19.9% APR). */
  annualInterestRate: string;
  /** Contractual minimum monthly payment. */
  minimumPayment: string;
}

export interface DebtPlanInput {
  currency: string;
  debts: DebtInput[];
  strategy: DebtStrategy;
  /** Extra monthly amount beyond all minimums, rolled into the focus debt. Default 0. */
  extraMonthlyPayment?: string;
  /** Safety cap on simulated months (default 1200 = 100 years). */
  maxMonths?: number;
  /** Reference date for the payoff-date calculation. Default: now (UTC). */
  asOf?: Date;
}

export interface DebtPayoffDetail {
  name: string;
  /** Priority position under the chosen strategy (1 = paid off first focus). */
  order: number;
  balance: string;
  annualInterestRate: string;
  minimumPayment: string;
  /** Month index (1-based) the debt is cleared, or null if it did not clear. */
  payoffMonth: number | null;
  interestPaid: string;
}

export interface DebtPayoffResult {
  currency: string;
  strategy: DebtStrategy;
  /** Whether every debt clears within the month cap. */
  amortizes: boolean;
  /** Months until the last debt clears, or null if it never does. */
  months: number | null;
  /** ISO yyyy-mm-dd payoff date derived from `asOf`, or null. */
  payoffDate: string | null;
  totalPrincipal: string;
  totalInterest: string;
  totalPaid: string;
  monthlyBudget: string;
  debts: DebtPayoffDetail[];
  basis: string[];
  notes: string[];
}

const EPSILON = new Decimal("0.005"); // half a cent: treat as cleared

/** Order debt indices by strategy. Stable, with deterministic tie-breaks. */
function priorityOrder(debts: DebtInput[], strategy: DebtStrategy): number[] {
  const indices = debts.map((_, index) => index);
  return indices.sort((a, b) => {
    const left = debts[a];
    const right = debts[b];
    if (strategy === "avalanche") {
      const rate = money(right.annualInterestRate).comparedTo(money(left.annualInterestRate));
      if (rate !== 0) return rate; // highest rate first
      const balance = money(left.balance).comparedTo(money(right.balance));
      if (balance !== 0) return balance; // then smallest balance
    } else {
      const balance = money(left.balance).comparedTo(money(right.balance));
      if (balance !== 0) return balance; // smallest balance first
      const rate = money(right.annualInterestRate).comparedTo(money(left.annualInterestRate));
      if (rate !== 0) return rate; // then highest rate
    }
    return a - b; // stable input order
  });
}

function addMonths(asOf: Date, months: number): string {
  const date = new Date(
    Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth() + months, asOf.getUTCDate()),
  );
  return date.toISOString().slice(0, 10);
}

export function computeDebtPayoff(input: DebtPlanInput): DebtPayoffResult {
  const order = priorityOrder(input.debts, input.strategy);
  const extra = money(input.extraMonthlyPayment ?? "0");
  const maxMonths = input.maxMonths && input.maxMonths > 0 ? Math.floor(input.maxMonths) : 1200;
  const asOf = input.asOf ?? new Date();

  const monthlyRates = input.debts.map((debt) => money(debt.annualInterestRate).dividedBy(12));
  const balances = input.debts.map((debt) => money(debt.balance));
  const interestPaid = input.debts.map(() => money(0));
  const payoffMonth: Array<number | null> = input.debts.map(() => null);
  const totalPrincipal = balances.reduce((sum, balance) => sum.plus(balance), money(0));
  const minimumsTotal = input.debts.reduce((sum, debt) => sum.plus(money(debt.minimumPayment)), money(0));
  const budget = minimumsTotal.plus(extra);

  const notes: string[] = [];
  // Flag any debt whose minimum cannot cover its own monthly interest at the start.
  input.debts.forEach((debt, index) => {
    if (balances[index].isZero()) return;
    const monthlyInterest = balances[index].times(monthlyRates[index]);
    if (money(debt.minimumPayment).lessThan(monthlyInterest)) {
      notes.push(
        `Minimum payment for ${debt.name} (${serializeMoney(debt.minimumPayment)} ${input.currency}) is below its monthly interest (${serializeMoney(monthlyInterest)} ${input.currency}); it only amortizes once extra payments or freed minimums reach it.`,
      );
    }
  });

  // Already-cleared debts (zero balance) get payoff month 0.
  balances.forEach((balance, index) => {
    if (balance.lessThanOrEqualTo(EPSILON)) payoffMonth[index] = 0;
  });

  let month = 0;
  while (balances.some((balance) => balance.greaterThan(EPSILON)) && month < maxMonths) {
    month += 1;

    // 1. Accrue interest on the outstanding balance.
    for (let i = 0; i < balances.length; i += 1) {
      if (balances[i].lessThanOrEqualTo(EPSILON)) continue;
      const interest = balances[i].times(monthlyRates[i]);
      balances[i] = balances[i].plus(interest);
      interestPaid[i] = interestPaid[i].plus(interest);
    }

    // 2. Pay contractual minimums (capped at balance), in priority order.
    let pool = budget;
    for (const i of order) {
      if (balances[i].lessThanOrEqualTo(EPSILON) || pool.lessThanOrEqualTo(0)) continue;
      const pay = Decimal.min(balances[i], money(input.debts[i].minimumPayment), pool);
      balances[i] = balances[i].minus(pay);
      pool = pool.minus(pay);
    }

    // 3. Waterfall any remaining budget (extra + freed minimums) to focus debts.
    for (const i of order) {
      if (pool.lessThanOrEqualTo(0)) break;
      if (balances[i].lessThanOrEqualTo(EPSILON)) continue;
      const pay = Decimal.min(balances[i], pool);
      balances[i] = balances[i].minus(pay);
      pool = pool.minus(pay);
    }

    // 4. Record newly cleared debts.
    for (let i = 0; i < balances.length; i += 1) {
      if (payoffMonth[i] === null && balances[i].lessThanOrEqualTo(EPSILON)) payoffMonth[i] = month;
    }
  }

  const amortizes = balances.every((balance) => balance.lessThanOrEqualTo(EPSILON));
  const months = amortizes ? month : null;
  const totalInterest = interestPaid.reduce((sum, value) => sum.plus(value), money(0));

  const details: DebtPayoffDetail[] = input.debts
    .map((debt, index) => ({
      name: debt.name,
      order: order.indexOf(index) + 1,
      balance: serializeMoney(debt.balance),
      annualInterestRate: serializeRate(debt.annualInterestRate),
      minimumPayment: serializeMoney(debt.minimumPayment),
      payoffMonth: payoffMonth[index],
      interestPaid: serializeMoney(interestPaid[index]),
    }))
    .sort((a, b) => a.order - b.order);

  if (!amortizes) {
    notes.push(
      `The plan does not clear within ${maxMonths} months on the current budget of ${serializeMoney(budget)} ${input.currency}/month. Increase the extra payment to amortize.`,
    );
  }

  return {
    currency: input.currency,
    strategy: input.strategy,
    amortizes,
    months,
    payoffDate: amortizes ? addMonths(asOf, month) : null,
    totalPrincipal: serializeMoney(totalPrincipal),
    totalInterest: serializeMoney(totalInterest),
    totalPaid: serializeMoney(totalPrincipal.plus(totalInterest)),
    monthlyBudget: serializeMoney(budget),
    debts: details,
    basis: [
      "debts.balance",
      "debts.annualInterestRate",
      "debts.minimumPayment",
      "strategy",
      "extraMonthlyPayment",
      "convention:nominal-apr-compounded-monthly",
    ],
    notes,
  };
}

export interface DebtComparisonResult {
  avalanche: DebtPayoffResult;
  snowball: DebtPayoffResult;
  /** Interest saved by avalanche vs snowball (positive => avalanche is cheaper). */
  interestSavedByAvalanche: string;
  /** Months saved by the faster strategy (positive => avalanche clears sooner). */
  monthsSavedByAvalanche: number | null;
  recommendedStrategy: DebtStrategy;
}

/**
 * Run both strategies on the same inputs and quantify the trade-off. Avalanche
 * minimizes interest; snowball clears small balances first for momentum. The
 * recommendation favours avalanche when it is cheaper and both amortize.
 */
export function computeDebtComparison(
  input: Omit<DebtPlanInput, "strategy">,
): DebtComparisonResult {
  const avalanche = computeDebtPayoff({ ...input, strategy: "avalanche" });
  const snowball = computeDebtPayoff({ ...input, strategy: "snowball" });

  const interestSaved = money(snowball.totalInterest).minus(money(avalanche.totalInterest));
  const monthsSaved =
    avalanche.months !== null && snowball.months !== null ? snowball.months - avalanche.months : null;

  const recommendedStrategy: DebtStrategy =
    avalanche.amortizes && interestSaved.greaterThanOrEqualTo(0) ? "avalanche" : "snowball";

  return {
    avalanche,
    snowball,
    interestSavedByAvalanche: serializeMoney(interestSaved),
    monthsSavedByAvalanche: monthsSaved,
    recommendedStrategy,
  };
}
