import Decimal from "decimal.js";

import { money, serializeMoney } from "@/lib/money/decimal";

export interface ForecastOneOff {
  /** 1-based month offset from now at which the amount applies. */
  month: number;
  /** Signed amount: positive is an inflow, negative an outflow. */
  amount: string;
}

export interface ForecastInput {
  currency: string;
  /** Opening balance for the projection. */
  startingBalance: string;
  /** Recurring net of planned monthly inflows minus outflows (may be negative). */
  monthlyNetFlow: string;
  /** Number of months to project (1-120). */
  months: number;
  /** Optional non-recurring inflows/outflows keyed by month offset. */
  oneOffFlows?: ForecastOneOff[];
  /** Balance below which a month is flagged as a shortfall. Defaults to 0. */
  minimumBalance?: string;
}

export interface ForecastPoint {
  month: number;
  netFlow: string;
  endingBalance: string;
  belowMinimum: boolean;
}

export interface ForecastResult {
  currency: string;
  startingBalance: string;
  monthlyNetFlow: string;
  months: number;
  endingBalance: string;
  lowestBalance: string;
  lowestBalanceMonth: number;
  /** First month the balance drops below the minimum, or null if it never does. */
  shortfallMonth: number | null;
  points: ForecastPoint[];
  assumptions: { interest: false; compounding: "none"; basis: "planned_net_flow" };
}

/**
 * Deterministic, interest-free cash-balance projection. Each month adds the
 * recurring net planned flow plus any one-off amounts for that month. This is a
 * read-only Optimize forecast: it never writes Budget records and adds no return
 * assumptions. A negative `monthlyNetFlow` models a structural deficit.
 */
export function computeBalanceForecast(input: ForecastInput): ForecastResult {
  const monthlyNetFlow = money(input.monthlyNetFlow);
  const minimum = input.minimumBalance ? money(input.minimumBalance) : new Decimal(0);
  const oneOffByMonth = new Map<number, Decimal>();
  for (const event of input.oneOffFlows ?? []) {
    oneOffByMonth.set(
      event.month,
      (oneOffByMonth.get(event.month) ?? new Decimal(0)).plus(money(event.amount)),
    );
  }

  let balance = money(input.startingBalance);
  let lowest = balance;
  let lowestMonth = 0;
  let shortfallMonth: number | null = balance.lessThan(minimum) ? 0 : null;
  const points: ForecastPoint[] = [];

  for (let month = 1; month <= input.months; month += 1) {
    const oneOff = oneOffByMonth.get(month) ?? new Decimal(0);
    const netFlow = monthlyNetFlow.plus(oneOff);
    balance = balance.plus(netFlow);
    const belowMinimum = balance.lessThan(minimum);
    if (belowMinimum && shortfallMonth === null) shortfallMonth = month;
    if (balance.lessThan(lowest)) {
      lowest = balance;
      lowestMonth = month;
    }
    points.push({
      month,
      netFlow: serializeMoney(netFlow),
      endingBalance: serializeMoney(balance),
      belowMinimum,
    });
  }

  return {
    currency: input.currency,
    startingBalance: serializeMoney(money(input.startingBalance)),
    monthlyNetFlow: serializeMoney(monthlyNetFlow),
    months: input.months,
    endingBalance: serializeMoney(balance),
    lowestBalance: serializeMoney(lowest),
    lowestBalanceMonth: lowestMonth,
    shortfallMonth,
    points,
    assumptions: { interest: false, compounding: "none", basis: "planned_net_flow" },
  };
}
