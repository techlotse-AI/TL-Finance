import type { CategoryKind } from "@prisma/client";

export interface CategoryPreset {
  group: string;
  categories: Array<{
    name: string;
    kind: CategoryKind;
    essential?: boolean;
  }>;
}

const genericPreset: CategoryPreset[] = [
  { group: "Income", categories: [{ name: "Employment income", kind: "INCOME" }] },
  {
    group: "Living",
    categories: [
      { name: "Housing", kind: "EXPENSE", essential: true },
      { name: "Groceries", kind: "EXPENSE", essential: true },
      { name: "Transport", kind: "EXPENSE", essential: true },
    ],
  },
  { group: "Saving", categories: [{ name: "General saving", kind: "SAVING" }] },
  { group: "Investment", categories: [{ name: "General investment", kind: "INVESTMENT" }] },
  { group: "Retirement", categories: [{ name: "Retirement contribution", kind: "RETIREMENT" }] },
];

const swissPreset: CategoryPreset[] = [
  ...genericPreset,
  {
    group: "Swiss household",
    categories: [
      { name: "Quellensteuer", kind: "EXPENSE", essential: true },
      { name: "Nebenkosten", kind: "EXPENSE", essential: true },
      { name: "Serafe", kind: "EXPENSE", essential: true },
      { name: "Health insurance", kind: "EXPENSE", essential: true },
      { name: "Swiss public transport", kind: "EXPENSE" },
      { name: "Pillar 3a", kind: "RETIREMENT" },
    ],
  },
];

export const categoryPresets = {
  generic: genericPreset,
  swiss: swissPreset,
} as const;

export type CountryProfileKey = keyof typeof categoryPresets;
