import { describe, expect, it } from "vitest";

import { focusMoneyFlowLinks } from "@/lib/budget/money-flow-focus";
import type { FlowLink } from "@/lib/budget/money-flow";

function link(id: string, source: string, target: string, currency = "CHF"): FlowLink {
  return {
    id,
    source,
    target,
    amount: "100",
    nativeAmount: "100",
    nativeCurrency: currency,
    description: id,
    internalTransfer: false,
    routeKind: "expense",
    colorKey: id,
  };
}

const links = [
  link("income-account", "income", "account"),
  link("account-housing", "account", "housing"),
  link("housing-rent", "housing", "rent"),
  link("account-food", "account", "food"),
  link("food-groceries", "food", "groceries"),
  link("eur-account", "eur-income", "account", "EUR"),
];

describe("focusMoneyFlowLinks", () => {
  it("shows the complete upstream and downstream path without unrelated sibling outflows", () => {
    expect(focusMoneyFlowLinks(links, ["housing"]).map((route) => route.id)).toEqual([
      "income-account",
      "account-housing",
      "housing-rent",
      "eur-account",
    ]);
  });

  it("applies currency before tracing the selected route", () => {
    expect(focusMoneyFlowLinks(links, ["housing"], "CHF").map((route) => route.id)).toEqual([
      "income-account",
      "account-housing",
      "housing-rent",
    ]);
  });

  it("intersects account and category focus instead of showing account siblings", () => {
    expect(focusMoneyFlowLinks(links, ["account", "housing"]).map((route) => route.id)).toEqual([
      "income-account",
      "account-housing",
      "housing-rent",
      "eur-account",
    ]);
  });
});
