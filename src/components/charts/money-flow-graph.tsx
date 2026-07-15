"use client";

import { Download, Minus, Plus, Printer, RotateCcw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import type { AccountFlowTotals, FlowLink, FlowNode } from "@/lib/budget/money-flow";
import { collapseToBudgetFlow } from "@/lib/budget/money-flow-budget-view";
import { buildAccountMinimumFlow } from "@/lib/budget/money-flow-reverse";
import { focusMoneyFlowLinks } from "@/lib/budget/money-flow-focus";
import { layoutMoneyFlow } from "@/lib/budget/money-flow-layout";
import {
  buildFlowColorMap,
  flowLinkDasharray,
  flowRouteColor,
  flowRouteKey,
  flowRouteLabel,
} from "@/lib/budget/money-flow-presentation";
import { formatMoney } from "@/lib/money/decimal";
import { RECONCILIATION_TOLERANCE } from "@/lib/money/rounding";
import {
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const ZOOM_STEP = 1.25;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

interface MoneyFlowGraphProps {
  nodes: FlowNode[];
  links: FlowLink[];
  reportingCurrency: string;
  /** Per-account in/out totals; when present, account nodes show them plus an unallocated marker. */
  accountTotals?: AccountFlowTotals[];
}

const routeOrder: Record<FlowLink["routeKind"], number> = {
  income: 0,
  expense: 1,
  saving: 2,
  investment: 3,
  retirement: 4,
  transfer: 5,
};

export function MoneyFlowGraph({ nodes, links, reportingCurrency, accountTotals }: MoneyFlowGraphProps) {
  const totalsByPocketNode = useMemo(
    () => new Map((accountTotals ?? []).map((entry) => [`pocket:${entry.pocketId}`, entry])),
    [accountTotals],
  );
  const [account, setAccount] = useState("all");
  const [category, setCategory] = useState("all");
  const [currency, setCurrency] = useState("all");
  const [viewMode, setViewMode] = useState<"full" | "budget" | "reverse">("full");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; startPan: { x: number; y: number } } | null>(null);
  const reverse = useMemo(
    () => buildAccountMinimumFlow(nodes, links, reportingCurrency),
    [nodes, links, reportingCurrency],
  );
  const base = useMemo(() => {
    if (viewMode === "budget") return collapseToBudgetFlow(nodes, links, reportingCurrency);
    if (viewMode === "reverse") return { nodes: reverse.nodes, links: reverse.links };
    return { nodes, links };
  }, [viewMode, nodes, links, reportingCurrency, reverse]);
  const filteredLinks = useMemo(
    () => focusMoneyFlowLinks(base.links, [viewMode === "budget" ? "all" : account, category], currency),
    [account, category, currency, base.links, viewMode],
  );
  const linkedNodeIds = new Set(filteredLinks.flatMap((link) => [link.source, link.target]));
  const filteredNodes = base.nodes.filter((node) => linkedNodeIds.has(node.id));
  const nodeLabelById = useMemo(() => new Map(base.nodes.map((node) => [node.id, node.label])), [base.nodes]);
  const layout = useMemo(
    () => layoutMoneyFlow(filteredNodes, filteredLinks),
    [filteredLinks, filteredNodes],
  );
  const colorByRoute = useMemo(() => buildFlowColorMap(links), [links]);
  const routeColor = (routeKind: FlowLink["routeKind"], colorKey: string) =>
    colorByRoute.get(flowRouteKey(routeKind, colorKey)) ?? flowRouteColor(routeKind, colorKey);
  const [highlightedKey, setHighlightedKey] = useState<string | null>(null);
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

  const viewWidth = layout.width / zoom;
  const viewHeight = layout.height / zoom;
  const maxPanX = Math.max(0, layout.width - viewWidth);
  const maxPanY = Math.max(0, layout.height - viewHeight);
  const clampedPan = { x: clamp(pan.x, 0, maxPanX), y: clamp(pan.y, 0, maxPanY) };
  const viewBox = `${clampedPan.x} ${clampedPan.y} ${viewWidth} ${viewHeight}`;
  const panStep = 60 / zoom;

  function zoomIn() {
    setZoom((current) => clamp(current * ZOOM_STEP, MIN_ZOOM, MAX_ZOOM));
  }
  function zoomOut() {
    setZoom((current) => {
      const next = clamp(current / ZOOM_STEP, MIN_ZOOM, MAX_ZOOM);
      if (next === MIN_ZOOM) setPan({ x: 0, y: 0 });
      return next;
    });
  }
  function resetView() {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }
  function handlePointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    if (zoom <= MIN_ZOOM) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, startPan: clampedPan };
  }
  function handlePointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const dx = ((event.clientX - drag.startX) * viewWidth) / rect.width;
    const dy = ((event.clientY - drag.startY) * viewHeight) / rect.height;
    setPan({
      x: clamp(drag.startPan.x - dx, 0, maxPanX),
      y: clamp(drag.startPan.y - dy, 0, maxPanY),
    });
  }
  function handlePointerUp(event: ReactPointerEvent<SVGSVGElement>) {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  }
  function handleKeyDown(event: ReactKeyboardEvent<SVGSVGElement>) {
    if (event.key === "ArrowLeft") { setPan((p) => ({ ...p, x: clamp(p.x - panStep, 0, maxPanX) })); event.preventDefault(); }
    else if (event.key === "ArrowRight") { setPan((p) => ({ ...p, x: clamp(p.x + panStep, 0, maxPanX) })); event.preventDefault(); }
    else if (event.key === "ArrowUp") { setPan((p) => ({ ...p, y: clamp(p.y - panStep, 0, maxPanY) })); event.preventDefault(); }
    else if (event.key === "ArrowDown") { setPan((p) => ({ ...p, y: clamp(p.y + panStep, 0, maxPanY) })); event.preventDefault(); }
    else if (event.key === "+" || event.key === "=") { zoomIn(); event.preventDefault(); }
    else if (event.key === "-" || event.key === "_") { zoomOut(); event.preventDefault(); }
    else if (event.key === "0") { resetView(); event.preventDefault(); }
  }
  function handleExportSvg() {
    const svg = svgRef.current;
    if (!svg) return;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("viewBox", `0 0 ${layout.width} ${layout.height}`);
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const serialized = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([`<?xml version="1.0" standalone="no"?>\r\n${serialized}`], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = `money-flow-${viewMode}.svg`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div role="region" aria-label="Planned monthly money-flow graph">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Graph view">
          <span className="text-xs font-medium text-subdued">View:</span>
          {([["full", "Full flow"], ["budget", "Pure budget"], ["reverse", "Account minimums"]] as const).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              aria-pressed={viewMode === mode}
              onClick={() => setViewMode(mode)}
              className={`rounded px-3 py-1.5 text-sm font-medium transition ${viewMode === mode ? "bg-gradient-to-br from-brand-violet to-brand-teal text-white" : "bg-muted text-subdued hover:text-foreground"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1" role="group" aria-label="Zoom, print, and export">
          <button
            aria-label="Zoom out"
            className="grid size-8 place-items-center rounded border bg-muted text-subdued transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            disabled={zoom <= MIN_ZOOM}
            onClick={zoomOut}
            type="button"
          >
            <Minus className="size-4" strokeWidth={1.5} />
          </button>
          <span className="w-10 text-center text-xs tabular-nums text-subdued">{Math.round(zoom * 100)}%</span>
          <button
            aria-label="Zoom in"
            className="grid size-8 place-items-center rounded border bg-muted text-subdued transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            disabled={zoom >= MAX_ZOOM}
            onClick={zoomIn}
            type="button"
          >
            <Plus className="size-4" strokeWidth={1.5} />
          </button>
          <button
            aria-label="Reset zoom and pan"
            className="grid size-8 place-items-center rounded border bg-muted text-subdued transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            disabled={zoom === MIN_ZOOM && clampedPan.x === 0 && clampedPan.y === 0}
            onClick={resetView}
            type="button"
          >
            <RotateCcw className="size-4" strokeWidth={1.5} />
          </button>
          <span className="mx-1 h-5 w-px bg-border" />
          <button
            aria-label="Print this graph"
            className="grid size-8 place-items-center rounded border bg-muted text-subdued transition hover:text-foreground"
            onClick={() => window.print()}
            type="button"
          >
            <Printer className="size-4" strokeWidth={1.5} />
          </button>
          <button
            aria-label="Export this graph as SVG"
            className="grid size-8 place-items-center rounded border bg-muted text-subdued transition hover:text-foreground"
            onClick={handleExportSvg}
            type="button"
          >
            <Download className="size-4" strokeWidth={1.5} />
          </button>
        </div>
      </div>
      <p className="mb-4 text-xs text-subdued print:hidden">{viewMode === "budget" ? "Income → category → item, accounts excluded." : viewMode === "reverse" ? "Budget items summed by account and category; account → category → item." : "Income, account routing, categories, and items."}</p>
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 print:hidden">
        {viewMode !== "budget" ? (
          <Filter label="Account" value={account} onChange={setAccount}>
            <option value="all">All accounts</option>
            {base.nodes.filter((node) => node.kind === "account").map((node) => <option key={node.id} value={node.id}>{node.label}</option>)}
          </Filter>
        ) : null}
        <Filter label="Category" value={category} onChange={setCategory}>
          <option value="all">All categories</option>
          {nodes.filter((node) => node.kind === "category").map((node) => <option key={node.id} value={node.id}>{node.label}</option>)}
        </Filter>
        <Filter label="Native currency" value={currency} onChange={setCurrency}>
          <option value="all">All currencies</option>
          {[...new Set(links.map((link) => link.nativeCurrency))].sort().map((value) => <option key={value}>{value}</option>)}
        </Filter>
      </div>
      {viewMode === "reverse" ? (
        <div className="mb-4 grid gap-4 md:grid-cols-2">
          <div className="rounded border bg-muted/20 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-subdued">Minimum per account</p>
            <table className="w-full text-sm">
              <tbody>
                {reverse.accountMinimums.map((entry) => (
                  <tr key={entry.id} className="border-t first:border-t-0">
                    <td className="py-1">{entry.label}</td>
                    <td className="py-1 text-right font-medium tabular-nums">{formatMoney(entry.amount, reportingCurrency)}</td>
                  </tr>
                ))}
                {reverse.accountMinimums.length === 0 ? <tr><td className="py-1 text-subdued">No funded budget items.</td></tr> : null}
              </tbody>
            </table>
          </div>
          <div className="rounded border bg-muted/20 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-subdued">Total per category</p>
            <table className="w-full text-sm">
              <tbody>
                {reverse.categoryTotals.map((entry) => (
                  <tr key={entry.id} className="border-t first:border-t-0">
                    <td className="py-1">{entry.label}</td>
                    <td className="py-1 text-right font-medium tabular-nums">{formatMoney(entry.amount, reportingCurrency)}</td>
                  </tr>
                ))}
                {reverse.categoryTotals.length === 0 ? <tr><td className="py-1 text-subdued">No funded budget items.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
      <div className="mb-4 flex flex-wrap gap-x-5 gap-y-2 rounded border bg-muted/20 px-3 py-2" aria-label="Money-flow legend" role="group">
        {legendEntries.map((entry) => (
          <button
            aria-pressed={highlightedKey === entry.key}
            className={`flex items-center gap-2 rounded px-1.5 py-0.5 text-xs transition ${highlightedKey === entry.key ? "bg-muted ring-1 ring-inset ring-brand-teal" : "hover:bg-muted/60"}`}
            key={entry.key}
            onClick={() => setHighlightedKey((current) => (current === entry.key ? null : entry.key))}
            title="Click to isolate this route"
            type="button"
          >
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
          </button>
        ))}
      </div>
      <p className="mb-3 text-xs text-subdued">
        Normalized monthly baseline. Income sources follow their receiving-account lanes; categories and budget items are ordered by value. Line width represents monthly amount.
        Long dashes mark internal transfers; short dashes mark provisions (annual bills saved monthly). An amber dot on an account means it still has an unallocated remainder (±{RECONCILIATION_TOLERANCE} tolerance).
        {zoom > MIN_ZOOM ? " Drag to pan, or use the arrow keys when the graph is focused." : " Use the zoom controls above, or click a legend entry to isolate that route."}
      </p>
      {filteredLinks.length === 0 ? (
        <div className="grid min-h-48 place-items-center rounded border border-dashed bg-muted/20 p-8 text-center text-sm text-subdued">
          No planned flows match the selected filters.
        </div>
      ) : (
      <div className="overflow-x-auto">
      <svg
        aria-describedby="money-flow-description"
        className={`min-w-[900px] w-full outline-none print:min-w-0 ${zoom > MIN_ZOOM ? "cursor-grab active:cursor-grabbing" : ""}`}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        ref={svgRef}
        role="img"
        tabIndex={0}
        viewBox={viewBox}
      >
        <desc id="money-flow-description">
          Planned monthly income, account routing, categories, and budget items in{" "}
          {reportingCurrency}. Income sources follow receiving-account lanes and outflows are ordered from largest to smallest.
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
          const linkKey = flowRouteKey(link.routeKind, link.colorKey);
          const dimmed = highlightedKey !== null && highlightedKey !== linkKey;
          return (
            <g className="group" key={link.id} tabIndex={0}>
              <title>
                {`${routeLabel} · ${link.description}${link.provision ? " (provision)" : ""}: ${formatMoney(link.amount, reportingCurrency)}`}
              </title>
              <path
                d={link.path}
                fill="none"
                opacity={dimmed ? 0.12 : link.internalTransfer ? 0.55 : 0.72}
                stroke={routeColor(link.routeKind, link.colorKey)}
                strokeDasharray={flowLinkDasharray(link.routeKind, link.provision)}
                strokeLinecap="round"
                strokeWidth={link.strokeWidth}
              />
            </g>
          );
        })}
        {layout.nodes.map((node) => {
          const isSpending = node.kind === "account" && node.spending === true;
          const nodeColor = isSpending
            ? "#00D1C7"
            : node.routeKind && node.colorKey
            ? routeColor(node.routeKind, node.colorKey)
            : "var(--border)";
          const accountFlow = node.kind === "account" ? totalsByPocketNode.get(node.id) : undefined;
          return (
            <a href={nodeHref(node.kind)} key={node.visualId}>
            <g tabIndex={0}>
              <title>
                {`${node.label}, ${node.kind}${node.provision ? " (provision)" : ""}, ${formatMoney(String(node.value), reportingCurrency)}${
                  accountFlow
                    ? accountFlow.fullyAllocated
                      ? ". Fully allocated: no unallocated remainder within tolerance."
                      : `. Unallocated remainder: ${formatMoney(accountFlow.residual, reportingCurrency)}.`
                    : ""
                }`}
              </title>
              <rect
                fill="var(--muted)"
                height={node.height}
                rx="6"
                stroke={nodeColor}
                strokeWidth={isSpending ? "2.5" : node.routeKind ? "1.5" : "1"}
                width={node.width}
                x={node.x}
                y={node.y - node.height / 2}
              />
              {isSpending ? (
                <circle cx={node.x + node.width - 10} cy={node.y - node.height / 2 + 10} fill="#00D1C7" r="4" />
              ) : null}
              {accountFlow && !accountFlow.fullyAllocated ? (
                <circle cx={node.x + 10} cy={node.y - node.height / 2 + 10} fill="var(--warning)" r="4" />
              ) : null}
              <text
                fill="var(--foreground)"
                fontSize="12"
                fontWeight="600"
                textAnchor="middle"
                x={node.x + node.width / 2}
                y={accountFlow ? node.y - 12 : node.y - 4}
              >
                {truncate(node.label, 21)}
              </text>
              <text
                fill="var(--subdued)"
                fontSize="10"
                textAnchor="middle"
                x={node.x + node.width / 2}
                y={accountFlow ? node.y + 4 : node.y + 14}
              >
                {formatMoney(String(node.value), reportingCurrency)}
              </text>
              {accountFlow ? (
                <text
                  fill="var(--subdued)"
                  fontSize="9"
                  textAnchor="middle"
                  x={node.x + node.width / 2}
                  y={node.y + 18}
                >
                  {`in ${formatMoney(accountFlow.inflow, reportingCurrency)} · out ${formatMoney(accountFlow.outflow, reportingCurrency)}`}
                </text>
              ) : null}
            </g>
            </a>
          );
        })}
      </svg>
      </div>
      )}
      {viewMode !== "reverse" ? (
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-subdued">Accessible table</p>
          <DataTable
            caption={`Planned money flow edges, ${viewMode === "budget" ? "pure-budget view" : "full-flow view"}, matching the filters and view above`}
            emptyDescription="Adjust the filters above, or add income allocations and funded budget items."
            emptyTitle="No planned flows match the current view"
            headers={["From", "To", "Route", "Monthly amount", "Treatment"]}
            rows={filteredLinks.map((link) => [
              nodeLabelById.get(link.source) ?? link.source,
              nodeLabelById.get(link.target) ?? link.target,
              link.description,
              <span className="tabular-nums" key={link.id}>{formatMoney(link.amount, reportingCurrency)}</span>,
              link.internalTransfer ? <Badge key={link.id}>Internal transfer</Badge> : flowRouteLabel(link.routeKind),
            ])}
          />
        </div>
      ) : null}
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
