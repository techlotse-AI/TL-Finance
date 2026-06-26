import { money, serializeMoney } from "@/lib/money/decimal";
import type { FlowLink, FlowNode } from "@/lib/budget/money-flow";

/**
 * Issue #30 "pure budget" view: collapse the money-flow graph to income →
 * category → item, dropping every account and transfer node. Income sources are
 * connected to budget categories by their share of total income (each category's
 * total is split across income sources in proportion to each source's income),
 * which is deterministic and reconciles: the links into a category always sum to
 * that category's budgeted total. Category → item links are preserved as-is.
 *
 * Pure function — no Prisma, no layout — so it is unit-tested directly.
 */
export function collapseToBudgetFlow(
  nodes: FlowNode[],
  links: FlowLink[],
  reportingCurrency: string,
): { nodes: FlowNode[]; links: FlowLink[] } {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const isKind = (id: string, kind: FlowNode["kind"]) => nodeById.get(id)?.kind === kind;

  // Income source outflow (its allocated, normalized monthly income).
  const incomeOut = new Map<string, ReturnType<typeof money>>();
  for (const link of links) {
    if (isKind(link.source, "income")) {
      incomeOut.set(link.source, (incomeOut.get(link.source) ?? money(0)).plus(money(link.amount)));
    }
  }
  const totalIncome = [...incomeOut.values()].reduce((sum, value) => sum.plus(value), money(0));

  // Keep category -> item links and tally each category's budgeted total.
  const categoryItemLinks: FlowLink[] = [];
  const categoryTotal = new Map<string, ReturnType<typeof money>>();
  for (const link of links) {
    if (isKind(link.source, "category") && isKind(link.target, "item")) {
      categoryItemLinks.push(link);
      categoryTotal.set(link.source, (categoryTotal.get(link.source) ?? money(0)).plus(money(link.amount)));
    }
  }

  const incomeCategoryLinks: FlowLink[] = [];
  if (totalIncome.greaterThan(0)) {
    for (const [incomeId, sourceIncome] of incomeOut) {
      if (sourceIncome.isZero()) continue;
      const share = sourceIncome.dividedBy(totalIncome);
      for (const [categoryId, total] of categoryTotal) {
        if (total.isZero()) continue;
        const amount = total.times(share);
        if (amount.isZero()) continue;
        const category = nodeById.get(categoryId);
        const routeKind = category?.routeKind ?? "expense";
        incomeCategoryLinks.push({
          id: `budget-income-category:${incomeId}:${categoryId}`,
          source: incomeId,
          target: categoryId,
          amount: serializeMoney(amount),
          nativeAmount: serializeMoney(amount),
          nativeCurrency: reportingCurrency,
          description: category?.label ?? "Budget category",
          internalTransfer: false,
          routeKind,
          colorKey: category?.colorKey ?? `${routeKind}:${categoryId}`,
        });
      }
    }
  }

  const keptLinks = [...incomeCategoryLinks, ...categoryItemLinks];
  const usedNodeIds = new Set(keptLinks.flatMap((link) => [link.source, link.target]));
  const keptNodes = nodes.filter((node) => node.kind !== "account" && usedNodeIds.has(node.id));

  return { nodes: keptNodes, links: keptLinks };
}
