import { json, readJson, routeError } from "@/lib/api/route";
import { requireAuthenticatedContext } from "@/lib/auth/context";
import { computePillar3a } from "@/lib/optimize/pillar3a";
import { pillar3aSchema } from "@/lib/optimize/schemas";
import { prisma } from "@/lib/db/prisma";

export async function POST(request: Request) {
  try {
    const context = await requireAuthenticatedContext("optimize.run");
    const input = await readJson(request, pillar3aSchema);
    const household = await prisma.household.findUniqueOrThrow({
      where: { id: context.householdId },
      select: { baseCurrency: true },
    });
    const result = computePillar3a({
      currency: household.baseCurrency,
      year: new Date().getUTCFullYear(),
      hasPensionFund: input.hasPensionFund,
      netAnnualIncome: input.netAnnualIncome,
      contributedThisYear: input.contributedThisYear,
      currentBalance: input.currentBalance,
      marginalTaxRate: input.marginalTaxRate,
      yearsToRetirement: input.yearsToRetirement,
      annualReturnRate: input.annualReturnRate,
    });
    return json(result);
  } catch (error) {
    return routeError(error);
  }
}
