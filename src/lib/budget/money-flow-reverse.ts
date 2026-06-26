import { money, serializeMoney } from "@/lib/money/decimal";
import type { FlowLink, FlowNode } from "@/lib/budget/money-flow";

export interface FlowAggregate {
  id: string;
  label: string;
  amount: string;
}

export interface ReverseBudgetFlow {
  nodes: FlowNode[];
  links: FlowLink[];
  /** Minimum monthly amount each paid-from account must cover (sum of its budget items), largest first. */
  accountMinimums: FlowAggregate[];
  /** Total budgeted per category (sum of its items), largest first. */
  categoryTotals: FlowAggregate[];
}

/**
 * "Reverse" money-flow: start from budget items and aggregate them by the
 * account they are paid from and by their category. It drops income and
 * transfers entirely and draws account → category → item, where each
 * account→category edge is summed across the items it funds.
 *
 * This yields, per account, the minimum monthly amount it must hold/receive to
 * cover its budget items, and per category, its total budgeted amount. Pure and
 * deterministic; derived only from the existing flow links (funded items).
 */
export function buildAccountMinimumFlow(
  nodes: FlowNode[],
  links: FlowLink[],
  reportingCurrency: string,
): ReverseBudgetFlow {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const kindOf = (id: string) => nodeById.get(id)?.kind;

  // Sum account -> category payments (the per-item "item-category" links) per pair.
  const pairTotals = new Map<string, ReturnType<typeof money>>();
  const pairMeta = new Map<string, { account: string; category: string; routeKind: FlowLink["routeKind"]; colorKey: string }>();
  const accountTotals = new Map<string, ReturnType<typeof money>>();

  for (const link of links) {
    if (kindOf(link.source) !== "account" || kindOf(link.target) !== "category") continue;
    const key = `${link.source}->${link.target}`;
    pairTotals.set(key, (pairTotals.get(key) ?? money(0)).plus(money(link.amount)));
    pairMeta.set(key, { account: link.source, category: link.target, routeKind: link.routeKind, colorKey: link.colorKey });
    accountTotals.set(link.source, (accountTotals.get(link.source) ?? money(0)).plus(money(link.amount)));
  }

  // Merged account -> category links.
  const accountCategoryLinks: FlowLink[] = [...pairTotals.entries()].map(([key, total]) => {
    const meta = pairMeta.get(key)!;
    return {
      id: `reverse-account-category:${meta.account}:${meta.category}`,
      source: meta.account,
      target: meta.category,
      amount: serializeMoney(total),
      nativeAmount: serializeMoney(total),
      nativeCurrency: reportingCurrency,
      description: nodeById.get(meta.category)?.label ?? "Category",
      internalTransfer: false,
      routeKind: meta.routeKind,
      colorKey: meta.colorKey,
    };
  });

  // Keep category -> item links as-is, and tally category totals.
  const categoryItemLinks: FlowLink[] = [];
  const categoryTotals = new Map<string, ReturnType<typeof money>>();
  for (const link of links) {
    if (kindOf(link.source) !== "category" || kindOf(link.target) !== "item") continue;
    categoryItemLinks.push(link);
    categoryTotals.set(link.source, (categoryTotals.get(link.source) ?? money(0)).plus(money(link.amount)));
  }

  const keptLinks = [...accountCategoryLinks, ...categoryItemLinks];
  const usedNodeIds = new Set(keptLinks.flatMap((link) => [link.source, link.target]));
  const keptNodes = nodes.filter((node) => node.kind !== "income" && usedNodeIds.has(node.id));

  const toAggregates = (totals: Map<string, ReturnType<typeof money>>): FlowAggregate[] =>
    [...totals.entries()]
      .map(([id, amount]) => ({ id, label: nodeById.get(id)?.label ?? id, amount: serializeMoney(amount) }))
      .sort((a, b) => Number(money(b.amount).minus(money(a.amount))) || a.label.localeCompare(b.label));

  return {
    nodes: keptNodes,
    links: keptLinks,
    accountMinimums: toAggregates(accountTotals),
    categoryTotals: toAggregates(categoryTotals),
  };
}
