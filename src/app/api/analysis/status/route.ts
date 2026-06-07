import { json, routeError } from "@/lib/api/route";
import { requireAuthenticatedContext } from "@/lib/auth/context";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
    const context = await requireAuthenticatedContext("analysis.read");
    const [imports, transactions, review] = await Promise.all([
      prisma.statementImport.count({ where: { householdId: context.householdId } }),
      prisma.actualTransaction.count({ where: { householdId: context.householdId } }),
      prisma.actualTransaction.count({ where: { householdId: context.householdId, reviewState: { in: ["UNREVIEWED", "PARTIAL"] } } }),
    ]);
    return json({ imports, transactions, review, productionReadyParsers: [] });
  } catch (error) { return routeError(error); }
}
