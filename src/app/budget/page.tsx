import { EntityListPage } from "@/components/entity-list-page";
import { BudgetItemCreateForm } from "@/components/create-forms";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/money/decimal";
import { requirePageContext } from "@/lib/auth/page-context";
import { fromDbRecurrence } from "@/lib/budget/db-mapping";
import { normalizeMonthly } from "@/lib/budget/recurrence";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export default async function BudgetPage() {
  const context = await requirePageContext();
  const [household, items, categories, pockets] = await Promise.all([
    prisma.household.findUniqueOrThrow({ where: { id: context.householdId }, select: { baseCurrency: true } }),
    prisma.budgetItem.findMany({
      where: { householdId: context.householdId, deletedAt: null },
      include: { category: true, paidFromAccountPocket: { include: { account: true } }, paidToAccountPocket: { include: { account: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.category.findMany({ where: { householdId: context.householdId, kind: { not: "INCOME" }, deletedAt: null }, select: { id: true, name: true, kind: true } }),
    prisma.accountPocket.findMany({
      where: { householdId: context.householdId, active: true, deletedAt: null, account: { active: true, deletedAt: null } },
      select: { id: true, currency: true, account: { select: { name: true, type: true } } },
      orderBy: [{ account: { name: "asc" } }, { currency: "asc" }],
    }),
  ]);
  return (
    <EntityListPage
      caption="Normalized monthly budget items"
      description="Recurring expenses and routed saving, investment, and retirement allocations."
      headers={["Budget item", "Kind", "Category", "Paid from", "Paid to", "Monthly amount", "Route"]}
      note={<BudgetItemCreateForm
        baseCurrency={household.baseCurrency}
        categories={categories.map((category) => ({ ...category, kind: category.kind.toLowerCase() }))}
        pockets={pockets.map((pocket) => ({
          id: pocket.id,
          currency: pocket.currency,
          accountName: pocket.account.name,
          accountType: pocket.account.type.toLowerCase(),
        }))}
      />}
      rows={items.map((item) => [
        <span className="font-medium" key={item.id}>{item.name}</span>,
        item.kind.toLowerCase(),
        item.category.name,
        item.paidFromAccountPocket ? `${item.paidFromAccountPocket.account.name} · ${item.paidFromAccountPocket.currency}` : "—",
        item.paidToAccountPocket ? `${item.paidToAccountPocket.account.name} · ${item.paidToAccountPocket.currency}` : "—",
        <span className="tabular-nums" key={`${item.id}:amount`}>{formatMoney(normalizeMonthly({ amount: item.amount.toString(), recurrence: fromDbRecurrence(item.recurrence), selectedMonths: item.selectedMonths }).monthlyAmount, item.currency)}</span>,
        item.paidFromAccountPocket ? (
          <Badge key={`${item.id}:route`} tone="success">Routed</Badge>
        ) : (
          <Badge key={`${item.id}:route`} tone="warning">Unallocated</Badge>
        ),
      ])}
      title="Budget items"
    />
  );
}
