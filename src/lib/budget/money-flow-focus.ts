import type { FlowLink } from "@/lib/budget/money-flow";

export function focusMoneyFlowLinks(
  links: FlowLink[],
  selectedNodeIds: string[],
  currency = "all",
): FlowLink[] {
  const currencyLinks = currency === "all"
    ? links
    : links.filter((link) => link.nativeCurrency === currency);
  const seeds = selectedNodeIds.filter((id) => id !== "all");
  if (seeds.length === 0) return currencyLinks;

  const focusedSets = seeds.map((seed) => {
    const includedLinkIds = new Set<string>();
    walk(seed, "upstream", includedLinkIds);
    walk(seed, "downstream", includedLinkIds);
    return includedLinkIds;
  });
  return currencyLinks.filter((link) => focusedSets.every((focused) => focused.has(link.id)));

  function walk(initialId: string, direction: "upstream" | "downstream", includedLinkIds: Set<string>) {
    const visited = new Set([initialId]);
    const queue = [initialId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const link of currencyLinks) {
        const touchesCurrent = direction === "upstream"
          ? link.target === current
          : link.source === current;
        if (!touchesCurrent) continue;
        includedLinkIds.add(link.id);
        const next = direction === "upstream" ? link.source : link.target;
        if (visited.has(next)) continue;
        visited.add(next);
        queue.push(next);
      }
    }
  }
}
