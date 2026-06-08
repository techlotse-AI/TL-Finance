import { json, readJson, routeError } from "@/lib/api/route";
import { writeAuditEvent } from "@/lib/audit/write";
import { requireAuthenticatedSession } from "@/lib/auth/context";
import { requestIp } from "@/lib/auth/request";
import { userBackupSchema } from "@/lib/backups/user-backup";
import { prisma } from "@/lib/db/prisma";
import { importHousehold } from "@/lib/households/import";

export async function POST(request: Request) {
  try {
    const session = await requireAuthenticatedSession();
    const input = await readJson(request, userBackupSchema);
    const imported = await prisma.$transaction(async (transaction) => {
      const householdIds: string[] = [];
      await transaction.user.update({
        where: { id: session.userId },
        data: { displayName: input.user.displayName },
      });
      await writeAuditEvent(transaction, {
        userId: session.userId,
        action: "user_backup.profile.import",
        resourceType: "User",
        resourceId: session.userId,
        ipAddress: requestIp(request),
      });
      for (const householdBackup of input.households) {
        const household = await importHousehold(transaction, session.userId, householdBackup);
        householdIds.push(household.id);
        await writeAuditEvent(transaction, {
          householdId: household.id,
          userId: session.userId,
          action: "user_backup.import",
          resourceType: "Household",
          resourceId: household.id,
          ipAddress: requestIp(request),
        });
      }
      if (householdIds.length > 0) {
        await transaction.session.update({
          where: { id: session.sessionId },
          data: { activeHouseholdId: householdIds[householdIds.length - 1] },
        });
      }
      return householdIds;
    }, { timeout: 120_000 });
    return json({ importedHouseholdIds: imported }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
