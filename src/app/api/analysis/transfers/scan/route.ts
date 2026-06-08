import type { Prisma } from "@prisma/client";

import { json, readJson, routeError } from "@/lib/api/route";
import { toDbConfidence } from "@/lib/analysis/db-mapping";
import { transferScanSchema } from "@/lib/analysis/schemas";
import { findTransferCandidates } from "@/lib/analysis/transfer-match-engine";
import type { TransferCandidateRow } from "@/lib/analysis/transfer-match";
import { writeAuditEvent } from "@/lib/audit/write";
import { requireAuthenticatedContext } from "@/lib/auth/context";
import { requestIp } from "@/lib/auth/request";
import { prisma } from "@/lib/db/prisma";

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function POST(request: Request) {
  try {
    const context = await requireAuthenticatedContext("analysis.write");
    const input = await readJson(request, transferScanSchema);

    const confirmed = await prisma.transactionTransferMatch.findMany({
      where: { householdId: context.householdId, status: "CONFIRMED" },
      select: { debitTransactionId: true, creditTransactionId: true },
    });
    const excluded = new Set(confirmed.flatMap((match) => [match.debitTransactionId, match.creditTransactionId]));

    const transactions = await prisma.actualTransaction.findMany({
      where: {
        householdId: context.householdId,
        ignored: false,
        ...(excluded.size > 0 ? { id: { notIn: [...excluded] } } : {}),
      },
      take: 2000,
      select: {
        id: true,
        householdId: true,
        accountPocketId: true,
        bookingDate: true,
        amount: true,
        currency: true,
        reference: true,
        counterparty: true,
      },
    });

    const rows: TransferCandidateRow[] = transactions.map((transaction) => ({
      id: transaction.id,
      householdId: transaction.householdId,
      accountPocketId: transaction.accountPocketId ?? undefined,
      bookingDate: isoDate(transaction.bookingDate),
      amount: transaction.amount.toString(),
      currency: transaction.currency,
      reference: transaction.reference ?? undefined,
      counterparty: transaction.counterparty ?? undefined,
    }));

    const candidates = findTransferCandidates(rows, input.windowDays);
    const highConfidence = candidates.filter((candidate) => candidate.confidence === "high").length;

    const data: Prisma.TransactionTransferMatchCreateManyInput[] = candidates.map((candidate) => ({
      householdId: context.householdId,
      debitTransactionId: candidate.debitId,
      creditTransactionId: candidate.creditId,
      status: candidate.confidence === "high" ? "CONFIRMED" : "CANDIDATE",
      confidence: toDbConfidence(candidate.confidence),
      score: candidate.score,
      evidence: { reasons: candidate.evidence, fx: candidate.fx } as Prisma.InputJsonValue,
      confirmedByUserId: candidate.confidence === "high" ? context.userId : null,
      confirmedAt: candidate.confidence === "high" ? new Date() : null,
    }));

    const created = await prisma.$transaction(async (transaction) => {
      const result = await transaction.transactionTransferMatch.createMany({ data, skipDuplicates: true });
      await writeAuditEvent(transaction, {
        householdId: context.householdId,
        userId: context.userId,
        action: "transfer_match.scan",
        resourceType: "TransactionTransferMatch",
        metadata: { scanned: rows.length, proposed: candidates.length, created: result.count },
        ipAddress: requestIp(request),
      });
      return result.count;
    });

    return json({ scanned: rows.length, proposed: candidates.length, created, autoConfirmed: highConfidence });
  } catch (error) {
    return routeError(error);
  }
}
