import { json, readJson, routeError } from "@/lib/api/route";
import { requireAuthenticatedContext } from "@/lib/auth/context";
import { compareProjectionScenarios } from "@/lib/optimize/projection";
import { projectionComparisonSchema } from "@/lib/optimize/schemas";

export async function POST(request: Request) {
  try {
    await requireAuthenticatedContext("optimize.run");
    const input = await readJson(request, projectionComparisonSchema);
    return json(compareProjectionScenarios(input));
  } catch (error) {
    return routeError(error);
  }
}
