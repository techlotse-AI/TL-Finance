import type { Prisma } from "@prisma/client";

import { ApiError } from "@/lib/api/errors";

type Client = Pick<Prisma.TransactionClient, "actualTransaction" | "budgetItem">;

export async function requireOwnedTransaction(client: Client, householdId: string, id: string) {
  const transaction = await client.actualTransaction.findFirst({ where: { id, householdId } });
  if (!transaction) throw new ApiError(404, "transaction_not_found", "Transaction not found.");
  return transaction;
}

export async function requireOwnedBudgetItem(client: Client, householdId: string, id: string) {
  const item = await client.budgetItem.findFirst({ where: { id, householdId, deletedAt: null } });
  if (!item) throw new ApiError(400, "invalid_budget_item", "Budget item does not belong to household.");
  return item;
}
