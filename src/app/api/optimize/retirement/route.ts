import { json, readJson, routeError } from "@/lib/api/route";
import { requireAuthenticatedContext } from "@/lib/auth/context";
import { computeRetirementReadiness } from "@/lib/optimize/retirement";
import { retirementSchema } from "@/lib/optimize/schemas";
import { prisma } from "@/lib/db/prisma";

export async function POST(request: Request) {
  try {
    const context = await requireAuthenticatedContext("optimize.run");
    const input = await readJson(request, retirementSchema);
    const household = await prisma.household.findUniqueOrThrow({
      where: { id: context.householdId },
      select: { baseCurrency: true },
    });
    const result = computeRetirementReadiness({
      currency: household.baseCurrency,
      targetAnnualIncome: input.targetAnnualIncome,
      currentNetAnnualIncome: input.currentNetAnnualIncome,
      replacementRatio: input.replacementRatio,
      ahvAnnualIncome: input.ahvAnnualIncome,
      pensionCapitalAtRetirement: input.pensionCapitalAtRetirement,
      investmentCapitalAtRetirement: input.investmentCapitalAtRetirement,
      pensionAnnuitizationRate: input.pensionAnnuitizationRate,
      investmentDrawdownRate: input.investmentDrawdownRate,
      yearsInRetirement: input.yearsInRetirement,
      yearsToRetirement: input.yearsToRetirement,
      preRetirementReturnRate: input.preRetirementReturnRate,
    });
    return json(result);
  } catch (error) {
    return routeError(error);
  }
}
