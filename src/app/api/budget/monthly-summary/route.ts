import { json, routeError } from "@/lib/api/route";
import { requireAuthenticatedContext } from "@/lib/auth/context";
import { buildPersistedMoneyFlow } from "@/lib/budget/persisted-plan";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
    const context = await requireAuthenticatedContext("budget.read");
    const flow = await buildPersistedMoneyFlow(prisma, context.householdId);
    return json({
      reportingCurrency: flow.reportingCurrency,
      totals: flow.totals,
      warnings: flow.warnings,
      reconciled: flow.reconciled,
    });
  } catch (error) { return routeError(error); }
}
