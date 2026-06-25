import { EntityListPage } from "@/components/entity-list-page";
import { BudgetItemCreateForm } from "@/components/create-forms";
import { BudgetItemActions } from "@/components/budget-item-actions";
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
      headers={["Budget item", "Kind", "Category", "Paid from", "Paid to", "Entered amount", "Monthly amount", "Route", "Actions"]}
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
        <span className="tabular-nums" key={`${item.id}:entered`}>
          {formatMoney(item.amount.toString(), item.currency)}
          <span className="block text-xs text-subdued">{recurrenceLabel(fromDbRecurrence(item.recurrence), item.selectedMonths)}</span>
        </span>,
        <span className="tabular-nums" key={`${item.id}:amount`}>{formatMoney(normalizeMonthly({ amount: item.amount.toString(), recurrence: fromDbRecurrence(item.recurrence), selectedMonths: item.selectedMonths }).monthlyAmount, item.currency)}</span>,
        item.paidFromAccountPocket ? (
          <Badge key={`${item.id}:route`} tone="success">Routed</Badge>
        ) : (
          <Badge key={`${item.id}:route`} tone="warning">Unallocated</Badge>
        ),
        <BudgetItemActions
          key={`${item.id}:actions`}
          categories={categories.map((category) => ({ id: category.id, name: category.name, kind: category.kind.toLowerCase() }))}
          item={{
            id: item.id,
            name: item.name,
            amount: item.amount.toString(),
            currency: item.currency,
            kind: item.kind.toLowerCase(),
            recurrence: fromDbRecurrence(item.recurrence),
            selectedMonths: item.selectedMonths,
            startDate: item.startDate.toISOString(),
            essential: item.essential,
            categoryId: item.categoryId,
            paidFromAccountPocketId: item.paidFromAccountPocketId,
            paidToAccountPocketId: item.paidToAccountPocketId,
          }}
        />,
      ])}
      title="Budget items"
    />
  );
}

function recurrenceLabel(recurrence: ReturnType<typeof fromDbRecurrence>, selectedMonths: number[]) {
  if (recurrence === "once") return "one-time";
  if (recurrence === "weekly") return "each week";
  if (recurrence === "monthly") return "each month";
  if (recurrence === "quarterly") return "each quarter";
  if (recurrence === "yearly") return "each year";
  return `in ${selectedMonths.length} selected month${selectedMonths.length === 1 ? "" : "s"}`;
}
