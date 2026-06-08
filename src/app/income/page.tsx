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
  const [household, sources, categories, pockets] = await Promise.all([
    prisma.household.findUniqueOrThrow({
      where: { id: context.householdId },
      select: { baseCurrency: true },
    }),
    prisma.incomeSource.findMany({
      where: { householdId: context.householdId, deletedAt: null },
      include: { allocations: { where: { deletedAt: null }, include: { accountPocket: { include: { account: { select: { name: true } } } } } } },
      orderBy: { name: "asc" },
    }),
    prisma.category.findMany({ where: { householdId: context.householdId, kind: "INCOME", deletedAt: null }, select: { id: true, name: true } }),
    prisma.accountPocket.findMany({
      where: { householdId: context.householdId, active: true, deletedAt: null, account: { active: true, deletedAt: null } },
      select: { id: true, name: true, currency: true, account: { select: { name: true } } },
      orderBy: [{ account: { name: "asc" } }, { currency: "asc" }],
    }),
  ]);
  return (
    <EntityListPage
      caption="Planned income sources"
      description="Expected income and its reconciled receiving-account allocations."
      headers={["Income source", "Recurrence", "Native amount", "Receiving account", "Status"]}
      note={<IncomeCreateForm
        baseCurrency={household.baseCurrency}
        categories={categories}
        pockets={pockets.map((pocket) => ({
          id: pocket.id,
          name: pocket.name,
          currency: pocket.currency,
          accountName: pocket.account.name,
        }))}
      />}
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
