import { LockedTierPage } from "@/components/locked-tier-page";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requirePageContext } from "@/lib/auth/page-context";
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
        "Review queue",
        "Transfer and FX matching",
        "Cash allocation",
        "Budget adherence",
      ]}
      description="Actual activity, allocation, reconciliation, and planned-versus-actual adherence begin in v0.2.0."
      tier="Analyze"
      title="Analyze"
    />
  );
  }
  const [imports, transactions, review] = await Promise.all([
    prisma.statementImport.count({ where: { householdId: context.householdId } }),
    prisma.actualTransaction.count({ where: { householdId: context.householdId } }),
    prisma.actualTransaction.count({ where: { householdId: context.householdId, reviewState: { in: ["UNREVIEWED", "PARTIAL"] } } }),
  ]);
  return <div className="mx-auto max-w-app space-y-6">
    <PageHeader title="Analyze foundation" description="Statement source facts and deterministic reconciliation foundations are enabled. No institution parser is production-ready without sanitized fixtures." />
    <section className="grid gap-4 sm:grid-cols-3">
      {[["Statement imports", imports], ["Actual transactions", transactions], ["Review queue", review]].map(([label, count]) => <Card className="p-5" key={label}><p className="text-sm text-subdued">{label}</p><p className="mt-2 text-2xl font-semibold">{count}</p></Card>)}
    </section>
    <Card className="p-5"><Badge tone="warning">No production-ready parsers</Badge><p className="mt-3 text-sm text-subdued">The preview API fails closed until at least two sanitized real fixtures support an institution parser.</p></Card>
  </div>;
}
