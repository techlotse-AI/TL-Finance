import { describe, expect, it } from "vitest";

import { groupSpendingAccounts } from "@/lib/budget/money-flow-layout";

// Minimal shape compatible with the layout's internal node array.
function acct(id: string, spending = false) {
  return { id, label: id, kind: "account" as const, spending, visualId: id, rank: 1, x: 0, y: 0, width: 0, height: 0, stableOrder: 0, value: 0 };
}

describe("groupSpendingAccounts", () => {
  it("moves spending accounts together to the bottom, preserving relative order", () => {
    const column = [acct("a"), acct("spend1", true), acct("b"), acct("spend2", true)];
    groupSpendingAccounts([column]);
    expect(column.map((n) => n.id)).toEqual(["a", "b", "spend1", "spend2"]);
  });

  it("leaves columns without spending accounts untouched", () => {
    const column = [acct("a"), acct("b")];
    groupSpendingAccounts([column]);
    expect(column.map((n) => n.id)).toEqual(["a", "b"]);
  });

  it("ignores non-account columns", () => {
    const income = [{ id: "i", label: "i", kind: "income" as const, spending: true, visualId: "i", rank: 0, x: 0, y: 0, width: 0, height: 0, stableOrder: 0, value: 0 }];
    groupSpendingAccounts([income]);
    expect(income.map((n) => n.id)).toEqual(["i"]);
  });
});
