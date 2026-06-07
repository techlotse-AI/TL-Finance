import { cookies } from "next/headers";

import { apiErrorResponse } from "@/lib/api/errors";
import { writeAuditEvent } from "@/lib/audit/write";
import { assertTrustedOrigin } from "@/lib/auth/origin";
import { requestIp } from "@/lib/auth/request";
import { hashSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session-token";
import { prisma } from "@/lib/db/prisma";

export async function POST(request: Request) {
  try {
    assertTrustedOrigin(request);
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (token) {
      const session = await prisma.session.findUnique({
        where: { tokenHash: hashSessionToken(token) },
        select: { id: true, userId: true },
      });

      if (session) {
        await prisma.$transaction(async (transaction) => {
          await transaction.session.update({
            where: { id: session.id },
            data: { revokedAt: new Date() },
          });
          await writeAuditEvent(transaction, {
            userId: session.userId,
            action: "auth.signout",
            resourceType: "Session",
            resourceId: session.id,
            ipAddress: requestIp(request),
          });
        });
      }
    }

    cookieStore.delete(SESSION_COOKIE_NAME);
    return new Response(null, { status: 204 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
