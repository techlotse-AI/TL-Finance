import { json, readJson, routeError } from "@/lib/api/route";
import { requireAuthenticatedContext } from "@/lib/auth/context";
import { computeBalanceForecast } from "@/lib/optimize/forecast";
import { forecastSchema } from "@/lib/optimize/schemas";
import { prisma } from "@/lib/db/prisma";

export async function POST(request: Request) {
  try {
    const context = await requireAuthenticatedContext("optimize.run");
    const input = await readJson(request, forecastSchema);
    const household = await prisma.household.findUniqueOrThrow({
      where: { id: context.householdId },
      select: { baseCurrency: true },
    });
    const result = computeBalanceForecast({
      currency: household.baseCurrency,
      startingBalance: input.startingBalance,
      monthlyNetFlow: input.monthlyNetFlow,
      months: input.months,
      minimumBalance: input.minimumBalance,
      oneOffFlows: input.oneOffFlows,
    });
    return json(result);
  } catch (error) {
    return routeError(error);
  }
}
