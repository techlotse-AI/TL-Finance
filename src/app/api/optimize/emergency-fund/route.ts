import { json, readJson, routeError } from "@/lib/api/route";
import { requireAuthenticatedContext } from "@/lib/auth/context";
import { computeEmergencyFund } from "@/lib/optimize/emergency-fund";
import { essentialMonthlyBaseCurrency } from "@/lib/optimize/queries";
import { emergencyFundSchema } from "@/lib/optimize/schemas";

export async function POST(request: Request) {
  try {
    const context = await requireAuthenticatedContext("optimize.run");
    const input = await readJson(request, emergencyFundSchema);
    const essential = await essentialMonthlyBaseCurrency(context.householdId);
    const result = computeEmergencyFund({
      currency: essential.currency,
      essentialMonthly: essential.essentialMonthly,
      currentReserve: input.currentReserve,
      targetMonths: input.targetMonths,
      closeOverMonths: input.closeOverMonths,
    });
    return json({ ...result, excludedCurrencyItems: essential.excludedCurrencyItems });
  } catch (error) {
    return routeError(error);
  }
}
