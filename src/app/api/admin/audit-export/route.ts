import { ApiError } from "@/lib/api/errors";
import { writeAuditEvent } from "@/lib/audit/write";
import { requireAuthenticatedSession } from "@/lib/auth/context";
import { requestIp } from "@/lib/auth/request";
import { prisma } from "@/lib/db/prisma";

export async function GET(request: Request) {
  try {
    const session = await requireAuthenticatedSession();
    if (!session.instanceAdmin) throw new ApiError(403, "forbidden", "Instance administrator access is required.");
    const events = await prisma.auditEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 50_000,
    });
    await writeAuditEvent(prisma, {
      userId: session.userId,
      action: "platform.audit.export",
      resourceType: "AuditEvent",
      metadata: { exportedEventCount: events.length },
      ipAddress: requestIp(request),
    });
    const rows = [
      ["createdAt", "action", "resourceType", "resourceId", "userId", "householdId", "ipHash", "metadata"],
      ...events.map((event) => [
        event.createdAt.toISOString(),
        event.action,
        event.resourceType,
        event.resourceId ?? "",
        event.userId ?? "",
        event.householdId ?? "",
        event.ipHash ?? "",
        event.metadata ? JSON.stringify(event.metadata) : "",
      ]),
    ];
    return new Response(rows.map((row) => row.map(csvCell).join(",")).join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="tl-finance-audit-log.csv"',
      },
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return Response.json({ error: { code: error.code, message: error.message } }, { status: error.status });
    }
    return Response.json({ error: { code: "internal_error", message: "The request could not be completed." } }, { status: 500 });
  }
}

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}
