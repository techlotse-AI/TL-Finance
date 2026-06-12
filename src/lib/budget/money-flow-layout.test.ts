import { describe, expect, it } from "vitest";

import { layoutMoneyFlow } from "@/lib/budget/money-flow-layout";
import type { FlowLink, FlowNode } from "@/lib/budget/money-flow";

const nodes: FlowNode[] = [
  { id: "income:a", label: "Income A", kind: "income" },
  { id: "income:b", label: "Income B", kind: "income" },
  { id: "pocket:a", label: "Account A", kind: "account" },
  { id: "pocket:b", label: "Account B", kind: "account" },
  { id: "category:retirement", label: "Retirement", kind: "category" },
  { id: "item:3a", label: "Pillar 3a", kind: "item" },
];

function link(id: string, source: string, target: string, amount = "1000"): FlowLink {
  return {
    id,
    source,
    target,
    amount,
    nativeAmount: amount,
    nativeCurrency: "CHF",
    description: id,
    internalTransfer: id.startsWith("transfer"),
    routeKind: id.startsWith("transfer") ? "transfer" : "income",
    colorKey: id,
  };
}

describe("layoutMoneyFlow", () => {
  it("places every visual route from left to right, including transfers and contribution destinations", () => {
    const layout = layoutMoneyFlow(nodes, [
      link("income", "income:a", "pocket:a"),
      link("transfer:a-b", "pocket:a", "pocket:b"),
      link("category", "pocket:b", "category:retirement"),
      link("item", "category:retirement", "item:3a"),
      link("destination", "item:3a", "pocket:b"),
    ]);

    expect(layout.links.every((route) => route.sourceX < route.targetX)).toBe(true);
    expect(layout.nodes.filter((node) => node.id === "pocket:b").map((node) => node.rank)).toEqual([2, 5]);
    expect(layout.nodes.find((node) => node.id === "category:retirement")!.rank).toBe(3);
  });

  it("orders connected nodes to remove a simple crossing", () => {
    const layout = layoutMoneyFlow(nodes, [
      link("a-to-b", "income:a", "pocket:b"),
      link("b-to-a", "income:b", "pocket:a"),
    ]);
    const byId = new Map(layout.nodes.map((node) => [node.id, node]));

    expect(byId.get("income:a")!.y).toBeLessThan(byId.get("income:b")!.y);
    expect(byId.get("pocket:b")!.y).toBeLessThan(byId.get("pocket:a")!.y);
  });

  it("uses routed value for node height and separates link attachment points", () => {
    const layout = layoutMoneyFlow(nodes, [
      link("large", "income:a", "pocket:a", "5000"),
      link("small", "income:a", "pocket:b", "500"),
    ]);
    const income = layout.nodes.find((node) => node.id === "income:a")!;
    const routes = layout.links.filter((route) => route.source === "income:a");

    expect(income.height).toBeGreaterThan(44);
    expect(new Set(routes.map((route) => route.sourceY)).size).toBe(2);
    expect(routes.find((route) => route.id === "large")!.strokeWidth)
      .toBeGreaterThan(routes.find((route) => route.id === "small")!.strokeWidth);
  });

  it("orders income sources and outflow categories from largest to smallest", () => {
    const valueNodes: FlowNode[] = [
      ...nodes,
      { id: "category:large", label: "Large expense", kind: "category" },
      { id: "category:small", label: "Small expense", kind: "category" },
    ];
    const layout = layoutMoneyFlow(valueNodes, [
      link("large-income", "income:a", "pocket:a", "5000"),
      link("small-income", "income:b", "pocket:b", "500"),
      link("large-expense", "pocket:a", "category:large", "3000"),
      link("small-expense", "pocket:b", "category:small", "300"),
    ]);
    const byId = new Map(layout.nodes.map((node) => [node.id, node]));

    expect(byId.get("income:a")!.y).toBeLessThan(byId.get("income:b")!.y);
    expect(byId.get("category:large")!.y).toBeLessThan(byId.get("category:small")!.y);
  });
});
