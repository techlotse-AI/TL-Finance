import { json, routeError } from "@/lib/api/route";
import { requireAuthenticatedContext } from "@/lib/auth/context";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
    const context = await requireAuthenticatedContext("analysis.read");
    const imports = await prisma.statementImport.findMany({
      where: { householdId: context.householdId },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        accountPocket: { include: { account: { select: { name: true } } } },
      },
    });
    return json(imports);
  } catch (error) {
    return routeError(error);
  }
}
