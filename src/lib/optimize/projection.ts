import Decimal from "decimal.js";

import type { ProjectionComparisonInput } from "@/lib/optimize/schemas";
import { money, serializeMoney, serializeRate } from "@/lib/money/decimal";

export interface ProjectionPoint {
  year: number;
  contributedPrincipal: string;
  growth: string;
  endingBalance: string;
}

export interface ProjectionScenarioResult {
  name: string;
  annualReturnRate: string;
  monthlyReturnRate: string;
  totalContributions: string;
  totalGrowth: string;
  endingBalance: string;
  points: ProjectionPoint[];
}

export interface ProjectionComparisonResult {
  currency: string;
  years: number;
  assumptions: {
    compounding: "effective_monthly";
    contributionTiming: "end_of_month";
    includesTaxesAndFees: false;
  };
  scenarios: ProjectionScenarioResult[];
}

export function compareProjectionScenarios(
  input: ProjectionComparisonInput,
): ProjectionComparisonResult {
  const startingAmount = money(input.startingAmount);
  const monthlyContribution = money(input.monthlyContribution);

  return {
    currency: input.currency,
    years: input.years,
    assumptions: {
      compounding: "effective_monthly",
      contributionTiming: "end_of_month",
      includesTaxesAndFees: false,
    },
    scenarios: input.scenarios.map((scenario) =>
      projectScenario({
        name: scenario.name,
        annualReturnRate: scenario.annualReturnRate,
        startingAmount,
        monthlyContribution,
        years: input.years,
      }),
    ),
  };
}

function projectScenario({
  name,
  annualReturnRate,
  startingAmount,
  monthlyContribution,
  years,
}: {
  name: string;
  annualReturnRate: string;
  startingAmount: Decimal;
  monthlyContribution: Decimal;
  years: number;
}): ProjectionScenarioResult {
  const annualRate = money(annualReturnRate);
  const monthlyRate = annualRate.plus(1).pow(new Decimal(1).dividedBy(12)).minus(1);
  const monthlyFactor = monthlyRate.plus(1);
  let balance = startingAmount;
  let contributedPrincipal = startingAmount;
  const points: ProjectionPoint[] = [projectionPoint(0, contributedPrincipal, balance)];

  for (let month = 1; month <= years * 12; month += 1) {
    balance = balance.times(monthlyFactor).plus(monthlyContribution);
    contributedPrincipal = contributedPrincipal.plus(monthlyContribution);

    if (month % 12 === 0) {
      points.push(projectionPoint(month / 12, contributedPrincipal, balance));
    }
  }

  return {
    name,
    annualReturnRate: serializeRate(annualRate),
    monthlyReturnRate: serializeRate(monthlyRate),
    totalContributions: serializeMoney(contributedPrincipal),
    totalGrowth: serializeMoney(balance.minus(contributedPrincipal)),
    endingBalance: serializeMoney(balance),
    points,
  };
}

function projectionPoint(
  year: number,
  contributedPrincipal: Decimal,
  endingBalance: Decimal,
): ProjectionPoint {
  return {
    year,
    contributedPrincipal: serializeMoney(contributedPrincipal),
    growth: serializeMoney(endingBalance.minus(contributedPrincipal)),
    endingBalance: serializeMoney(endingBalance),
  };
}
