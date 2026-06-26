import { describe, expect, it } from "vitest";

import { buildAccountMinimumFlow } from "@/lib/budget/money-flow-reverse";
import type { FlowLink, FlowNode } from "@/lib/budget/money-flow";

function link(p: Partial<FlowLink> & { id: string; source: string; target: string; amount: string }): FlowLink {
  return { nativeAmount: p.amount, nativeCurrency: "CHF", description: "", internalTransfer: false, routeKind: "expense", colorKey: "expense:c", ...p };
}

const nodes: FlowNode[] = [
  { id: "income:s1", label: "Salary", kind: "income", routeKind: "income" },
  { id: "pocket:joint", label: "Joint · CHF", kind: "account" },
  { id: "pocket:savings", label: "Savings · CHF", kind: "account" },
  { id: "category:rent", label: "Rent", kind: "category", routeKind: "expense", colorKey: "expense:rent" },
  { id: "category:food", label: "Food", kind: "category", routeKind: "expense", colorKey: "expense:food" },
  { id: "category:invest", label: "ETF", kind: "category", routeKind: "investment", colorKey: "investment:invest" },
  { id: "item:rent", label: "Flat", kind: "item", routeKind: "expense", colorKey: "expense:rent" },
  { id: "item:groceries", label: "Groceries", kind: "item", routeKind: "expense", colorKey: "expense:food" },
  { id: "item:dining", label: "Dining", kind: "item", routeKind: "expense", colorKey: "expense:food" },
  { id: "item:etf", label: "ETF buy", kind: "item", routeKind: "investment", colorKey: "investment:invest" },
];

// Funded items: rent (2000) + groceries (600) + dining (400) paid from joint; etf (500) from savings.
const links: FlowLink[] = [
  link({ id: "inc", source: "income:s1", target: "pocket:joint", amount: "5000.0000", routeKind: "income", colorKey: "income:s1" }),
  link({ id: "ic-rent", source: "pocket:joint", target: "category:rent", amount: "2000.0000", colorKey: "expense:rent" }),
  link({ id: "ci-rent", source: "category:rent", target: "item:rent", amount: "2000.0000", colorKey: "expense:rent" }),
  link({ id: "ic-groc", source: "pocket:joint", target: "category:food", amount: "600.0000", colorKey: "expense:food" }),
  link({ id: "ci-groc", source: "category:food", target: "item:groceries", amount: "600.0000", colorKey: "expense:food" }),
  link({ id: "ic-dine", source: "pocket:joint", target: "category:food", amount: "400.0000", colorKey: "expense:food" }),
  link({ id: "ci-dine", source: "category:food", target: "item:dining", amount: "400.0000", colorKey: "expense:food" }),
  link({ id: "ic-etf", source: "pocket:savings", target: "category:invest", amount: "500.0000", routeKind: "investment", colorKey: "investment:invest" }),
  link({ id: "ci-etf", source: "category:invest", target: "item:etf", amount: "500.0000", routeKind: "investment", colorKey: "investment:invest" }),
];

describe("buildAccountMinimumFlow", () => {
  it("drops income nodes and income/transfer links", () => {
    const out = buildAccountMinimumFlow(nodes, links, "CHF");
    expect(out.nodes.some((n) => n.kind === "income")).toBe(false);
    expect(out.links.some((l) => l.source.startsWith("income:"))).toBe(false);
  });

  it("merges account->category payments per pair (food = groceries + dining)", () => {
    const out = buildAccountMinimumFlow(nodes, links, "CHF");
    const jointFood = out.links.filter((l) => l.source === "pocket:joint" && l.target === "category:food");
    expect(jointFood).toHaveLength(1);
    expect(jointFood[0].amount).toBe("1000.0000"); // 600 + 400
  });

  it("computes minimum account values (sum of items paid from each account)", () => {
    const out = buildAccountMinimumFlow(nodes, links, "CHF");
    expect(out.accountMinimums).toEqual([
      { id: "pocket:joint", label: "Joint · CHF", amount: "3000.0000" }, // 2000 + 600 + 400
      { id: "pocket:savings", label: "Savings · CHF", amount: "500.0000" },
    ]);
  });

  it("computes category totals, sorted largest first", () => {
    const out = buildAccountMinimumFlow(nodes, links, "CHF");
    expect(out.categoryTotals).toEqual([
      { id: "category:rent", label: "Rent", amount: "2000.0000" },
      { id: "category:food", label: "Food", amount: "1000.0000" },
      { id: "category:invest", label: "ETF", amount: "500.0000" },
    ]);
  });

  it("preserves category -> item links", () => {
    const out = buildAccountMinimumFlow(nodes, links, "CHF");
    expect(out.links.filter((l) => l.source.startsWith("category:") && l.target.startsWith("item:"))).toHaveLength(4);
  });
});
