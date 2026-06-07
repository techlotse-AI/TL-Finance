import { Badge } from "@/components/ui/badge";
import { IncomeCreateForm } from "@/components/create-forms";
import { EntityListPage } from "@/components/entity-list-page";
import { requirePageContext } from "@/lib/auth/page-context";
import { fromDbRecurrence } from "@/lib/budget/db-mapping";
import { normalizeMonthly } from "@/lib/budget/recurrence";
import { prisma } from "@/lib/db/prisma";
import { formatMoney } from "@/lib/money/decimal";

export const dynamic = "force-dynamic";

export default async function IncomePage() {
  const context = await requirePageContext();
  const [sources, categories, pockets] = await Promise.all([
    prisma.incomeSource.findMany({
      where: { householdId: context.householdId, deletedAt: null },
      include: { allocations: { where: { deletedAt: null }, include: { accountPocket: { include: { account: { select: { name: true } } } } } } },
      orderBy: { name: "asc" },
    }),
    prisma.category.findMany({ where: { householdId: context.householdId, kind: "INCOME", deletedAt: null }, select: { id: true, name: true } }),
    prisma.accountPocket.findMany({ where: { householdId: context.householdId, deletedAt: null }, select: { id: true, name: true, currency: true } }),
  ]);
  return (
    <EntityListPage
      caption="Planned income sources"
      description="Expected income and its reconciled receiving-pocket allocations."
      headers={["Income source", "Recurrence", "Native amount", "Receiving pocket", "Status"]}
      note={<IncomeCreateForm categories={categories} pockets={pockets} />}
      rows={sources.map((source) => {
        const normalized = normalizeMonthly({ amount: source.amount.toString(), recurrence: fromDbRecurrence(source.recurrence), selectedMonths: source.selectedMonths });
        return [
          <span className="font-medium" key={source.id}>{source.name}</span>,
          source.recurrence.toLowerCase().replace("_", " "),
          <span className="tabular-nums" key={`${source.id}:amount`}>{formatMoney(normalized.monthlyAmount, source.currency)}</span>,
          source.allocations.map((allocation) => `${allocation.accountPocket.account.name} · ${allocation.accountPocket.currency}`).join(", "),
          <Badge key={`${source.id}:status`} tone="success">Reconciled</Badge>,
        ];
      })}
      title="Income routing"
    />
  );
}
