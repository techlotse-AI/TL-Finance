import { ArrowLeftRight } from "lucide-react";

import { EntityListPage } from "@/components/entity-list-page";
import { TransferCreateForm } from "@/components/create-forms";
import { TransferActions } from "@/components/transfer-actions";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatWhole } from "@/lib/money/rounding";
import { requirePageContext } from "@/lib/auth/page-context";
import { fromDbRecurrence } from "@/lib/budget/db-mapping";
import { normalizeMonthly } from "@/lib/budget/recurrence";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export default async function TransfersPage() {
  const context = await requirePageContext();
  const [transfers, pockets] = await Promise.all([
    prisma.plannedAccountTransfer.findMany({
      where: { householdId: context.householdId, deletedAt: null },
      include: {
        fromAccountPocket: { include: { account: { select: { name: true } } } },
        toAccountPocket: { include: { account: { select: { name: true } } } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.accountPocket.findMany({
      where: { householdId: context.householdId, active: true, deletedAt: null, account: { active: true, deletedAt: null } },
      select: { id: true, currency: true, account: { select: { name: true } } },
      orderBy: [{ account: { name: "asc" } }, { currency: "asc" }],
    }),
  ]);
  return (
    <EntityListPage
      caption="Planned account transfers"
      description="Internal movements between household account currencies. They are never counted as income or spending."
      emptyDescription="Add a transfer below to route money between your accounts, e.g. for cross-currency conversions."
      emptyTitle="No transfers yet"
      headers={["Transfer", "From", "To", "Recurrence", "Monthly amount", "Treatment", "Actions"]}
      note={
        <div className="grid gap-4 lg:grid-cols-2"><TransferCreateForm pockets={pockets.map((pocket) => ({ id: pocket.id, currency: pocket.currency, accountName: pocket.account.name }))} /><Card className="flex items-center gap-3 border-brand-violet/30 bg-brand-violet/5 px-4 py-3 text-sm text-subdued"><ArrowLeftRight className="size-4 shrink-0 text-brand-teal" strokeWidth={1.5} />Cross-currency transfers are routing allocations, not predicted destination balances.</Card></div>
      }
      rows={transfers.map((transfer) => [
        transfer.name, `${transfer.fromAccountPocket.account.name} · ${transfer.fromAccountPocket.currency}`,
        `${transfer.toAccountPocket.account.name} · ${transfer.toAccountPocket.currency}`,
        transfer.recurrence.toLowerCase().replace("_", " "),
        <span className="tabular-nums" key={`${transfer.id}:amount`}>{formatWhole(normalizeMonthly({ amount: transfer.amount.toString(), recurrence: fromDbRecurrence(transfer.recurrence), selectedMonths: transfer.selectedMonths }).monthlyAmount, transfer.currency)}</span>,
        <Badge key={transfer.id}>Excluded from spending</Badge>,
        <TransferActions key={`${transfer.id}:actions`} transfer={{ id: transfer.id, name: transfer.name }} />,
      ])}
      title="Planned transfers"
    />
  );
}
