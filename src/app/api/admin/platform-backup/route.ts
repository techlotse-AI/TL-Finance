import { json, routeError } from "@/lib/api/route";
import { writeAuditEvent } from "@/lib/audit/write";
import { requireAuthenticatedSession } from "@/lib/auth/context";
import { requestIp } from "@/lib/auth/request";
import { prisma } from "@/lib/db/prisma";
import { exportPlatformBackup } from "@/lib/platform/backup";
import { uploadPlatformBackup } from "@/lib/platform/s3-backup";
import { ApiError } from "@/lib/api/errors";

export async function POST(request: Request) {
  try {
    const session = await requireAuthenticatedSession();
    if (!session.instanceAdmin) throw new ApiError(403, "forbidden", "Instance administrator access is required.");
    const snapshot = await prisma.$transaction(
      (transaction) => exportPlatformBackup(transaction),
      { isolationLevel: "Serializable", timeout: 120_000 },
    );
    const result = await uploadPlatformBackup(snapshot);
    await writeAuditEvent(prisma, {
      userId: session.userId,
      action: "platform.backup.upload",
      resourceType: "PlatformBackup",
      resourceId: result.key,
      metadata: { bucket: result.bucket, bytes: result.bytes },
      ipAddress: requestIp(request),
    });
    return json(result, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
