import { ApiError } from "@/lib/api/errors";
import { json, readJson, routeError } from "@/lib/api/route";
import { writeAuditEvent } from "@/lib/audit/write";
import { requireAuthenticatedSession } from "@/lib/auth/context";
import { verifyPassword } from "@/lib/auth/password";
import { requestIp } from "@/lib/auth/request";
import { prisma } from "@/lib/db/prisma";
import { databaseResetSchema } from "@/lib/platform/schemas";

export async function POST(request: Request) {
  try {
    const session = await requireAuthenticatedSession();
    if (!session.instanceAdmin) throw new ApiError(403, "forbidden", "Instance administrator access is required.");
    const input = await readJson(request, databaseResetSchema);
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: session.userId },
      select: { passwordHash: true },
    });
    if (!(await verifyPassword(input.password, user.passwordHash))) {
      throw new ApiError(401, "invalid_credentials", "Password confirmation failed.");
    }
    await prisma.$transaction(async (transaction) => {
      await transaction.session.updateMany({ data: { activeHouseholdId: null } });
      await transaction.transactionTransferMatch.deleteMany();
      await transaction.actualTransactionAllocation.deleteMany();
      await transaction.transactionAllocationRule.deleteMany();
      await transaction.actualTransaction.deleteMany();
      await transaction.statementImport.deleteMany();
      await transaction.budgetItem.deleteMany();
      await transaction.plannedAccountTransfer.deleteMany();
      await transaction.incomeAllocation.deleteMany();
      await transaction.incomeSource.deleteMany();
      await transaction.exchangeRate.deleteMany();
      await transaction.accountPocket.deleteMany();
      await transaction.account.deleteMany();
      await transaction.category.deleteMany();
      await transaction.categoryGroup.deleteMany();
      await transaction.tierEntitlement.deleteMany();
      await transaction.auditEvent.deleteMany();
      await transaction.householdMember.deleteMany();
      await transaction.household.deleteMany();
      await transaction.emailVerificationToken.deleteMany();
      await transaction.passwordResetToken.deleteMany();
      await transaction.session.deleteMany({ where: { id: { not: session.sessionId } } });
      await transaction.user.deleteMany({ where: { id: { not: session.userId } } });
      await writeAuditEvent(transaction, {
        userId: session.userId,
        action: "platform.database.reset",
        resourceType: "Platform",
        metadata: { preservedAdministratorUserId: session.userId },
        ipAddress: requestIp(request),
      });
    }, { timeout: 120_000 });
    return json({ reset: true });
  } catch (error) {
    return routeError(error);
  }
}
