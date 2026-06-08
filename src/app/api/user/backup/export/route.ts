import { json, routeError } from "@/lib/api/route";
import { writeAuditEvent } from "@/lib/audit/write";
import { requireAuthenticatedSession } from "@/lib/auth/context";
import { requestIp } from "@/lib/auth/request";
import { exportUserBackup } from "@/lib/backups/user-backup";
import { prisma } from "@/lib/db/prisma";

export async function GET(request: Request) {
  try {
    const session = await requireAuthenticatedSession();
    const backup = await exportUserBackup(prisma, session.userId);
    await writeAuditEvent(prisma, {
      userId: session.userId,
      action: "user_backup.export",
      resourceType: "User",
      resourceId: session.userId,
      metadata: { householdCount: backup.households.length },
      ipAddress: requestIp(request),
    });
    return json(backup, {
      headers: { "Content-Disposition": 'attachment; filename="tl-finance-user-backup.json"' },
    });
  } catch (error) {
    return routeError(error);
  }
}
