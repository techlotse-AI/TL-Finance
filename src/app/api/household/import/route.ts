import { json, readJson, routeError } from "@/lib/api/route";
import { writeAuditEvent } from "@/lib/audit/write";
import { requireAuthenticatedSession } from "@/lib/auth/context";
import { requestIp } from "@/lib/auth/request";
import { prisma } from "@/lib/db/prisma";
import { householdImportSchema } from "@/lib/households/export";
import { importHousehold } from "@/lib/households/import";

export async function POST(request: Request) {
  try {
    const session = await requireAuthenticatedSession();
    const input = await readJson(request, householdImportSchema);
    const household = await prisma.$transaction(async (transaction) => {
      const created = await importHousehold(transaction, session.userId, input);
      await transaction.session.update({ where: { id: session.sessionId }, data: { activeHouseholdId: created.id } });
      await writeAuditEvent(transaction, {
        householdId: created.id, userId: session.userId, action: "household.import",
        resourceType: "Household", resourceId: created.id, ipAddress: requestIp(request),
      });
      return created;
    }, { timeout: 30_000 });
    return json({ household }, { status: 201 });
  } catch (error) { return routeError(error); }
}
