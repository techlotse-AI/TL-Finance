import { LockedTierPage } from "@/components/locked-tier-page";
import { OptimizeWorkspace } from "@/components/optimize/optimize-workspace";
import { PageHeader } from "@/components/ui/page-header";
import { requirePageContext } from "@/lib/auth/page-context";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export default async function OptimizePage() {
  const context = await requirePageContext();

  if (context.tier !== "optimize") {
    return (
      <LockedTierPage
        capabilities={[
          "Scenario projections",
          "Emergency-fund sizing",
          "Swiss Pillar 3a planning",
          "Holdings & balance forecasts",
          "Pension & retirement planning",
          "Explainable recommendations",
        ]}
        description="Deterministic forecasts, scenarios, holdings, Swiss pension and retirement planning, and explainable recommendations are part of the Optimize tier."
        tier="Optimize"
        title="Optimize"
      />
    );
  }

  const household = await prisma.household.findUniqueOrThrow({
    where: { id: context.householdId },
    select: { baseCurrency: true },
  });

  return (
    <div className="mx-auto max-w-app space-y-6">
      <PageHeader
        eyebrow="Optimize tier"
        title="Optimize"
        description="Plan with explicit, deterministic Decimal calculations: scenarios, an emergency fund sized from your essentials, Swiss Pillar 3a, and ranked recommendations. Optimize never changes your budget automatically."
      />
      <OptimizeWorkspace currency={household.baseCurrency} />
    </div>
  );
}
