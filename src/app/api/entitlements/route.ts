import { json, routeError } from "@/lib/api/route";
import { requireAuthenticatedContext } from "@/lib/auth/context";
import { capabilities, hasCapability } from "@/lib/entitlements/capabilities";

export async function GET() {
  try {
    const context = await requireAuthenticatedContext();
    return json({
      tier: context.tier,
      capabilities: capabilities.filter((capability) =>
        hasCapability(context.tier, capability, context.instanceAdmin),
      ),
    });
  } catch (error) { return routeError(error); }
}
