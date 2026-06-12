"use client";

import type { FlowLink, FlowNode } from "@/lib/budget/money-flow";
import { focusMoneyFlowLinks } from "@/lib/budget/money-flow-focus";
import { layoutMoneyFlow } from "@/lib/budget/money-flow-layout";
import {
  buildFlowColorMap,
  flowRouteColor,
  flowRouteDasharray,
  flowRouteKey,
  flowRouteLabel,
} from "@/lib/budget/money-flow-presentation";
import { formatMoney } from "@/lib/money/decimal";
import { useMemo, useState } from "react";

interface MoneyFlowGraphProps {
  nodes: FlowNode[];
  links: FlowLink[];
  reportingCurrency: string;
}

const routeOrder: Record<FlowLink["routeKind"], number> = {
  income: 0,
  expense: 1,
  saving: 2,
  investment: 3,
  retirement: 4,
  transfer: 5,
};

export function MoneyFlowGraph({ nodes, links, reportingCurrency }: MoneyFlowGraphProps) {
  const [account, setAccount] = useState("all");
  const [category, setCategory] = useState("all");
  const [currency, setCurrency] = useState("all");
  const filteredLinks = useMemo(
    () => focusMoneyFlowLinks(links, [account, category], currency),
    [account, category, currency, links],
  );
  const linkedNodeIds = new Set(filteredLinks.flatMap((link) => [link.source, link.target]));
  const filteredNodes = nodes.filter((node) => linkedNodeIds.has(node.id));
  const layout = useMemo(
    () => layoutMoneyFlow(filteredNodes, filteredLinks),
    [filteredLinks, filteredNodes],
  );
  const colorByRoute = useMemo(() => buildFlowColorMap(links), [links]);
  const routeColor = (routeKind: FlowLink["routeKind"], colorKey: string) =>
    colorByRoute.get(flowRouteKey(routeKind, colorKey)) ?? flowRouteColor(routeKind, colorKey);
  const legendEntries = useMemo(() => {
    const seen = new Set<string>();
    return filteredLinks.flatMap((link) => {
      const key = flowRouteKey(link.routeKind, link.colorKey);
      if (seen.has(key)) return [];
      seen.add(key);
      const semanticNode = layout.nodes.find((node) =>
        node.colorKey === link.colorKey && (node.kind === "income" || node.kind === "category")
      );
      return [{
        key,
        label: semanticNode?.label ?? flowRouteLabel(link.routeKind),
        routeKind: link.routeKind,
        colorKey: link.colorKey,
        value: semanticNode?.value ?? filteredLinks
          .filter((candidate) => flowRouteKey(candidate.routeKind, candidate.colorKey) === key)
          .reduce((total, candidate) => total + Number(candidate.amount), 0),
      }];
    }).sort((a, b) => routeOrder[a.routeKind] - routeOrder[b.routeKind] || b.value - a.value);
  }, [filteredLinks, layout.nodes]);

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
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
      <div className="mb-4 flex flex-wrap gap-x-5 gap-y-2 rounded border bg-muted/20 px-3 py-2" aria-label="Money-flow legend">
        {legendEntries.map((entry) => (
          <div className="flex items-center gap-2 text-xs" key={entry.key}>
            <span
              aria-hidden="true"
              className="w-7 border-t-[3px]"
              style={{
                borderTopColor: routeColor(entry.routeKind, entry.colorKey),
                borderTopStyle: entry.routeKind === "transfer" ? "dashed" : "solid",
              }}
            />
            <span>{entry.label}</span>
            <span className="text-subdued">
              · {flowRouteLabel(entry.routeKind)} · {formatMoney(String(entry.value), reportingCurrency)}
            </span>
          </div>
        ))}
      </div>
      <p className="mb-3 text-xs text-subdued">
        Normalized monthly baseline. Sources, categories, and budget items are ordered by value; line width represents monthly amount.
      </p>
      {filteredLinks.length === 0 ? (
        <div className="grid min-h-48 place-items-center rounded border border-dashed bg-muted/20 p-8 text-center text-sm text-subdued">
          No planned flows match the selected filters.
        </div>
      ) : (
      <div className="overflow-x-auto">
      <svg
        aria-describedby="money-flow-description"
        className="min-w-[900px] w-full"
        role="img"
        viewBox={`0 0 ${layout.width} ${layout.height}`}
      >
        <desc id="money-flow-description">
          Planned monthly income, account routing, categories, and budget items in{" "}
          {reportingCurrency}. Sources and outflows are ordered from largest to smallest.
        </desc>
        {layout.columns.map((column) => (
          <text
            fill="var(--subdued)"
            fontSize="11"
            fontWeight="600"
            key={column.rank}
            letterSpacing="0.08em"
            textAnchor="middle"
            x={column.x}
            y="22"
          >
            {column.label.toUpperCase()}
          </text>
        ))}
        {layout.links.map((link) => {
          const routeLabel = flowRouteLabel(link.routeKind);
          return (
            <g className="group" key={link.id} tabIndex={0}>
              <title>
                {routeLabel} · {link.description}: {formatMoney(link.amount, reportingCurrency)}
              </title>
              <path
                d={link.path}
                fill="none"
                opacity={link.internalTransfer ? 0.55 : 0.72}
                stroke={routeColor(link.routeKind, link.colorKey)}
                strokeDasharray={flowRouteDasharray(link.routeKind)}
                strokeLinecap="round"
                strokeWidth={link.strokeWidth}
              />
            </g>
          );
        })}
        {layout.nodes.map((node) => {
          const nodeColor = node.routeKind && node.colorKey
            ? routeColor(node.routeKind, node.colorKey)
            : "var(--border)";
          return (
            <a href={nodeHref(node.kind)} key={node.visualId}>
            <g tabIndex={0}>
              <title>
                {node.label}, {node.kind}, {formatMoney(String(node.value), reportingCurrency)}
              </title>
              <rect
                fill="var(--muted)"
                height={node.height}
                rx="6"
                stroke={nodeColor}
                strokeWidth={node.routeKind ? "1.5" : "1"}
                width={node.width}
                x={node.x}
                y={node.y - node.height / 2}
              />
              <text
                fill="var(--foreground)"
                fontSize="12"
                fontWeight="600"
                textAnchor="middle"
                x={node.x + node.width / 2}
                y={node.y - 4}
              >
                {truncate(node.label, 21)}
              </text>
              <text
                fill="var(--subdued)"
                fontSize="10"
                textAnchor="middle"
                x={node.x + node.width / 2}
                y={node.y + 14}
              >
                {formatMoney(String(node.value), reportingCurrency)}
              </text>
            </g>
            </a>
          );
        })}
      </svg>
      </div>
      )}
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
