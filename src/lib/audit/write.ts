import type { Prisma, PrismaClient } from "@prisma/client";

import { hashIpAddress } from "@/lib/audit/ip-hash";

interface WriteAuditEventInput {
  householdId?: string;
  userId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string | null;
}

type AuditClient = Pick<PrismaClient, "auditEvent">;

export function writeAuditEvent(client: AuditClient, input: WriteAuditEventInput) {
  return client.auditEvent.create({
    data: {
      householdId: input.householdId,
      userId: input.userId,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      metadata: input.metadata,
      ipHash: hashIpAddress(input.ipAddress ?? null),
    },
  });
}
