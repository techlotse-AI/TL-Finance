import { json, routeError } from "@/lib/api/route";
import { requireAuthenticatedContext } from "@/lib/auth/context";
import { prisma } from "@/lib/db/prisma";
import { exportHousehold } from "@/lib/households/export";

export async function GET() {
  try {
    const context = await requireAuthenticatedContext("budget.read");
    return json(await exportHousehold(prisma, context.householdId), {
      headers: { "Content-Disposition": 'attachment; filename="tl-finance-household.json"' },
    });
  } catch (error) { return routeError(error); }
}
