import { OptimizeWorkspace } from "@/components/optimize/optimize-workspace";
import { PageHeader } from "@/components/ui/page-header";
import { requirePageContext } from "@/lib/auth/page-context";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export default async function OptimizePage() {
  const context = await requirePageContext();

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
