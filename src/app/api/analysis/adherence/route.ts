import { json, routeError } from "@/lib/api/route";
import { adherenceForMonth } from "@/lib/analysis/queries";
import { requireAuthenticatedContext } from "@/lib/auth/context";

export async function GET(request: Request) {
  try {
    const context = await requireAuthenticatedContext("analysis.read");
    const month = new URL(request.url).searchParams.get("month");
    return json(await adherenceForMonth(context.householdId, month));
  } catch (error) {
    return routeError(error);
  }
}
