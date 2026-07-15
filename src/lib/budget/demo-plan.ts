import { buildMoneyFlow, type FlowBudgetItem, type FlowPocket } from "@/lib/budget/money-flow";

export const demoPockets: FlowPocket[] = [
  { id: "daily-chf", name: "Daily account · CHF", currency: "CHF" },
  { id: "bills-chf", name: "Bills account · CHF", currency: "CHF" },
  { id: "pillar3a-chf", name: "Pillar 3a · CHF", currency: "CHF" },
];

export const demoBudgetItems: FlowBudgetItem[] = [
  {
    id: "rent",
    name: "Rent and Nebenkosten",
    kind: "expense",
    categoryId: "housing",
    categoryName: "Housing",
    currency: "CHF",
    monthlyAmount: "2400.0000",
    paidFromPocketId: "bills-chf",
  },
  {
    id: "health",
    name: "Health insurance",
    kind: "expense",
    categoryId: "insurance",
    categoryName: "Insurance",
    currency: "CHF",
    monthlyAmount: "900.0000",
    paidFromPocketId: "daily-chf",
  },
  {
    id: "living",
    name: "Living costs",
    kind: "expense",
    categoryId: "living",
    categoryName: "Everyday living",
    currency: "CHF",
    monthlyAmount: "2100.0000",
    paidFromPocketId: "daily-chf",
  },
  {
    // Annual bill saved monthly — exercises the dashed provision rendering.
    id: "insurance-annual",
    name: "Car & household insurance (annual)",
    kind: "expense",
    categoryId: "insurance",
    categoryName: "Insurance",
    currency: "CHF",
    monthlyAmount: "120.0000",
    paidFromPocketId: "daily-chf",
    provision: true,
  },
  {
    id: "pillar3a",
    name: "Pillar 3a contribution",
    kind: "retirement",
    categoryId: "retirement",
    categoryName: "Retirement",
    currency: "CHF",
    monthlyAmount: "588.0000",
    paidFromPocketId: "daily-chf",
    paidToPocketId: "pillar3a-chf",
  },
];

export const demoPlan = buildMoneyFlow({
  reportingCurrency: "CHF",
  pockets: demoPockets,
  incomeSources: [
    {
      id: "salary",
      name: "Salary",
      currency: "CHF",
      monthlyAmount: "7800.0000",
      allocations: [{ pocketId: "daily-chf", amount: "7800.0000" }],
    },
  ],
  transfers: [
    {
      id: "fund-bills",
      name: "Fund bills account",
      currency: "CHF",
      monthlyAmount: "2400.0000",
      fromPocketId: "daily-chf",
      toPocketId: "bills-chf",
    },
  ],
  budgetItems: demoBudgetItems,
});
