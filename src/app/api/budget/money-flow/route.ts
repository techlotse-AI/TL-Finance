import { json, routeError } from "@/lib/api/route";
import { requireAuthenticatedContext } from "@/lib/auth/context";
import { buildPersistedMoneyFlow } from "@/lib/budget/persisted-plan";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
    const context = await requireAuthenticatedContext("budget.read");
    return json(await buildPersistedMoneyFlow(prisma, context.householdId));
  } catch (error) { return routeError(error); }
}
