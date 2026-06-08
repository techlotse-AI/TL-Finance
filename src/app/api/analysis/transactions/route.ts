import { json, routeError } from "@/lib/api/route";
import { requireAuthenticatedContext } from "@/lib/auth/context";
import { prisma } from "@/lib/db/prisma";
import type { Prisma, TransactionReviewState } from "@prisma/client";

const STATE_FILTERS: Record<string, Prisma.ActualTransactionWhereInput> = {
  review: { reviewState: { in: ["UNREVIEWED", "PARTIAL"] }, ignored: false },
  allocated: { reviewState: "ALLOCATED" },
  ignored: { ignored: true },
  all: {},
};

export async function GET(request: Request) {
  try {
    const context = await requireAuthenticatedContext("analysis.read");
    const url = new URL(request.url);
    const state = url.searchParams.get("state") ?? "review";
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? "100"), 1), 200);
    const pocketId = url.searchParams.get("pocketId");

    const where: Prisma.ActualTransactionWhereInput = {
      householdId: context.householdId,
      ...(STATE_FILTERS[state] ?? STATE_FILTERS.review),
      ...(pocketId ? { accountPocketId: pocketId } : {}),
    };

    const transactions = await prisma.actualTransaction.findMany({
      where,
      orderBy: [{ bookingDate: "desc" }, { id: "desc" }],
      take: limit,
      include: {
        accountPocket: { include: { account: { select: { name: true } } } },
        allocations: {
          include: {
            category: { select: { name: true } },
            budgetItem: { select: { name: true } },
          },
        },
      },
    });

    const counts = await prisma.actualTransaction.groupBy({
      by: ["reviewState"],
      where: { householdId: context.householdId, ignored: false },
      _count: { _all: true },
    });
    const byState: Partial<Record<TransactionReviewState, number>> = {};
    for (const row of counts) byState[row.reviewState] = row._count._all;

    return json({ transactions, counts: byState });
  } catch (error) {
    return routeError(error);
  }
}
