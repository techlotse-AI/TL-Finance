import { describe, expect, it } from "vitest";

import { computeAdherence } from "@/lib/analysis/adherence";
import { computeFindings, type FindingTransaction } from "@/lib/analysis/findings";
import { matchRule, type RuleLike, type TransactionLike } from "@/lib/analysis/rules";
import { findTransferCandidates } from "@/lib/analysis/transfer-match-engine";
import type { TransferCandidateRow } from "@/lib/analysis/transfer-match";
import { ensureParsersRegistered } from "@/lib/statements/parsers";
import { buildStatementRecords } from "@/lib/statements/commit";
import { previewStatement } from "@/lib/statements/preview";

ensureParsersRegistered();

const CHECKING = `Trade date;Booking date;Value date;Currency;Debit;Credit;Balance;Description1;Description2;Description3
01.05.2026;01.05.2026;01.05.2026;CHF;;6000.00;9000.00;Salary;Employer AG;May payroll
03.05.2026;03.05.2026;03.05.2026;CHF;54.00;;6946.00;Coop;Coop Zug;Groceries
05.05.2026;05.05.2026;05.05.2026;CHF;54.00;;6892.00;Coop;Coop Zug;Groceries
15.05.2026;15.05.2026;15.05.2026;CHF;2000.00;;4892.00;Transfer to savings;UBS Savings;Standing order
`;

const SAVINGS = `Trade date;Booking date;Value date;Currency;Debit;Credit;Balance;Description1;Description2;Description3
15.05.2026;15.05.2026;15.05.2026;CHF;;2000.00;12000.00;Transfer from checking;UBS Checking;Standing order
`;

function bytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

describe("import stack end-to-end", () => {
  it("parses, commits, allocates, matches transfers, and surfaces findings", async () => {
    // 1. Parse + build commit records for two accounts.
    const checkingPreview = await previewStatement({ filename: "chk.csv", content: bytes(CHECKING) });
    const savingsPreview = await previewStatement({ filename: "sav.csv", content: bytes(SAVINGS) });
    expect(checkingPreview.parserKey).toBe("ubs-account");

    const checkingRecords = buildStatementRecords(checkingPreview, {
      householdId: "h1",
      statementImportId: "imp-chk",
      accountPocketId: "chk",
    }).records;
    const savingsRecords = buildStatementRecords(savingsPreview, {
      householdId: "h1",
      statementImportId: "imp-sav",
      accountPocketId: "sav",
    }).records;
    expect(checkingRecords).toHaveLength(4);

    // Simulate committed rows with ids (DB would assign these).
    const committed = [...checkingRecords, ...savingsRecords].map((record, index) => ({
      id: `t${index}`,
      ...record,
    }));

    // 2. Apply an allocation rule: merchant contains "coop" -> Groceries.
    const rule: RuleLike = {
      id: "r1",
      matchField: "MERCHANT",
      matchType: "CONTAINS",
      normalizedPattern: "coop",
      institution: null,
      categoryId: "groceries",
      budgetItemId: null,
      priority: 100,
    };
    const allocations: Array<{ categoryId: string; currency: string; amount: string }> = [];
    for (const row of committed) {
      const like: TransactionLike = {
        description: row.description,
        counterparty: row.counterparty ?? null,
        reference: row.reference ?? null,
        normalizedMerchantKey: row.normalizedMerchantKey ?? null,
        sourceInstitution: String(row.sourceInstitution),
      };
      const matched = matchRule(like, [rule]);
      if (matched) allocations.push({ categoryId: matched.categoryId, currency: row.currency, amount: String(row.amount) });
    }
    expect(allocations).toHaveLength(2); // both Coop rows

    // 3. Transfer matching across the two accounts.
    const candidateRows: TransferCandidateRow[] = committed.map((row) => ({
      id: row.id,
      householdId: "h1",
      accountPocketId: row.accountPocketId ?? undefined,
      bookingDate: (row.bookingDate as Date).toISOString().slice(0, 10),
      amount: String(row.amount),
      currency: row.currency,
      reference: row.reference ?? undefined,
      counterparty: row.counterparty ?? undefined,
    }));
    const transfers = findTransferCandidates(candidateRows, 3);
    expect(transfers).toHaveLength(1);
    const transferIds = new Set([transfers[0].debitId, transfers[0].creditId]);

    // 4. Adherence: planned Groceries 80 CHF vs actual 108 CHF -> over budget.
    const adherence = computeAdherence(
      [{ categoryId: "groceries", categoryName: "Groceries", kind: "EXPENSE", currency: "CHF", monthlyPlanned: "80.0000", essential: true }],
      allocations,
    );
    const groceries = adherence.rows.find((r) => r.categoryId === "groceries");
    expect(groceries?.actual).toBe("108.0000");
    expect(groceries?.status).toBe("over");

    // 5. Findings: duplicate Coop charge present; the transfer is excluded.
    const findingTransactions: FindingTransaction[] = committed.map((row) => ({
      id: row.id,
      bookingDate: (row.bookingDate as Date).toISOString().slice(0, 10),
      amount: String(row.amount),
      currency: row.currency,
      description: row.description,
      merchantKey: row.normalizedMerchantKey ?? null,
      allocatedToBudgetItem: false,
      isTransfer: transferIds.has(row.id),
      reviewState: "ALLOCATED",
    }));
    const findings = computeFindings(findingTransactions, adherence.rows);
    const codes = findings.map((f) => f.code);
    expect(codes).toContain("duplicate_charge");
    expect(codes).toContain("over_budget");

    // The matched transfer legs must not be treated as spending.
    const duplicate = findings.find((f) => f.code === "duplicate_charge");
    expect(duplicate?.transactionIds?.some((id) => transferIds.has(id))).toBe(false);
  });
});
