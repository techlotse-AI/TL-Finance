import { json, readJson, routeError } from "@/lib/api/route";
import { requireAuthenticatedContext } from "@/lib/auth/context";
import { computeDrawdown } from "@/lib/optimize/drawdown";
import { drawdownRequestSchema } from "@/lib/optimize/schemas";

export async function POST(request: Request) {
  try {
    await requireAuthenticatedContext("optimize.run");
    const input = await readJson(request, drawdownRequestSchema);
    return json(computeDrawdown(input));
  } catch (error) {
    return routeError(error);
  }
}
