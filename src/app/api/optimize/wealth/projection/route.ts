import { json, readJson, routeError } from "@/lib/api/route";
import { requireAuthenticatedContext } from "@/lib/auth/context";
import { projectWealth } from "@/lib/optimize/wealth-projection";
import { wealthProjectionRequestSchema } from "@/lib/optimize/schemas";

export async function POST(request: Request) {
  try {
    await requireAuthenticatedContext("optimize.run");
    const input = await readJson(request, wealthProjectionRequestSchema);
    return json(projectWealth(input));
  } catch (error) {
    return routeError(error);
  }
}
