"use client";

import type { FlowLink, FlowNode } from "@/lib/budget/money-flow";
import { formatMoney, money } from "@/lib/money/decimal";
import { useMemo, useState } from "react";

interface MoneyFlowGraphProps {
  nodes: FlowNode[];
  links: FlowLink[];
  reportingCurrency: string;
}

const columnByKind = {
  income: 0,
  account: 1,
  category: 2,
  item: 3,
} as const;

export function MoneyFlowGraph({ nodes, links, reportingCurrency }: MoneyFlowGraphProps) {
  const [account, setAccount] = useState("all");
  const [category, setCategory] = useState("all");
  const [currency, setCurrency] = useState("all");
  const [month, setMonth] = useState("baseline");
  const filteredLinks = useMemo(() => links.filter((link) =>
    (account === "all" || link.source === account || link.target === account) &&
    (category === "all" || link.source === category || link.target === category) &&
    (currency === "all" || link.nativeCurrency === currency)
  ), [account, category, currency, links]);
  const linkedNodeIds = new Set(filteredLinks.flatMap((link) => [link.source, link.target]));
  const filteredNodes = nodes.filter((node) => linkedNodeIds.has(node.id));
  const width = 1160;
  const height = 480;
  const positions = new Map<string, { x: number; y: number }>();
  const grouped = filteredNodes.reduce<Partial<Record<FlowNode["kind"], FlowNode[]>>>((result, node) => {
    result[node.kind] = [...(result[node.kind] ?? []), node];
    return result;
  }, {});

  for (const [kind, column] of Object.entries(columnByKind)) {
    const columnNodes = grouped[kind as FlowNode["kind"]] ?? [];
    const gap = height / (columnNodes.length + 1);
    columnNodes.forEach((node, index) => {
      positions.set(node.id, { x: 40 + column * 310, y: gap * (index + 1) });
    });
  }

  const maxAmount = filteredLinks.reduce(
    (largest, link) => Math.max(largest, money(link.amount).toNumber()),
    1,
  );

  if (nodes.length === 0 || links.length === 0) {
    return (
      <div className="grid min-h-64 place-items-center rounded border border-dashed bg-muted/20 p-8 text-center">
        <div>
          <p className="font-medium">No planned flow yet</p>
          <p className="mt-1 text-sm text-subdued">
            Add income allocations and funded budget items to build the graph.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div role="region" aria-label="Planned monthly money-flow graph">
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Filter label="Month context" value={month} onChange={setMonth}>
          <option value="baseline">Normalized monthly baseline</option>
          {Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={String(index + 1)}>{new Date(2026, index).toLocaleString("en", { month: "long" })}</option>)}
        </Filter>
        <Filter label="Account" value={account} onChange={setAccount}>
          <option value="all">All accounts</option>
          {nodes.filter((node) => node.kind === "account").map((node) => <option key={node.id} value={node.id}>{node.label}</option>)}
        </Filter>
        <Filter label="Category" value={category} onChange={setCategory}>
          <option value="all">All categories</option>
          {nodes.filter((node) => node.kind === "category").map((node) => <option key={node.id} value={node.id}>{node.label}</option>)}
        </Filter>
        <Filter label="Native currency" value={currency} onChange={setCurrency}>
          <option value="all">All currencies</option>
          {[...new Set(links.map((link) => link.nativeCurrency))].sort().map((value) => <option key={value}>{value}</option>)}
        </Filter>
      </div>
      {month !== "baseline" ? <p className="mb-3 text-xs text-subdued">Recurring amounts remain normalized monthly provisions; one-time rows are excluded from this baseline graph.</p> : null}
      <div className="overflow-x-auto">
      <svg
        aria-describedby="money-flow-description"
        className="min-w-[900px]"
        role="img"
        viewBox={`0 0 ${width} ${height}`}
      >
        <desc id="money-flow-description">
          Planned monthly income, account routing, categories, and budget items in{" "}
          {reportingCurrency}.
        </desc>
        {filteredLinks.map((link) => {
          const source = positions.get(link.source);
          const target = positions.get(link.target);
          if (!source || !target) return null;
          const strokeWidth = 2 + (money(link.amount).toNumber() / maxAmount) * 22;
          const midX = (source.x + target.x) / 2;
          const path = `M ${source.x + 150} ${source.y} C ${midX} ${source.y}, ${midX} ${target.y}, ${target.x} ${target.y}`;

          return (
            <g className="group" key={link.id} tabIndex={0}>
              <title>
                {link.description}: {formatMoney(link.amount, reportingCurrency)}
                {link.internalTransfer ? " (internal transfer)" : ""}
              </title>
              <path
                d={path}
                fill="none"
                opacity={link.internalTransfer ? 0.4 : 0.58}
                stroke={link.internalTransfer ? "var(--brand-violet)" : "var(--brand-teal)"}
                strokeWidth={strokeWidth}
              />
            </g>
          );
        })}
        {filteredNodes.map((node) => {
          const position = positions.get(node.id);
          if (!position) return null;

          return (
            <a href={nodeHref(node.kind)} key={node.id}>
            <g tabIndex={0}>
              <title>
                {node.label}, {node.kind}
              </title>
              <rect
                fill="var(--muted)"
                height="44"
                rx="6"
                stroke="var(--border)"
                width="150"
                x={position.x}
                y={position.y - 22}
              />
              <text
                fill="var(--foreground)"
                fontSize="12"
                fontWeight="600"
                textAnchor="middle"
                x={position.x + 75}
                y={position.y + 4}
              >
                {truncate(node.label, 21)}
              </text>
            </g>
            </a>
          );
        })}
      </svg>
      </div>
    </div>
  );
}

function truncate(value: string, length: number): string {
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}

function nodeHref(kind: FlowNode["kind"]): string {
  if (kind === "income") return "/income";
  if (kind === "account") return "/accounts";
  if (kind === "item") return "/budget";
  return "/settings";
}

function Filter({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return <label className="text-xs font-medium uppercase tracking-wide text-subdued">{label}<select className="mt-1 min-h-9 w-full rounded border bg-muted px-2 text-sm normal-case tracking-normal text-foreground" onChange={(event) => onChange(event.target.value)} value={value}>{children}</select></label>;
}
