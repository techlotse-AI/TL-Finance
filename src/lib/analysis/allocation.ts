import { money, serializeMoney, sumMoney } from "@/lib/money/decimal";

export interface ActualAllocationInput {
  amount: string;
  categoryId: string;
  budgetItemId?: string;
}

export function reconcileActualAllocations(
  transactionAmount: string,
  allocations: ActualAllocationInput[],
  allowPartial = false,
) {
  const total = sumMoney(allocations.map((allocation) => allocation.amount));
  const transaction = money(transactionAmount);
  const reconciled = total.equals(transaction);

  if (!allowPartial && !reconciled) {
    throw new Error(
      `Actual allocations must reconcile exactly. Expected ${serializeMoney(transaction)}, received ${serializeMoney(total)}.`,
    );
  }

  if (!total.isZero() && total.isPositive() !== transaction.isPositive()) {
    throw new Error("Allocation signs must match the transaction sign.");
  }

  return {
    allocatedAmount: serializeMoney(total),
    remainingAmount: serializeMoney(transaction.minus(total)),
    reconciled,
  };
}
