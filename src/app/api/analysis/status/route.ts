import { json, routeError } from "@/lib/api/route";
import { requireAuthenticatedContext } from "@/lib/auth/context";
import { prisma } from "@/lib/db/prisma";
import { productionReadyParsers } from "@/lib/statements/parsers";

export async function GET() {
  try {
    const context = await requireAuthenticatedContext("analysis.read");
    const [imports, transactions, review, unmatched] = await Promise.all([
      prisma.statementImport.count({ where: { householdId: context.householdId } }),
      prisma.actualTransaction.count({ where: { householdId: context.householdId } }),
      prisma.actualTransaction.count({
        where: { householdId: context.householdId, reviewState: { in: ["UNREVIEWED", "PARTIAL"] }, ignored: false },
      }),
      prisma.transactionTransferMatch.count({
        where: { householdId: context.householdId, status: "CANDIDATE" },
      }),
    ]);
    return json({ imports, transactions, review, pendingTransferMatches: unmatched, productionReadyParsers: productionReadyParsers() });
  } catch (error) {
    return routeError(error);
  }
}
