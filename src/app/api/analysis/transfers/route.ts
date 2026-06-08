import { json, routeError } from "@/lib/api/route";
import { requireAuthenticatedContext } from "@/lib/auth/context";
import { prisma } from "@/lib/db/prisma";

const legSelect = {
  select: {
    id: true,
    description: true,
    amount: true,
    currency: true,
    bookingDate: true,
    accountPocket: { include: { account: { select: { name: true } } } },
  },
} as const;

export async function GET(request: Request) {
  try {
    const context = await requireAuthenticatedContext("analysis.read");
    const url = new URL(request.url);
    const status = url.searchParams.get("status");

    const matches = await prisma.transactionTransferMatch.findMany({
      where: {
        householdId: context.householdId,
        ...(status ? { status: status.toUpperCase() as "CANDIDATE" | "CONFIRMED" | "REJECTED" } : {}),
      },
      orderBy: [{ confidence: "asc" }, { createdAt: "desc" }],
      take: 200,
      include: { debitTransaction: legSelect, creditTransaction: legSelect },
    });

    return json(matches);
  } catch (error) {
    return routeError(error);
  }
}
