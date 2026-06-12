import type { FlowRouteKind } from "@/lib/budget/money-flow";

const palettes: Record<FlowRouteKind, string[]> = {
  income: [
    "var(--flow-income-1)",
    "var(--flow-income-2)",
    "var(--flow-income-3)",
    "var(--flow-income-4)",
    "var(--flow-income-5)",
    "var(--flow-income-6)",
    "var(--flow-income-7)",
    "var(--flow-income-8)",
  ],
  transfer: ["var(--flow-transfer)"],
  expense: [
    "var(--flow-expense-1)",
    "var(--flow-expense-2)",
    "var(--flow-expense-3)",
    "var(--flow-expense-4)",
    "var(--flow-expense-5)",
    "var(--flow-expense-6)",
    "var(--flow-expense-7)",
    "var(--flow-expense-8)",
    "var(--flow-expense-9)",
    "var(--flow-expense-10)",
    "var(--flow-expense-11)",
    "var(--flow-expense-12)",
  ],
  saving: ["var(--flow-saving-1)", "var(--flow-saving-2)", "var(--flow-saving-3)"],
  investment: ["var(--flow-investment-1)", "var(--flow-investment-2)", "var(--flow-investment-3)"],
  retirement: ["var(--flow-retirement-1)", "var(--flow-retirement-2)", "var(--flow-retirement-3)"],
};

export function flowRouteColor(routeKind: FlowRouteKind, colorKey: string): string {
  const palette = palettes[routeKind];
  return palette[stableHash(colorKey) % palette.length];
}

export function buildFlowColorMap(
  routes: Array<{ routeKind: FlowRouteKind; colorKey: string }>,
): Map<string, string> {
  const result = new Map<string, string>();
  const keysByKind = new Map<FlowRouteKind, string[]>();

  for (const route of routes) {
    const keys = keysByKind.get(route.routeKind) ?? [];
    if (!keys.includes(route.colorKey)) keys.push(route.colorKey);
    keysByKind.set(route.routeKind, keys);
  }

  for (const [routeKind, keys] of keysByKind) {
    const palette = palettes[routeKind];
    const usedIndices = new Set<number>();
    keys.sort().forEach((colorKey) => {
      const preferredIndex = stableHash(colorKey) % palette.length;
      let selectedIndex = preferredIndex;
      while (usedIndices.has(selectedIndex) && usedIndices.size < palette.length) {
        selectedIndex = (selectedIndex + 1) % palette.length;
      }
      usedIndices.add(selectedIndex);
      result.set(flowRouteKey(routeKind, colorKey), palette[selectedIndex]);
    });
  }

  return result;
}

export function flowRouteKey(routeKind: FlowRouteKind, colorKey: string): string {
  return `${routeKind}:${colorKey}`;
}

export function flowRouteLabel(routeKind: FlowRouteKind): string {
  if (routeKind === "income") return "Income";
  if (routeKind === "transfer") return "Internal transfer";
  if (routeKind === "expense") return "Expense";
  if (routeKind === "saving") return "Saving";
  if (routeKind === "investment") return "Investment";
  return "Retirement";
}

export function flowRouteDasharray(routeKind: FlowRouteKind): string | undefined {
  return routeKind === "transfer" ? "10 7" : undefined;
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
