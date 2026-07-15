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

/**
 * South African household starter categories (v0.9.5 groundwork). Unlike a
 * statement parser, these are only default suggestions the household can
 * rename or delete freely — no real bank export format to match, so ordinary
 * domain knowledge of common SA household line items is sufficient here.
 */
const zaPreset: CategoryPreset[] = [
  ...genericPreset,
  {
    group: "South African household",
    categories: [
      { name: "Medical aid", kind: "EXPENSE", essential: true },
      { name: "UIF", kind: "EXPENSE", essential: true },
      { name: "Rates and levies", kind: "EXPENSE", essential: true },
      { name: "Retirement annuity", kind: "RETIREMENT" },
      { name: "Tax-free savings account", kind: "SAVING" },
    ],
  },
];

export const categoryPresets = {
  generic: genericPreset,
  swiss: swissPreset,
  za: zaPreset,
} as const;

export type CountryProfileKey = keyof typeof categoryPresets;
