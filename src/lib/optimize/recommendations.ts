import type { Finding } from "@/lib/analysis/findings";
import type { EmergencyFundResult } from "@/lib/optimize/emergency-fund";
import type { Pillar3aResult } from "@/lib/optimize/pillar3a";
import { money } from "@/lib/money/decimal";

export interface Recommendation {
  code: string;
  priority: number;
  title: string;
  detail: string;
  impactAmount?: string;
  currency?: string;
  /** The inputs this recommendation is derived from, so it is explainable. */
  basis: string[];
}

export interface RecommendationInput {
  emergencyFund?: EmergencyFundResult;
  pillar3a?: Pillar3aResult;
  findings?: Finding[];
}

/**
 * Deterministic, explainable recommendations. Each one cites the inputs it is
 * derived from and carries no side effects: Optimize never changes the budget.
 */
export function computeRecommendations(input: RecommendationInput): Recommendation[] {
  const recommendations: Recommendation[] = [];
  const fund = input.emergencyFund;
  const pillar = input.pillar3a;

  if (fund && fund.status !== "funded" && money(fund.gap).isPositive()) {
    const protectionNote =
      fund.incomeProtectionApplied && fund.protectionExplanation ? ` ${fund.protectionExplanation}` : "";
    recommendations.push({
      code: "build_emergency_fund",
      priority: 90,
      title: "Build your emergency fund",
      detail: `You cover ${fund.monthsCovered ?? 0} of ${fund.targetMonths} target months. Set aside ${fund.suggestedMonthlyContribution} ${fund.currency}/month to close the ${fund.gap} ${fund.currency} gap.${protectionNote}`,
      impactAmount: fund.gap,
      currency: fund.currency,
      basis: fund.incomeProtectionApplied
        ? ["essentialMonthly", "currentReserve", "targetMonths", "incomeProtection"]
        : ["essentialMonthly", "currentReserve", "targetMonths"],
    });
  }

  if (pillar && money(pillar.remainingThisYear).isPositive()) {
    recommendations.push({
      code: "use_pillar_3a_allowance",
      priority: 80,
      title: "Use your remaining Pillar 3a allowance",
      detail: `Contribute ${pillar.remainingThisYear} ${pillar.currency} more before year end to reach the ${pillar.maxContribution} ${pillar.currency} ${pillar.year} maximum and save about ${pillar.remainingTaxSaving} ${pillar.currency} in tax.`,
      impactAmount: pillar.remainingTaxSaving,
      currency: pillar.currency,
      basis: ["maxContribution", "contributedThisYear", "marginalTaxRate"],
    });
  }

  for (const finding of input.findings ?? []) {
    if (finding.code === "over_budget") {
      recommendations.push({
        code: "reduce_overspend",
        priority: 70,
        title: finding.title,
        detail: `${finding.detail} Bringing this back to plan frees ${finding.amount ?? "0"} ${finding.currency ?? ""}/month.`,
        impactAmount: finding.amount,
        currency: finding.currency,
        basis: ["adherence.over_budget"],
      });
    } else if (finding.code === "duplicate_charge") {
      recommendations.push({
        code: "check_duplicate_charge",
        priority: 65,
        title: finding.title,
        detail: finding.detail,
        impactAmount: finding.amount,
        currency: finding.currency,
        basis: ["findings.duplicate_charge"],
      });
    } else if (finding.code === "subscription_increase") {
      recommendations.push({
        code: "review_rising_subscription",
        priority: 60,
        title: finding.title,
        detail: finding.detail,
        impactAmount: finding.amount,
        currency: finding.currency,
        basis: ["findings.subscription_increase"],
      });
    } else if (finding.code === "recurring_subscription") {
      recommendations.push({
        code: "track_recurring_subscription",
        priority: 40,
        title: finding.title,
        detail: finding.detail,
        impactAmount: finding.amount,
        currency: finding.currency,
        basis: ["findings.recurring_subscription"],
      });
    }
  }

  recommendations.sort((left, right) => {
    if (right.priority !== left.priority) return right.priority - left.priority;
    return Number(right.impactAmount ?? 0) - Number(left.impactAmount ?? 0);
  });
  return recommendations;
}
