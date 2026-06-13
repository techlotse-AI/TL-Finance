import type { FlowLink, FlowNode } from "@/lib/budget/money-flow";

const NODE_WIDTH = 150;
const MIN_NODE_HEIGHT = 58;
const NODE_PADDING = 12;
const COLUMN_GAP = 80;
const ROW_GAP = 24;
const MARGIN_X = 32;
const MARGIN_Y = 56;

export interface PositionedFlowNode extends FlowNode {
  visualId: string;
  rank: number;
  x: number;
  y: number;
  width: number;
  height: number;
  value: number;
}

export interface PositionedFlowLink extends FlowLink {
  sourceVisualId: string;
  targetVisualId: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  strokeWidth: number;
  path: string;
}

export interface MoneyFlowLayout {
  width: number;
  height: number;
  nodes: PositionedFlowNode[];
  links: PositionedFlowLink[];
  columns: Array<{ rank: number; x: number; label: string }>;
}

interface VisualLink extends FlowLink {
  sourceVisualId: string;
  targetVisualId: string;
  value: number;
  strokeWidth: number;
}

interface MutableVisualNode extends FlowNode {
  visualId: string;
  rank: number;
  x: number;
  y: number;
  width: number;
  height: number;
  stableOrder: number;
  value: number;
}

export function layoutMoneyFlow(
  nodes: FlowNode[],
  links: FlowLink[],
  minimumWidth = 1160,
  minimumHeight = 480,
): MoneyFlowLayout {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const canonicalRanks = assignCanonicalRanks(nodes, links, nodeById);
  const maxValue = links.reduce((largest, link) => Math.max(largest, numericAmount(link.amount)), 1);
  const visualNodes = new Map<string, MutableVisualNode>();
  const visualLinks: VisualLink[] = [];

  function ensureVisualNode(node: FlowNode, rank: number): MutableVisualNode {
    const visualId = `${node.id}@${rank}`;
    const existing = visualNodes.get(visualId);
    if (existing) return existing;

    const created: MutableVisualNode = {
      ...node,
      visualId,
      rank,
      x: 0,
      y: 0,
      width: NODE_WIDTH,
      height: MIN_NODE_HEIGHT,
      stableOrder: visualNodes.size,
      value: 0,
    };
    visualNodes.set(visualId, created);
    return created;
  }

  for (const link of links) {
    const sourceNode = nodeById.get(link.source);
    const targetNode = nodeById.get(link.target);
    if (!sourceNode || !targetNode) continue;

    const sourceRank = canonicalRanks.get(sourceNode.id)!;
    const canonicalTargetRank = canonicalRanks.get(targetNode.id)!;
    const targetRank = canonicalTargetRank > sourceRank ? canonicalTargetRank : sourceRank + 1;
    const source = ensureVisualNode(sourceNode, sourceRank);
    const target = ensureVisualNode(targetNode, targetRank);
    const value = numericAmount(link.amount);

    visualLinks.push({
      ...link,
      sourceVisualId: source.visualId,
      targetVisualId: target.visualId,
      value,
      strokeWidth: 2 + Math.sqrt(value / maxValue) * 22,
    });
  }

  const nodeList = [...visualNodes.values()];
  const maxRank = nodeList.reduce((largest, node) => Math.max(largest, node.rank), 0);
  const columns = Array.from({ length: maxRank + 1 }, () => [] as MutableVisualNode[]);
  for (const node of nodeList) columns[node.rank].push(node);

  updateNodeMetrics(nodeList, visualLinks);
  sortValueColumns(columns);
  optimizeColumnOrder(columns, visualLinks);
  orderIncomeLanes(columns, visualLinks);
  optimizeColumnOrder(columns, visualLinks);
  orderIncomeLanes(columns, visualLinks);

  const requiredHeight = Math.max(
    ...columns.map((column) =>
      column.reduce((total, node) => total + node.height, 0) +
      Math.max(0, column.length - 1) * ROW_GAP +
      MARGIN_Y * 2
    ),
    minimumHeight,
  );
  const requiredWidth = Math.max(
    minimumWidth,
    MARGIN_X * 2 + (maxRank + 1) * NODE_WIDTH + maxRank * COLUMN_GAP,
  );
  const columnStep = maxRank > 0
    ? (requiredWidth - MARGIN_X * 2 - NODE_WIDTH) / maxRank
    : 0;

  for (const [rank, column] of columns.entries()) {
    const contentHeight =
      column.reduce((total, node) => total + node.height, 0) +
      Math.max(0, column.length - 1) * ROW_GAP;
    let top = (requiredHeight - contentHeight) / 2;

    for (const node of column) {
      node.x = MARGIN_X + rank * columnStep;
      node.y = top + node.height / 2;
      top += node.height + ROW_GAP;
    }
  }

  relaxNodePositions(columns, visualLinks, requiredHeight);
  const positionedLinks = positionLinks(visualLinks, visualNodes);

  return {
    width: requiredWidth,
    height: requiredHeight,
    nodes: nodeList.map((node) => ({
      id: node.id,
      label: node.label,
      kind: node.kind,
      visualId: node.visualId,
      rank: node.rank,
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
      value: node.value,
    })),
    links: positionedLinks,
    columns: columns
      .filter((column) => column.length > 0)
      .map((column) => ({
        rank: column[0].rank,
        x: column[0].x + NODE_WIDTH / 2,
        label: columnLabel(column, visualLinks),
      })),
  };
}

function assignCanonicalRanks(
  nodes: FlowNode[],
  links: FlowLink[],
  nodeById: Map<string, FlowNode>,
) {
  const ranks = new Map<string, number>();
  const accountPredecessors = new Map<string, string[]>();

  for (const node of nodes) {
    ranks.set(node.id, node.kind === "income" ? 0 : node.kind === "account" ? 1 : node.kind === "category" ? 2 : 3);
  }

  for (const link of links) {
    const source = nodeById.get(link.source);
    const target = nodeById.get(link.target);
    if (source?.kind === "account" && target?.kind === "account") {
      accountPredecessors.set(target.id, [...(accountPredecessors.get(target.id) ?? []), source.id]);
    }
  }

  const accountRanks = new Map<string, number>();
  function accountRank(id: string, visiting = new Set<string>()): number {
    const resolved = accountRanks.get(id);
    if (resolved !== undefined) return resolved;
    if (visiting.has(id)) return 1;

    visiting.add(id);
    const rank = Math.max(
      1,
      ...(accountPredecessors.get(id) ?? []).map((predecessor) => accountRank(predecessor, visiting) + 1),
    );
    visiting.delete(id);
    accountRanks.set(id, rank);
    return rank;
  }

  for (const node of nodes) {
    if (node.kind === "account") ranks.set(node.id, accountRank(node.id));
  }

  for (const link of links) {
    const target = nodeById.get(link.target);
    if (target?.kind !== "category") continue;
    ranks.set(target.id, Math.max(ranks.get(target.id) ?? 2, (ranks.get(link.source) ?? 1) + 1));
  }

  for (const link of links) {
    const target = nodeById.get(link.target);
    if (target?.kind !== "item") continue;
    ranks.set(target.id, Math.max(ranks.get(target.id) ?? 3, (ranks.get(link.source) ?? 2) + 1));
  }

  return ranks;
}

function updateNodeMetrics(nodes: MutableVisualNode[], links: VisualLink[]) {
  const incomingWidth = new Map<string, number>();
  const outgoingWidth = new Map<string, number>();
  const incomingValue = new Map<string, number>();
  const outgoingValue = new Map<string, number>();

  for (const link of links) {
    outgoingWidth.set(link.sourceVisualId, (outgoingWidth.get(link.sourceVisualId) ?? 0) + link.strokeWidth);
    incomingWidth.set(link.targetVisualId, (incomingWidth.get(link.targetVisualId) ?? 0) + link.strokeWidth);
    outgoingValue.set(link.sourceVisualId, (outgoingValue.get(link.sourceVisualId) ?? 0) + link.value);
    incomingValue.set(link.targetVisualId, (incomingValue.get(link.targetVisualId) ?? 0) + link.value);
  }

  for (const node of nodes) {
    node.value = Math.max(incomingValue.get(node.visualId) ?? 0, outgoingValue.get(node.visualId) ?? 0);
    node.height = Math.max(
      MIN_NODE_HEIGHT,
      Math.max(incomingWidth.get(node.visualId) ?? 0, outgoingWidth.get(node.visualId) ?? 0) + NODE_PADDING * 2,
    );
  }
}

function sortValueColumns(columns: MutableVisualNode[][]) {
  for (const column of columns) {
    if (!isSemanticOrderColumn(column)) continue;
    column.sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
  }
}

function optimizeColumnOrder(columns: MutableVisualNode[][], links: VisualLink[]) {
  const incoming = relationMap(links, "targetVisualId", "sourceVisualId");
  const outgoing = relationMap(links, "sourceVisualId", "targetVisualId");

  for (let pass = 0; pass < 6; pass += 1) {
    for (let rank = 1; rank < columns.length; rank += 1) {
      if (!isSemanticOrderColumn(columns[rank])) sortByBarycenter(columns[rank], columns, incoming);
    }
    for (let rank = columns.length - 2; rank >= 0; rank -= 1) {
      if (!isSemanticOrderColumn(columns[rank])) sortByBarycenter(columns[rank], columns, outgoing);
    }
  }
}

function isSemanticOrderColumn(column: MutableVisualNode[]) {
  return column.length > 0 && column.every((node) =>
    node.kind === "income" || node.kind === "category" || node.kind === "item"
  );
}

function isFixedPositionColumn(column: MutableVisualNode[]) {
  return column.length > 0 && column.every((node) =>
    node.kind === "category" || node.kind === "item"
  );
}

function orderIncomeLanes(columns: MutableVisualNode[][], links: VisualLink[]) {
  const incomeColumn = columns.find((column) =>
    column.length > 0 && column.every((node) => node.kind === "income")
  );
  if (!incomeColumn) return;

  const directAccountLinks = links.filter((link) => {
    const source = incomeColumn.find((node) => node.visualId === link.sourceVisualId);
    const target = columns.flat().find((node) => node.visualId === link.targetVisualId);
    return source && target?.kind === "account";
  });
  const targetOrder = new Map<string, { index: number; count: number }>();
  for (const column of columns) {
    if (!column.every((node) => node.kind === "account")) continue;
    column.forEach((node, index) => targetOrder.set(node.visualId, { index, count: column.length }));
  }

  const primaryTarget = new Map<string, VisualLink>();
  for (const link of directAccountLinks) {
    const current = primaryTarget.get(link.sourceVisualId);
    if (!current || link.value > current.value) primaryTarget.set(link.sourceVisualId, link);
  }

  const groups = new Map<string, MutableVisualNode[]>();
  const ungrouped: MutableVisualNode[] = [];
  for (const income of incomeColumn) {
    const target = primaryTarget.get(income.visualId)?.targetVisualId;
    if (!target || !targetOrder.has(target)) {
      ungrouped.push(income);
      continue;
    }
    groups.set(target, [...(groups.get(target) ?? []), income]);
  }

  const orderedTargets = [...groups.keys()].sort(
    (a, b) =>
      (targetOrder.get(a)?.index ?? Number.MAX_SAFE_INTEGER) -
      (targetOrder.get(b)?.index ?? Number.MAX_SAFE_INTEGER),
  );
  const orderedIncome = orderedTargets.flatMap((target) => {
    const group = groups.get(target)!;
    const targetPosition = targetOrder.get(target)!;
    const dominantAtBottom = targetPosition.index > (targetPosition.count - 1) / 2;
    return group.sort((a, b) =>
      dominantAtBottom
        ? a.value - b.value || a.label.localeCompare(b.label)
        : b.value - a.value || a.label.localeCompare(b.label)
    );
  });

  incomeColumn.splice(
    0,
    incomeColumn.length,
    ...orderedIncome,
    ...ungrouped.sort((a, b) => b.value - a.value || a.label.localeCompare(b.label)),
  );
}

function relationMap(
  links: VisualLink[],
  key: "sourceVisualId" | "targetVisualId",
  related: "sourceVisualId" | "targetVisualId",
) {
  const result = new Map<string, Array<{ visualId: string; value: number }>>();
  for (const link of links) {
    result.set(link[key], [...(result.get(link[key]) ?? []), { visualId: link[related], value: link.value }]);
  }
  return result;
}

function sortByBarycenter(
  column: MutableVisualNode[],
  columns: MutableVisualNode[][],
  relations: Map<string, Array<{ visualId: string; value: number }>>,
) {
  const order = new Map(columns.flatMap((nodes) => nodes.map((node, index) => [node.visualId, index] as const)));
  column.sort((a, b) => {
    const aCenter = weightedRelatedPosition(a.visualId, relations, order);
    const bCenter = weightedRelatedPosition(b.visualId, relations, order);
    if (aCenter === null && bCenter === null) return a.stableOrder - b.stableOrder;
    if (aCenter === null) return 1;
    if (bCenter === null) return -1;
    return aCenter - bCenter || a.stableOrder - b.stableOrder;
  });
}

function weightedRelatedPosition(
  visualId: string,
  relations: Map<string, Array<{ visualId: string; value: number }>>,
  positions: Map<string, number>,
) {
  const related = relations.get(visualId);
  if (!related?.length) return null;
  const total = related.reduce((sum, relation) => sum + relation.value, 0);
  if (total === 0) return null;
  return related.reduce((sum, relation) => sum + (positions.get(relation.visualId) ?? 0) * relation.value, 0) / total;
}

function relaxNodePositions(columns: MutableVisualNode[][], links: VisualLink[], height: number) {
  const incoming = relationMap(links, "targetVisualId", "sourceVisualId");
  const outgoing = relationMap(links, "sourceVisualId", "targetVisualId");
  const nodes = new Map(columns.flat().map((node) => [node.visualId, node]));
  const incomeNodeIds = new Set(
    columns.flat().filter((node) => node.kind === "income").map((node) => node.visualId),
  );
  const incomeFundedAccountIds = new Set(
    links
      .filter((link) => incomeNodeIds.has(link.sourceVisualId))
      .map((link) => link.targetVisualId),
  );

  for (let pass = 0; pass < 4; pass += 1) {
    for (let rank = 1; rank < columns.length; rank += 1) {
      if (!isFixedPositionColumn(columns[rank])) moveTowardRelations(columns[rank], incoming, nodes, height);
    }
    for (let rank = columns.length - 2; rank >= 0; rank -= 1) {
      if (
        !isFixedPositionColumn(columns[rank]) &&
        !columns[rank].some((node) => incomeFundedAccountIds.has(node.visualId))
      ) {
        moveTowardRelations(columns[rank], outgoing, nodes, height);
      }
    }
  }
}

function moveTowardRelations(
  column: MutableVisualNode[],
  relations: Map<string, Array<{ visualId: string; value: number }>>,
  nodes: Map<string, MutableVisualNode>,
  height: number,
) {
  for (const node of column) {
    const related = relations.get(node.visualId);
    if (!related?.length) continue;
    const total = related.reduce((sum, relation) => sum + relation.value, 0);
    if (total === 0) continue;
    const desired = related.reduce(
      (sum, relation) => sum + (nodes.get(relation.visualId)?.y ?? node.y) * relation.value,
      0,
    ) / total;
    node.y = node.y * 0.35 + desired * 0.65;
  }
  resolveCollisions(column, height);
}

function resolveCollisions(column: MutableVisualNode[], height: number) {
  let nextTop = MARGIN_Y;
  for (const node of column) {
    node.y = Math.max(node.y, nextTop + node.height / 2);
    nextTop = node.y + node.height / 2 + ROW_GAP;
  }

  const overflow = nextTop - ROW_GAP + MARGIN_Y - height;
  if (overflow <= 0) return;

  let nextBottom = height - MARGIN_Y;
  for (let index = column.length - 1; index >= 0; index -= 1) {
    const node = column[index];
    node.y = Math.min(node.y, nextBottom - node.height / 2);
    nextBottom = node.y - node.height / 2 - ROW_GAP;
  }
}

function positionLinks(links: VisualLink[], nodes: Map<string, MutableVisualNode>): PositionedFlowLink[] {
  const sourcePorts = assignPorts(links, nodes, "sourceVisualId", "targetVisualId");
  const targetPorts = assignPorts(links, nodes, "targetVisualId", "sourceVisualId");

  return links.map((link) => {
    const source = nodes.get(link.sourceVisualId)!;
    const target = nodes.get(link.targetVisualId)!;
    const sourceX = source.x + source.width;
    const targetX = target.x;
    const sourceY = sourcePorts.get(link.id) ?? source.y;
    const targetY = targetPorts.get(link.id) ?? target.y;
    const bend = Math.max(40, (targetX - sourceX) / 2);
    const path = `M ${sourceX} ${sourceY} C ${sourceX + bend} ${sourceY}, ${targetX - bend} ${targetY}, ${targetX} ${targetY}`;

    return { ...link, sourceX, sourceY, targetX, targetY, path };
  });
}

function assignPorts(
  links: VisualLink[],
  nodes: Map<string, MutableVisualNode>,
  nodeKey: "sourceVisualId" | "targetVisualId",
  oppositeKey: "sourceVisualId" | "targetVisualId",
) {
  const ports = new Map<string, number>();
  const linksByNode = new Map<string, VisualLink[]>();
  for (const link of links) {
    linksByNode.set(link[nodeKey], [...(linksByNode.get(link[nodeKey]) ?? []), link]);
  }

  for (const [visualId, connectedLinks] of linksByNode) {
    const node = nodes.get(visualId);
    if (!node) continue;
    connectedLinks.sort((a, b) =>
      (nodes.get(a[oppositeKey])?.y ?? 0) - (nodes.get(b[oppositeKey])?.y ?? 0)
    );
    const totalWidth = connectedLinks.reduce((sum, link) => sum + link.strokeWidth, 0);
    let cursor = node.y - totalWidth / 2;
    for (const link of connectedLinks) {
      ports.set(link.id, cursor + link.strokeWidth / 2);
      cursor += link.strokeWidth;
    }
  }

  return ports;
}

function numericAmount(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function columnLabel(column: MutableVisualNode[], links: VisualLink[]) {
  if (column.every((node) => node.kind === "income")) return "Income sources";
  if (column.every((node) => node.kind === "category")) return "Categories";
  if (column.every((node) => node.kind === "item")) return "Budget items";
  if (column.every((node) => node.kind === "account")) {
    if (column[0].rank === 1) return "Accounts";
    const sources = new Set(links.map((link) => link.sourceVisualId));
    return column.some((node) => sources.has(node.visualId)) ? "Routed accounts" : "Destinations";
  }
  return "Flow stage";
}
