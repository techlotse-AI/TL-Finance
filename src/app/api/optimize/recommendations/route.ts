import { json, readJson, routeError } from "@/lib/api/route";
import { computeFindings } from "@/lib/analysis/findings";
import { adherenceForMonth, loadFindingTransactions } from "@/lib/analysis/queries";
import { requireAuthenticatedContext } from "@/lib/auth/context";
import {
  computeEmergencyFund,
  swissUnemploymentProtection,
  type IncomeProtection,
} from "@/lib/optimize/emergency-fund";
import { computePillar3a } from "@/lib/optimize/pillar3a";
import { essentialMonthlyBaseCurrency } from "@/lib/optimize/queries";
import { computeRecommendations } from "@/lib/optimize/recommendations";
import { recommendationsSchema } from "@/lib/optimize/schemas";

export async function POST(request: Request) {
  try {
    const context = await requireAuthenticatedContext("optimize.run");
    const input = await readJson(request, recommendationsSchema);

    const essential = await essentialMonthlyBaseCurrency(context.householdId);
    const [transactions, adherence] = await Promise.all([
      loadFindingTransactions(context.householdId),
      adherenceForMonth(context.householdId),
    ]);
    const findings = computeFindings(transactions, adherence.rows);

    const incomeProtection: IncomeProtection | undefined = input.swissUnemployment
      ? swissUnemploymentProtection(input.swissUnemployment)
      : input.incomeProtection;

    const emergencyFund = computeEmergencyFund({
      currency: essential.currency,
      essentialMonthly: essential.essentialMonthly,
      currentReserve: input.currentReserve,
      targetMonths: input.targetMonths,
      incomeProtection,
    });
    const pillar3a = computePillar3a({
      currency: essential.currency,
      year: new Date().getUTCFullYear(),
      hasPensionFund: input.hasPensionFund,
      netAnnualIncome: input.netAnnualIncome,
      contributedThisYear: input.contributedThisYear,
      marginalTaxRate: input.marginalTaxRate,
      yearsToRetirement: 20,
      annualReturnRate: "0.03",
    });
    const recommendations = computeRecommendations({ emergencyFund, pillar3a, findings });

    return json({ emergencyFund, pillar3a, recommendations });
  } catch (error) {
    return routeError(error);
  }
}
