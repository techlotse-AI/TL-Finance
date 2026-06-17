import Decimal from "decimal.js";

import { money, serializeMoney } from "@/lib/money/decimal";

/** Capital-accumulation pillars. Pillar 1 (AHV) is an income pension; see ahv.ts. */
export type CapitalPillar = "PILLAR_2" | "PILLAR_3A" | "PILLAR_3B";

export interface PensionVehicleInput {
  id?: string;
  label: string;
  pillar: CapitalPillar;
  currency: string;
  currentBalance: string;
  annualContribution: string;
  annualReturnRate: string;
  yearsToRetirement: number;
}

export interface PensionVehicleProjection {
  id?: string;
  label: string;
  pillar: CapitalPillar;
  currency: string;
  yearsToRetirement: number;
  totalContributions: string;
  totalGrowth: string;
  endingBalance: string;
}

/**
 * Deterministic capital projection for a savings-type pension pillar. Uses an
 * end-of-year annuity: FV = balance*(1+r)^n + C * (((1+r)^n - 1) / r). Annual
 * compounding, contributions at year end, inflation ignored. No AI.
 */
export function projectPensionVehicle(input: PensionVehicleInput): PensionVehicleProjection {
  const rate = money(input.annualReturnRate);
  const years = input.yearsToRetirement;
  const balance = money(input.currentBalance);
  const contribution = money(input.annualContribution);

  const growthFactor = rate.plus(1).pow(years);
  const annuityFactor = rate.isZero() ? new Decimal(years) : growthFactor.minus(1).dividedBy(rate);
  const endingBalance = balance.times(growthFactor).plus(contribution.times(annuityFactor));
  const totalContributions = contribution.times(years);
  const totalGrowth = endingBalance.minus(balance).minus(totalContributions);

  return {
    id: input.id,
    label: input.label,
    pillar: input.pillar,
    currency: input.currency,
    yearsToRetirement: years,
    totalContributions: serializeMoney(totalContributions),
    totalGrowth: serializeMoney(totalGrowth),
    endingBalance: serializeMoney(endingBalance),
  };
}

export interface PensionSummaryInput {
  currency: string;
  vehicles: PensionVehicleInput[];
  /** Determining annual AHV income at retirement (from ahv.ts), if any. */
  ahvAnnualIncome?: string;
}

export interface PensionSummary {
  currency: string;
  projections: PensionVehicleProjection[];
  totalCapitalAtRetirement: string;
  capitalByPillar: Array<{ pillar: CapitalPillar; endingBalance: string }>;
  ahvAnnualIncome: string;
}

/**
 * Aggregates capital pillars into total capital at retirement and carries the
 * AHV annual income alongside. All vehicles are assumed to share the summary
 * currency; convert before calling if they differ.
 */
export function summarizePensions(input: PensionSummaryInput): PensionSummary {
  const projections = input.vehicles.map(projectPensionVehicle);
  const byPillar = new Map<CapitalPillar, Decimal>();
  let total = new Decimal(0);

  for (const projection of projections) {
    const ending = money(projection.endingBalance);
    total = total.plus(ending);
    byPillar.set(projection.pillar, (byPillar.get(projection.pillar) ?? new Decimal(0)).plus(ending));
  }

  return {
    currency: input.currency,
    projections,
    totalCapitalAtRetirement: serializeMoney(total),
    capitalByPillar: [...byPillar.entries()].map(([pillar, endingBalance]) => ({
      pillar,
      endingBalance: serializeMoney(endingBalance),
    })),
    ahvAnnualIncome: serializeMoney(input.ahvAnnualIncome ?? 0),
  };
}
