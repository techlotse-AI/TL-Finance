import { json, routeError } from "@/lib/api/route";
import { computeFindings } from "@/lib/analysis/findings";
import { adherenceForMonth, loadFindingTransactions } from "@/lib/analysis/queries";
import { requireAuthenticatedContext } from "@/lib/auth/context";

export async function GET(request: Request) {
  try {
    const context = await requireAuthenticatedContext("analysis.read");
    const month = new URL(request.url).searchParams.get("month");
    const [transactions, adherence] = await Promise.all([
      loadFindingTransactions(context.householdId),
      adherenceForMonth(context.householdId, month),
    ]);
    const findings = computeFindings(transactions, adherence.rows);
    return json({ month: adherence.month, findings });
  } catch (error) {
    return routeError(error);
  }
}
