import Decimal from "decimal.js";

import { money, serializeMoney } from "@/lib/money/decimal";

/** Capital-accumulation pillars. Pillar 1 (AHV) is an income pension; see ahv.ts. */
export type CapitalPillar = "PILLAR_2" | "PILLAR_3A" | "PILLAR_3B";

/** Where the projected retirement capital came from. */
export type PensionProjectionSource = "computed" | "provider";

export interface PensionVehicleInput {
  id?: string;
  label: string;
  pillar: CapitalPillar;
  currency: string;
  currentBalance: string;
  annualContribution: string;
  annualReturnRate: string;
  yearsToRetirement: number;
  /**
   * Provider-stated projected retirement capital (e.g. the projected
   * "Altersguthaben" on a Swiss Pillar 2 / BVG statement). When supplied and
   * positive, it is used as the ending balance instead of the deterministic
   * compounding projection, since the provider already accounts for plan-specific
   * interest, contributions, and salary assumptions.
   */
  projectedCapitalOverride?: string;
  /** Provider-stated projected annual pension (Rente) at retirement, if shown. */
  projectedAnnualPensionOverride?: string;
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
  /** "provider" when a projected-capital override was used; otherwise "computed". */
  projectionSource: PensionProjectionSource;
  /** Provider-stated projected annual pension, or null when not supplied. */
  providerAnnualPension: string | null;
}

/**
 * Deterministic capital projection for a savings-type pension pillar. Uses an
 * end-of-year annuity: FV = balance*(1+r)^n + C * (((1+r)^n - 1) / r). Annual
 * compounding, contributions at year end, inflation ignored. No AI.
 *
 * If `projectedCapitalOverride` is supplied and positive, that provider-stated
 * figure is used as the ending balance instead; the contribution/growth split is
 * still reported for transparency (growth = ending - balance - contributions and
 * may be negative if the provider projection is conservative).
 */
export function projectPensionVehicle(input: PensionVehicleInput): PensionVehicleProjection {
  const rate = money(input.annualReturnRate);
  const years = input.yearsToRetirement;
  const balance = money(input.currentBalance);
  const contribution = money(input.annualContribution);

  const override =
    input.projectedCapitalOverride !== undefined && money(input.projectedCapitalOverride).greaterThan(0)
      ? money(input.projectedCapitalOverride)
      : null;

  let endingBalance: Decimal;
  let projectionSource: PensionProjectionSource;
  if (override !== null) {
    endingBalance = override;
    projectionSource = "provider";
  } else {
    const growthFactor = rate.plus(1).pow(years);
    const annuityFactor = rate.isZero() ? new Decimal(years) : growthFactor.minus(1).dividedBy(rate);
    endingBalance = balance.times(growthFactor).plus(contribution.times(annuityFactor));
    projectionSource = "computed";
  }

  const totalContributions = contribution.times(years);
  const totalGrowth = endingBalance.minus(balance).minus(totalContributions);

  const providerAnnualPension =
    input.projectedAnnualPensionOverride !== undefined && money(input.projectedAnnualPensionOverride).greaterThan(0)
      ? serializeMoney(input.projectedAnnualPensionOverride)
      : null;

  return {
    id: input.id,
    label: input.label,
    pillar: input.pillar,
    currency: input.currency,
    yearsToRetirement: years,
    totalContributions: serializeMoney(totalContributions),
    totalGrowth: serializeMoney(totalGrowth),
    endingBalance: serializeMoney(endingBalance),
    projectionSource,
    providerAnnualPension,
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
  /** Sum of any provider-stated annual pensions across vehicles. */
  totalProviderAnnualPension: string;
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
  let providerPension = new Decimal(0);

  for (const projection of projections) {
    const ending = money(projection.endingBalance);
    total = total.plus(ending);
    byPillar.set(projection.pillar, (byPillar.get(projection.pillar) ?? new Decimal(0)).plus(ending));
    if (projection.providerAnnualPension !== null) {
      providerPension = providerPension.plus(money(projection.providerAnnualPension));
    }
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
    totalProviderAnnualPension: serializeMoney(providerPension),
  };
}
