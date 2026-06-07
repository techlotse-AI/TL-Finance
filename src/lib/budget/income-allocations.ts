import { money, serializeMoney, sumMoney } from "@/lib/money/decimal";

export type IncomeAllocationInput =
  | { method: "fixed"; fixedAmount: string; percentage?: never }
  | { method: "percentage"; fixedAmount?: never; percentage: string };

export interface ReconciledIncomeAllocation {
  index: number;
  amount: string;
}

export function reconcileIncomeAllocations(
  sourceAmount: string,
  allocations: IncomeAllocationInput[],
): ReconciledIncomeAllocation[] {
  const total = money(sourceAmount);
  const reconciled = allocations.map((allocation, index) => ({
    index,
    amount:
      allocation.method === "fixed"
        ? money(allocation.fixedAmount)
        : total.times(money(allocation.percentage)),
  }));
  const allocationTotal = sumMoney(reconciled.map((allocation) => allocation.amount));

  if (!allocationTotal.equals(total)) {
    throw new Error(
      `Income allocations must reconcile exactly. Expected ${serializeMoney(total)}, received ${serializeMoney(allocationTotal)}.`,
    );
  }

  return reconciled.map((allocation) => ({
    index: allocation.index,
    amount: serializeMoney(allocation.amount),
  }));
}
