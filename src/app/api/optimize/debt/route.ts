import { json, readJson, routeError } from "@/lib/api/route";
import { requireAuthenticatedContext } from "@/lib/auth/context";
import { computeDebtComparison, computeDebtPayoff } from "@/lib/optimize/debt";
import { debtPayoffSchema } from "@/lib/optimize/schemas";

export async function POST(request: Request) {
  try {
    await requireAuthenticatedContext("optimize.run");
    const input = await readJson(request, debtPayoffSchema);

    if (input.strategy) {
      const result = computeDebtPayoff({
        currency: input.currency,
        strategy: input.strategy,
        debts: input.debts,
        extraMonthlyPayment: input.extraMonthlyPayment,
        maxMonths: input.maxMonths,
      });
      return json({ kind: "single", ...result });
    }

    const comparison = computeDebtComparison({
      currency: input.currency,
      debts: input.debts,
      extraMonthlyPayment: input.extraMonthlyPayment,
      maxMonths: input.maxMonths,
    });
    return json({ kind: "comparison", ...comparison });
  } catch (error) {
    return routeError(error);
  }
}
