import { routeError } from "@/lib/api/route";
import { requireAuthenticatedContext } from "@/lib/auth/context";

export async function GET() {
  try {
    await requireAuthenticatedContext("budget.read");
    return Response.json({
      message: "Income allocations are managed transactionally through /api/income-sources.",
    });
  } catch (error) { return routeError(error); }
}
