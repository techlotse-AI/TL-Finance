import type { Prisma } from "@prisma/client";

type LifecycleClient = Pick<Prisma.TransactionClient, "accountPocket">;

export interface AccountLifecycleSummary {
  incomeAllocations: number;
  outgoingTransfers: number;
  incomingTransfers: number;
  fundedBudgetItems: number;
  receivingBudgetItems: number;
  actualTransactions: number;
  statementImports: number;
}

export const emptyAccountLifecycleSummary: AccountLifecycleSummary = {
  incomeAllocations: 0,
  outgoingTransfers: 0,
  incomingTransfers: 0,
  fundedBudgetItems: 0,
  receivingBudgetItems: 0,
  actualTransactions: 0,
  statementImports: 0,
};

export async function loadAccountLifecycleSummary(
  client: LifecycleClient,
  householdId: string,
  accountId: string,
): Promise<AccountLifecycleSummary> {
  const pockets = await client.accountPocket.findMany({
    where: { householdId, accountId, deletedAt: null },
    select: {
      _count: {
        select: {
          incomeAllocations: { where: { deletedAt: null } },
          outgoingTransfers: { where: { deletedAt: null } },
          incomingTransfers: { where: { deletedAt: null } },
          fundedBudgetItems: { where: { deletedAt: null } },
          receivingBudgetItems: { where: { deletedAt: null } },
          actualTransactions: true,
          statementImports: true,
        },
      },
    },
  });

  return pockets.reduce<AccountLifecycleSummary>(
    (summary, pocket) => ({
      incomeAllocations: summary.incomeAllocations + pocket._count.incomeAllocations,
      outgoingTransfers: summary.outgoingTransfers + pocket._count.outgoingTransfers,
      incomingTransfers: summary.incomingTransfers + pocket._count.incomingTransfers,
      fundedBudgetItems: summary.fundedBudgetItems + pocket._count.fundedBudgetItems,
      receivingBudgetItems: summary.receivingBudgetItems + pocket._count.receivingBudgetItems,
      actualTransactions: summary.actualTransactions + pocket._count.actualTransactions,
      statementImports: summary.statementImports + pocket._count.statementImports,
    }),
    { ...emptyAccountLifecycleSummary },
  );
}

export function activePlanReferenceCount(summary: AccountLifecycleSummary): number {
  return (
    summary.incomeAllocations +
    summary.outgoingTransfers +
    summary.incomingTransfers +
    summary.fundedBudgetItems +
    summary.receivingBudgetItems
  );
}

export function historicalReferenceCount(summary: AccountLifecycleSummary): number {
  return summary.actualTransactions + summary.statementImports;
}
