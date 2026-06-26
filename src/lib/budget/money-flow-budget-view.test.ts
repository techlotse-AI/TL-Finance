import { describe, expect, it } from "vitest";

import { collapseToBudgetFlow } from "@/lib/budget/money-flow-budget-view";
import type { FlowLink, FlowNode } from "@/lib/budget/money-flow";

function link(partial: Partial<FlowLink> & { id: string; source: string; target: string; amount: string }): FlowLink {
  return {
    nativeAmount: partial.amount,
    nativeCurrency: "CHF",
    description: "",
    internalTransfer: false,
    routeKind: "expense",
    colorKey: "expense:c",
    ...partial,
  };
}

const nodes: FlowNode[] = [
  { id: "income:s1", label: "Salary 1", kind: "income", routeKind: "income" },
  { id: "income:s2", label: "Salary 2", kind: "income", routeKind: "income" },
  { id: "pocket:a1", label: "Account 1", kind: "account" },
  { id: "pocket:a2", label: "Account 2", kind: "account", spending: true },
  { id: "category:rent", label: "Rent", kind: "category", routeKind: "expense", colorKey: "expense:rent" },
  { id: "item:rent", label: "Flat", kind: "item", routeKind: "expense", colorKey: "expense:rent" },
];

const links: FlowLink[] = [
  link({ id: "alloc1", source: "income:s1", target: "pocket:a1", amount: "6000.0000", routeKind: "income", colorKey: "income:s1" }),
  link({ id: "alloc2", source: "income:s2", target: "pocket:a1", amount: "2000.0000", routeKind: "income", colorKey: "income:s2" }),
  link({ id: "transfer", source: "pocket:a1", target: "pocket:a2", amount: "3000.0000", routeKind: "transfer", internalTransfer: true, colorKey: "transfer" }),
  link({ id: "pay", source: "pocket:a2", target: "category:rent", amount: "2400.0000", colorKey: "expense:rent" }),
  link({ id: "cat-item", source: "category:rent", target: "item:rent", amount: "2400.0000", colorKey: "expense:rent" }),
];

describe("collapseToBudgetFlow", () => {
  it("drops all account nodes and transfer/account links", () => {
    const { nodes: outNodes, links: outLinks } = collapseToBudgetFlow(nodes, links, "CHF");
    expect(outNodes.some((node) => node.kind === "account")).toBe(false);
    expect(outLinks.some((flowLink) => flowLink.internalTransfer)).toBe(false);
    expect(outLinks.some((flowLink) => flowLink.source.startsWith("pocket:"))).toBe(false);
  });

  it("splits each category total across income sources by income share, summing to the total", () => {
    const { links: outLinks } = collapseToBudgetFlow(nodes, links, "CHF");
    // total income 8000 (6000 + 2000); rent total 2400.
    // s1 share 0.75 -> 1800; s2 share 0.25 -> 600; sum = 2400.
    const s1 = outLinks.find((l) => l.source === "income:s1" && l.target === "category:rent");
    const s2 = outLinks.find((l) => l.source === "income:s2" && l.target === "category:rent");
    expect(s1?.amount).toBe("1800.0000");
    expect(s2?.amount).toBe("600.0000");
    const sum = Number(s1?.amount) + Number(s2?.amount);
    expect(sum).toBe(2400);
  });

  it("preserves category -> item links", () => {
    const { links: outLinks } = collapseToBudgetFlow(nodes, links, "CHF");
    const catItem = outLinks.find((l) => l.source === "category:rent" && l.target === "item:rent");
    expect(catItem?.amount).toBe("2400.0000");
  });

  it("falls back to category->item only when there is no income", () => {
    const noIncomeNodes = nodes.filter((n) => n.kind !== "income");
    const noIncomeLinks = links.filter((l) => !l.source.startsWith("income:"));
    const { links: outLinks } = collapseToBudgetFlow(noIncomeNodes, noIncomeLinks, "CHF");
    expect(outLinks.every((l) => l.source.startsWith("category:"))).toBe(true);
  });
});
