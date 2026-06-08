import type { PrismaClient } from "@prisma/client";
import { z } from "zod";

import { exportHousehold, householdImportSchema } from "@/lib/households/export";

export const userBackupSchema = z.object({
  format: z.literal("tl-finance-user-backup"),
  version: z.literal(1),
  exportedAt: z.string().datetime(),
  user: z.object({
    displayName: z.string().nullable(),
  }),
  households: z.array(householdImportSchema),
});

export async function exportUserBackup(client: PrismaClient, userId: string) {
  const [user, memberships] = await Promise.all([
    client.user.findUniqueOrThrow({
      where: { id: userId },
      select: { displayName: true },
    }),
    client.householdMember.findMany({
      where: { userId, active: true, household: { active: true } },
      select: { householdId: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const households = await Promise.all(
    memberships.map(({ householdId }) => exportHousehold(client, householdId)),
  );

  return {
    format: "tl-finance-user-backup" as const,
    version: 1 as const,
    exportedAt: new Date().toISOString(),
    user,
    households,
  };
}
