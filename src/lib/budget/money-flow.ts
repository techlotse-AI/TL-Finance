import Decimal from "decimal.js";

import { money, serializeMoney, sumMoney } from "@/lib/money/decimal";
import { RECONCILIATION_TOLERANCE } from "@/lib/money/rounding";

/**
 * Whole-amount ("zero-dollar, not zero-cent") reconciliation tolerance. A
 * residual whose magnitude is within ±{@link RECONCILIATION_TOLERANCE} units is
 * rounding noise and must not raise a warning or break reconciliation.
 */
const TOLERANCE = new Decimal(RECONCILIATION_TOLERANCE);

/** True when a difference/residual is a real discrepancy (beyond ±tolerance). */
function outsideTolerance(value: Decimal): boolean {
  // Whole-amount budget: residuals within ±5 are rounding noise, not warnings.
  return value.abs().greaterThan(TOLERANCE);
}

export type FlowNodeKind = "income" | "account" | "category" | "item";
export type FlowRouteKind = "income" | "transfer" | "expense" | "saving" | "investment" | "retirement";

export interface FlowNode {
  id: string;
  label: string;
  kind: FlowNodeKind;
  routeKind?: FlowRouteKind;
  colorKey?: string;
  /** True when this is a "spending"/"daily" account node (Issue #30). */
  spending?: boolean;
  /** True for a provision item — an annual/periodic bill saved monthly. */
  provision?: boolean;
}

export interface FlowLink {
  id: string;
  source: string;
  target: string;
  amount: string;
  nativeAmount: string;
  nativeCurrency: string;
  description: string;
  internalTransfer: boolean;
  routeKind: FlowRouteKind;
  colorKey: string;
  /** True when this flow funds a provision item (rendered dashed). */
  provision?: boolean;
}

export interface FlowPocket {
  id: string;
  name: string;
  currency: string;
  /** Whether the owning account is classified as a spending/daily account. */
  spending?: boolean;
}

export interface FlowIncomeAllocation {
  pocketId: string;
  amount: string;
}

export interface FlowIncomeSource {
  id: string;
  name: string;
  currency: string;
  monthlyAmount: string;
  allocations: FlowIncomeAllocation[];
}

export interface FlowTransfer {
  id: string;
  name: string;
  currency: string;
  monthlyAmount: string;
  fromPocketId: string;
  toPocketId: string;
}

export interface FlowBudgetItem {
  id: string;
  name: string;
  kind: "expense" | "saving" | "investment" | "retirement";
  categoryId: string;
  categoryName: string;
  currency: string;
  monthlyAmount: string;
  paidFromPocketId?: string;
  paidToPocketId?: string;
  /**
   * True for a provision (sinking-fund) item: an annual or periodic bill saved
   * monthly. Derived by callers from a non-monthly recurrence; rendered dashed.
   */
  provision?: boolean;
}

export interface ExchangeRate {
  currency: string;
  rateToReportingCurrency: string;
}

export interface BuildMoneyFlowInput {
  reportingCurrency: string;
  pockets: FlowPocket[];
  incomeSources: FlowIncomeSource[];
  transfers: FlowTransfer[];
  budgetItems: FlowBudgetItem[];
  exchangeRates?: ExchangeRate[];
  oneTimeIncomeTotal?: string;
  oneTimeUseTotal?: string;
}

export interface MoneyFlowWarning {
  code:
    | "unallocated_income"
    | "overallocated_income"
    | "unallocated_pocket_funds"
    | "overallocated_pocket"
    | "unfunded_budget_item"
    | "stale_exchange_rate";
  message: string;
  resourceId: string;
  amount: string;
}

/** Per-account (pocket) in/out totals for the graph's node badges. */
export interface AccountFlowTotals {
  pocketId: string;
  label: string;
  /** Everything arriving on the graph: income allocations, incoming transfers, contribution destinations. */
  inflow: string;
  /** Everything leaving: outgoing transfers and budget-item funding. */
  outflow: string;
  /** Available funds not yet routed (income + transfers − funding); drives the unallocated flag. */
  residual: string;
  /** True when the residual is within the ±tolerance — the account's "in = out" state. */
  fullyAllocated: boolean;
}

export interface MoneyFlowResult {
  reportingCurrency: string;
  nodes: FlowNode[];
  links: FlowLink[];
  warnings: MoneyFlowWarning[];
  accountTotals: AccountFlowTotals[];
  totals: {
    income: string;
    expenses: string;
    /** Of which: expense items flagged as provisions (annual bills saved monthly). */
    expenseProvisions: string;
    contributions: string;
    /** The contributions split by kind (contributions = savings + investments + retirement). */
    savings: string;
    investments: string;
    retirement: string;
    transfers: string;
    unallocated: string;
    oneTimeIncome: string;
    oneTimeUses: string;
  };
  reconciled: boolean;
}

export function buildMoneyFlow(input: BuildMoneyFlowInput): MoneyFlowResult {
  const nodes = new Map<string, FlowNode>();
  const links: FlowLink[] = [];
  const warnings: MoneyFlowWarning[] = [];
  const pocketAvailable = new Map<string, Decimal>();
  const rateMap = new Map(
    input.exchangeRates?.map((rate) => [rate.currency, money(rate.rateToReportingCurrency)]) ?? [],
  );
  rateMap.set(input.reportingCurrency, new Decimal(1));

  const convert = (value: string, currency: string): Decimal => {
    const rate = rateMap.get(currency);

    if (!rate) {
      throw new Error(`Missing ${currency} to ${input.reportingCurrency} exchange rate.`);
    }

    return money(value).times(rate);
  };

  const pocketInflow = new Map<string, Decimal>();
  const pocketOutflow = new Map<string, Decimal>();

  const addNode = (node: FlowNode) => nodes.set(node.id, node);
  const addPocketAmount = (pocketId: string, amount: Decimal) => {
    pocketAvailable.set(pocketId, (pocketAvailable.get(pocketId) ?? new Decimal(0)).plus(amount));
  };
  const addPocketInflow = (pocketId: string, amount: Decimal) => {
    pocketInflow.set(pocketId, (pocketInflow.get(pocketId) ?? new Decimal(0)).plus(amount));
  };
  const addPocketOutflow = (pocketId: string, amount: Decimal) => {
    pocketOutflow.set(pocketId, (pocketOutflow.get(pocketId) ?? new Decimal(0)).plus(amount));
  };

  for (const pocket of input.pockets) {
    addNode({ id: pocketNodeId(pocket.id), label: pocket.name, kind: "account", spending: pocket.spending });
  }

  for (const source of input.incomeSources) {
    addNode({
      id: incomeNodeId(source.id),
      label: source.name,
      kind: "income",
      routeKind: "income",
      colorKey: `income:${source.id}`,
    });
    const sourceMonthly = convert(source.monthlyAmount, source.currency);
    if (sourceMonthly.isZero()) continue;
    const allocated = sumMoney(
      source.allocations.map((allocation) => convert(allocation.amount, source.currency)),
    );
    const difference = sourceMonthly.minus(allocated);

    if (outsideTolerance(difference)) {
      warnings.push({
        code: difference.isPositive() ? "unallocated_income" : "overallocated_income",
        message: difference.isPositive()
          ? `${source.name} has income without a receiving pocket.`
          : `${source.name} allocations exceed the normalized income amount.`,
        resourceId: source.id,
        amount: serializeMoney(difference.abs()),
      });
    }

    for (const allocation of source.allocations) {
      const reportingAmount = convert(allocation.amount, source.currency);
      addPocketAmount(allocation.pocketId, reportingAmount);
      addPocketInflow(allocation.pocketId, reportingAmount);
      links.push({
        id: `income-allocation:${source.id}:${allocation.pocketId}`,
        source: incomeNodeId(source.id),
        target: pocketNodeId(allocation.pocketId),
        amount: serializeMoney(reportingAmount),
        nativeAmount: serializeMoney(allocation.amount),
        nativeCurrency: source.currency,
        description: "Income allocation",
        internalTransfer: false,
        routeKind: "income",
        colorKey: `income:${source.id}`,
      });
    }
  }

  for (const transfer of input.transfers) {
    const reportingAmount = convert(transfer.monthlyAmount, transfer.currency);
    if (reportingAmount.isZero()) continue;
    addPocketAmount(transfer.fromPocketId, reportingAmount.negated());
    addPocketAmount(transfer.toPocketId, reportingAmount);
    addPocketOutflow(transfer.fromPocketId, reportingAmount);
    addPocketInflow(transfer.toPocketId, reportingAmount);
    links.push({
      id: `transfer:${transfer.id}`,
      source: pocketNodeId(transfer.fromPocketId),
      target: pocketNodeId(transfer.toPocketId),
      amount: serializeMoney(reportingAmount),
      nativeAmount: serializeMoney(transfer.monthlyAmount),
      nativeCurrency: transfer.currency,
      description: transfer.name,
      internalTransfer: true,
      routeKind: "transfer",
      colorKey: "transfer",
    });
  }

  for (const item of input.budgetItems) {
    const reportingAmount = convert(item.monthlyAmount, item.currency);
    if (reportingAmount.isZero()) continue;
    const categoryId = categoryNodeId(item.categoryId);
    const itemId = itemNodeId(item.id);
    const colorKey = `${item.kind}:${item.categoryId}`;
    const provision = item.provision === true;
    addNode({ id: categoryId, label: item.categoryName, kind: "category", routeKind: item.kind, colorKey });
    addNode({ id: itemId, label: item.name, kind: "item", routeKind: item.kind, colorKey, provision });

    if (!item.paidFromPocketId) {
      warnings.push({
        code: "unfunded_budget_item",
        message: `${item.name} has no funding account.`,
        resourceId: item.id,
        amount: serializeMoney(reportingAmount),
      });
      continue;
    }

    addPocketAmount(item.paidFromPocketId, reportingAmount.negated());
    addPocketOutflow(item.paidFromPocketId, reportingAmount);
    links.push({
      id: `item-category:${item.id}`,
      source: pocketNodeId(item.paidFromPocketId),
      target: categoryId,
      amount: serializeMoney(reportingAmount),
      nativeAmount: serializeMoney(item.monthlyAmount),
      nativeCurrency: item.currency,
      description: item.categoryName,
      internalTransfer: false,
      routeKind: item.kind,
      colorKey,
      provision,
    });
    links.push({
      id: `category-item:${item.id}`,
      source: categoryId,
      target: itemId,
      amount: serializeMoney(reportingAmount),
      nativeAmount: serializeMoney(item.monthlyAmount),
      nativeCurrency: item.currency,
      description: item.name,
      internalTransfer: false,
      routeKind: item.kind,
      colorKey,
      provision,
    });

    if (item.kind !== "expense" && item.paidToPocketId) {
      addPocketInflow(item.paidToPocketId, reportingAmount);
      links.push({
        id: `contribution-destination:${item.id}`,
        source: itemId,
        target: pocketNodeId(item.paidToPocketId),
        amount: serializeMoney(reportingAmount),
        nativeAmount: serializeMoney(item.monthlyAmount),
        nativeCurrency: item.currency,
        description: `${item.kind} destination`,
        internalTransfer: false,
        routeKind: item.kind,
        colorKey,
        provision,
      });
    }
  }

  for (const pocket of input.pockets) {
    const remaining = pocketAvailable.get(pocket.id) ?? new Decimal(0);

    if (outsideTolerance(remaining)) {
      warnings.push({
        code: remaining.isPositive() ? "unallocated_pocket_funds" : "overallocated_pocket",
        message: remaining.isPositive()
          ? `${pocket.name} has funds not assigned to a budget item or transfer.`
          : `${pocket.name} routes more money than it receives.`,
        resourceId: pocket.id,
        amount: serializeMoney(remaining.abs()),
      });
    }
  }

  const income = sumMoney(
    input.incomeSources.map((source) => convert(source.monthlyAmount, source.currency)),
  );
  const expenses = sumMoney(
    input.budgetItems
      .filter((item) => item.kind === "expense")
      .map((item) => convert(item.monthlyAmount, item.currency)),
  );
  const expenseProvisions = sumMoney(
    input.budgetItems
      .filter((item) => item.kind === "expense" && item.provision === true)
      .map((item) => convert(item.monthlyAmount, item.currency)),
  );
  const sumByKind = (kind: FlowBudgetItem["kind"]) =>
    sumMoney(
      input.budgetItems
        .filter((item) => item.kind === kind)
        .map((item) => convert(item.monthlyAmount, item.currency)),
    );
  const savings = sumByKind("saving");
  const investments = sumByKind("investment");
  const retirement = sumByKind("retirement");
  const contributions = savings.plus(investments).plus(retirement);
  const transfers = sumMoney(
    input.transfers.map((transfer) => convert(transfer.monthlyAmount, transfer.currency)),
  );
  const unallocated = income.minus(expenses).minus(contributions);

  const accountTotals: AccountFlowTotals[] = input.pockets.map((pocket) => {
    const residual = pocketAvailable.get(pocket.id) ?? new Decimal(0);
    return {
      pocketId: pocket.id,
      label: pocket.name,
      inflow: serializeMoney(pocketInflow.get(pocket.id) ?? 0),
      outflow: serializeMoney(pocketOutflow.get(pocket.id) ?? 0),
      residual: serializeMoney(residual),
      fullyAllocated: !outsideTolerance(residual),
    };
  });

  return {
    reportingCurrency: input.reportingCurrency,
    nodes: [...nodes.values()],
    links,
    warnings,
    accountTotals,
    totals: {
      income: serializeMoney(income),
      expenses: serializeMoney(expenses),
      expenseProvisions: serializeMoney(expenseProvisions),
      contributions: serializeMoney(contributions),
      savings: serializeMoney(savings),
      investments: serializeMoney(investments),
      retirement: serializeMoney(retirement),
      transfers: serializeMoney(transfers),
      unallocated: serializeMoney(unallocated),
      oneTimeIncome: serializeMoney(input.oneTimeIncomeTotal ?? 0),
      oneTimeUses: serializeMoney(input.oneTimeUseTotal ?? 0),
    },
    reconciled:
      warnings.every((warning) => warning.code === "unallocated_pocket_funds") &&
      // A small negative residual within ±tolerance is rounding noise, not an
      // over-allocation. The budget balances at the whole-dollar, not cent, level.
      unallocated.greaterThanOrEqualTo(TOLERANCE.negated()),
  };
}

function incomeNodeId(id: string) {
  return `income:${id}`;
}

function pocketNodeId(id: string) {
  return `pocket:${id}`;
}

function categoryNodeId(id: string) {
  return `category:${id}`;
}

function itemNodeId(id: string) {
  return `item:${id}`;
}
