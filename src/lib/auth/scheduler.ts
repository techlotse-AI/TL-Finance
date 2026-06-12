import { timingSafeEqual } from "node:crypto";

import { ApiError } from "@/lib/api/errors";

export function assertSchedulerAuthorization(request: Request): void {
  const expected = process.env.SCHEDULED_BACKUP_TOKEN;
  const provided = request.headers.get("x-tl-finance-backup-token");
  if (!expected || expected.length < 32 || !provided) {
    throw new ApiError(401, "scheduler_unauthorized", "Scheduler authorization failed.");
  }
  const expectedBytes = Buffer.from(expected);
  const providedBytes = Buffer.from(provided);
  if (expectedBytes.length !== providedBytes.length || !timingSafeEqual(expectedBytes, providedBytes)) {
    throw new ApiError(401, "scheduler_unauthorized", "Scheduler authorization failed.");
  }
}
