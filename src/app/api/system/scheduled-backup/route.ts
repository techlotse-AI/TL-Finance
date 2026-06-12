import { json, routeError } from "@/lib/api/route";
import { writeAuditEvent } from "@/lib/audit/write";
import { assertSchedulerAuthorization } from "@/lib/auth/scheduler";
import { prisma } from "@/lib/db/prisma";
import { exportPlatformBackup } from "@/lib/platform/backup";
import { uploadPlatformBackup } from "@/lib/platform/s3-backup";

export async function POST(request: Request) {
  try {
    assertSchedulerAuthorization(request);
    const snapshot = await prisma.$transaction(
      (transaction) => exportPlatformBackup(transaction),
      { isolationLevel: "Serializable", timeout: 120_000 },
    );
    const result = await uploadPlatformBackup(snapshot);
    await writeAuditEvent(prisma, {
      action: "platform.backup.scheduled",
      resourceType: "PlatformBackup",
      resourceId: result.key,
      metadata: { bucket: result.bucket, bytes: result.bytes },
    });
    return json(result, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
