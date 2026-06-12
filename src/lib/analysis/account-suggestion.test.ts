import { describe, expect, it } from "vitest";

import { buildAccountSuggestion } from "@/lib/analysis/account-suggestion";

const account = {
  id: "account-1",
  name: "UBS Checking",
  maskedReference: "••••••••2957",
  pockets: [
    { id: "chf-pocket", currency: "CHF" },
    { id: "eur-pocket", currency: "EUR" },
  ],
};

describe("statement account suggestions", () => {
  it("suggests the only matching account and unambiguous currency route", () => {
    expect(buildAccountSuggestion([account], ["CHF"])).toEqual({
      accountId: "account-1",
      accountName: "UBS Checking",
      maskedReference: "••••••••2957",
      accountPocketId: "chf-pocket",
      currency: "CHF",
    });
  });

  it("does not suggest an account when the masked reference is ambiguous", () => {
    expect(buildAccountSuggestion([account, { ...account, id: "account-2" }], ["CHF"])).toBeNull();
  });

  it("suggests only the account when the statement has multiple matching currencies", () => {
    expect(buildAccountSuggestion([account], ["CHF", "EUR"])).toMatchObject({
      accountId: "account-1",
      accountPocketId: null,
      currency: null,
    });
  });
});
