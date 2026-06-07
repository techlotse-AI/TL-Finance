import { LockedTierPage } from "@/components/locked-tier-page";
import { ScenarioCalculator } from "@/components/optimize/scenario-calculator";
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
          "Scenarios",
          "Account forecasts",
          "Emergency fund",
          "Pillar 3a calculations",
          "Recommendations",
          "Predictions",
        ]}
        description="Deterministic forecasts, scenarios, and explainable recommendations begin in v0.3.0."
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
        description="Compare explicit financial assumptions with deterministic Decimal calculations. Optimize never changes the household budget automatically."
        eyebrow="Optimize tier"
        title="Scenario projections"
      />
      <ScenarioCalculator currency={household.baseCurrency} />
    </div>
  );
}
