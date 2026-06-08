import { AnalysisWorkspace } from "@/components/analysis/analysis-workspace";
import { LockedTierPage } from "@/components/locked-tier-page";
import { PageHeader } from "@/components/ui/page-header";
import { requirePageContext } from "@/lib/auth/page-context";
import { productionReadyParsers } from "@/lib/statements/parsers";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export default async function AnalysisPage() {
  const context = await requirePageContext();

  if (context.tier === "budget") {
    return (
      <LockedTierPage
        capabilities={[
          "Statement import",
          "Actual transactions",
          "Review queue and allocation",
          "Transfer and FX matching",
          "Budget adherence",
          "Money-leak findings",
        ]}
        description="Actual activity, allocation, reconciliation, planned-versus-actual adherence, and money-leak findings are part of the Analyze tier."
        tier="Analyze"
        title="Analyze"
      />
    );
  }

  const [pocketRows, categoryRows, budgetItemRows, imports, transactions, review] = await Promise.all([
    prisma.accountPocket.findMany({
      where: { householdId: context.householdId, deletedAt: null, active: true },
      include: { account: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.category.findMany({
      where: { householdId: context.householdId, deletedAt: null, active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, kind: true },
    }),
    prisma.budgetItem.findMany({
      where: { householdId: context.householdId, deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, categoryId: true, currency: true },
    }),
    prisma.statementImport.count({ where: { householdId: context.householdId } }),
    prisma.actualTransaction.count({ where: { householdId: context.householdId } }),
    prisma.actualTransaction.count({
      where: { householdId: context.householdId, reviewState: { in: ["UNREVIEWED", "PARTIAL"] }, ignored: false },
    }),
  ]);

  const pockets = pocketRows.map((pocket) => ({
    id: pocket.id,
    name: pocket.name,
    currency: pocket.currency,
    accountName: pocket.account.name,
  }));

  return (
    <div className="mx-auto max-w-app space-y-6">
      <PageHeader
        eyebrow="Analyze tier"
        title="Analyze"
        description="Import statements, categorize real activity, reconcile internal transfers, and surface where money is leaking against your plan."
      />
      <AnalysisWorkspace
        pockets={pockets}
        categories={categoryRows}
        budgetItems={budgetItemRows}
        parsers={productionReadyParsers()}
        initialStatus={{ imports, transactions, review }}
      />
    </div>
  );
}
