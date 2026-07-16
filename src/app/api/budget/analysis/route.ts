import { json, routeError } from "@/lib/api/route";
import { requireAuthenticatedContext } from "@/lib/auth/context";
import { loadBudgetAnalysis } from "@/lib/budget/analysis-loader";

/**
 * Budget analysis: where the money goes, 50/30/20 comparison, savings
 * opportunities and zero-based balance, derived from the persisted plan. Amounts
 * are recurrence-normalized to monthly and converted to the household base
 * currency via the latest reporting rates. Lines whose currency has no reporting
 * rate are excluded and reported in `excludedCurrencyLines` so the UI can warn.
 */
export async function GET() {
  try {
    const context = await requireAuthenticatedContext("budget.read");
    const analysis = await loadBudgetAnalysis(context.householdId);
    return json(analysis);
  } catch (error) {
    return routeError(error);
  }
}
