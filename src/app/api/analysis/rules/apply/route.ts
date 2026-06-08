import { json, readJson, routeError } from "@/lib/api/route";
import { matchRule, type RuleLike, type TransactionLike } from "@/lib/analysis/rules";
import { applyRulesSchema } from "@/lib/analysis/schemas";
import { writeAuditEvent } from "@/lib/audit/write";
import { requireAuthenticatedContext } from "@/lib/auth/context";
import { requestIp } from "@/lib/auth/request";
import { prisma } from "@/lib/db/prisma";

export async function POST(request: Request) {
  try {
    const context = await requireAuthenticatedContext("analysis.write");
    await readJson(request, applyRulesSchema);

    const rules = await prisma.transactionAllocationRule.findMany({
      where: { householdId: context.householdId, active: true },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    });

    if (rules.length === 0) {
      return json({ scanned: 0, matched: 0 });
    }

    const candidates = await prisma.actualTransaction.findMany({
      where: {
        householdId: context.householdId,
        ignored: false,
        reviewState: "UNREVIEWED",
        allocations: { none: {} },
      },
      take: 2000,
    });

    const allocations: Array<{
      householdId: string;
      transactionId: string;
      categoryId: string;
      budgetItemId: string | null;
      amount: string;
      source: "RULE";
      confirmed: boolean;
    }> = [];
    const matchedIds: string[] = [];

    for (const candidate of candidates) {
      const transactionLike: TransactionLike = {
        description: candidate.description,
        counterparty: candidate.counterparty,
        reference: candidate.reference,
        normalizedMerchantKey: candidate.normalizedMerchantKey,
        sourceInstitution: candidate.sourceInstitution,
      };
      const rule = matchRule(transactionLike, rules as unknown as RuleLike[]);
      if (!rule) continue;
      allocations.push({
        householdId: context.householdId,
        transactionId: candidate.id,
        categoryId: rule.categoryId,
        budgetItemId: rule.budgetItemId,
        amount: candidate.amount.toString(),
        source: "RULE",
        confirmed: false,
      });
      matchedIds.push(candidate.id);
    }

    if (matchedIds.length === 0) {
      return json({ scanned: candidates.length, matched: 0 });
    }

    await prisma.$transaction(async (transaction) => {
      await transaction.actualTransactionAllocation.createMany({ data: allocations });
      await transaction.actualTransaction.updateMany({
        where: { id: { in: matchedIds }, householdId: context.householdId },
        data: { reviewState: "ALLOCATED" },
      });
      await writeAuditEvent(transaction, {
        householdId: context.householdId,
        userId: context.userId,
        action: "allocation_rule.apply",
        resourceType: "TransactionAllocationRule",
        metadata: { scanned: candidates.length, matched: matchedIds.length },
        ipAddress: requestIp(request),
      });
    });

    return json({ scanned: candidates.length, matched: matchedIds.length });
  } catch (error) {
    return routeError(error);
  }
}
