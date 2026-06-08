import { describe, expect, it } from "vitest";

import { computeAdherence } from "@/lib/analysis/adherence";
import { computeFindings, type FindingTransaction } from "@/lib/analysis/findings";

describe("computeAdherence", () => {
  const planned = [
    { categoryId: "groceries", categoryName: "Groceries", kind: "EXPENSE", currency: "CHF", monthlyPlanned: "600.0000", essential: true },
    { categoryId: "dining", categoryName: "Dining", kind: "EXPENSE", currency: "CHF", monthlyPlanned: "200.0000", essential: false },
  ];

  it("flags over and under spending and totals per currency", () => {
    const { rows, totals } = computeAdherence(planned, [
      { categoryId: "groceries", currency: "CHF", amount: "-720.0000" },
      { categoryId: "dining", currency: "CHF", amount: "-90.0000" },
    ]);
    const groceries = rows.find((row) => row.categoryId === "groceries");
    const dining = rows.find((row) => row.categoryId === "dining");
    expect(groceries?.status).toBe("over");
    expect(groceries?.variance).toBe("-120.0000");
    expect(dining?.status).toBe("under");
    expect(totals).toEqual([{ currency: "CHF", planned: "800.0000", actual: "810.0000" }]);
  });

  it("marks unplanned spending as no_plan", () => {
    const { rows } = computeAdherence([], [{ categoryId: "fees", currency: "CHF", amount: "-15.0000" }]);
    expect(rows[0].status).toBe("no_plan");
    expect(rows[0].usedPercent).toBeNull();
  });
});

describe("computeFindings", () => {
  function tx(partial: Partial<FindingTransaction> & { id: string; bookingDate: string; amount: string }): FindingTransaction {
    return {
      currency: "CHF",
      description: "Charge",
      merchantKey: "merchant",
      allocatedToBudgetItem: false,
      isTransfer: false,
      reviewState: "ALLOCATED",
      ...partial,
    };
  }

  it("detects duplicates, subscriptions, over-budget, and backlog", () => {
    const adherence = computeAdherence(
      [{ categoryId: "groceries", categoryName: "Groceries", kind: "EXPENSE", currency: "CHF", monthlyPlanned: "100.0000", essential: true }],
      [{ categoryId: "groceries", currency: "CHF", amount: "-200.0000" }],
    ).rows;

    const findings = computeFindings(
      [
        tx({ id: "d1", bookingDate: "2026-05-01", amount: "-9.9000", description: "Cloud", merchantKey: "cloud" }),
        tx({ id: "d2", bookingDate: "2026-05-02", amount: "-9.9000", description: "Cloud", merchantKey: "cloud" }),
        tx({ id: "s1", bookingDate: "2026-03-10", amount: "-19.9000", description: "Netflix", merchantKey: "netflix" }),
        tx({ id: "s2", bookingDate: "2026-04-10", amount: "-19.9000", description: "Netflix", merchantKey: "netflix" }),
        tx({ id: "s3", bookingDate: "2026-05-10", amount: "-21.9000", description: "Netflix", merchantKey: "netflix" }),
        tx({ id: "r1", bookingDate: "2026-05-12", amount: "-50.0000", description: "Unknown", reviewState: "UNREVIEWED" }),
      ],
      adherence,
    );

    const codes = findings.map((finding) => finding.code);
    expect(codes).toContain("duplicate_charge");
    expect(codes).toContain("subscription_increase");
    expect(codes).toContain("over_budget");
    expect(codes).toContain("review_backlog");
    // high severity sorts first
    expect(findings[0].severity).toBe("high");
  });

  it("ignores transfers as spending", () => {
    const findings = computeFindings(
      [
        tx({ id: "t1", bookingDate: "2026-05-01", amount: "-1000.0000", isTransfer: true, merchantKey: "savings" }),
        tx({ id: "t2", bookingDate: "2026-05-01", amount: "-1000.0000", isTransfer: true, merchantKey: "savings" }),
      ],
      [],
    );
    expect(findings.find((finding) => finding.code === "duplicate_charge")).toBeUndefined();
  });
});
