import { Prisma } from "@prisma/client";
import { cookies } from "next/headers";

import { apiErrorResponse, ApiError } from "@/lib/api/errors";
import { writeAuditEvent } from "@/lib/audit/write";
import { assertTrustedOrigin } from "@/lib/auth/origin";
import { hashPassword } from "@/lib/auth/password";
import { enforceRateLimit } from "@/lib/auth/rate-limit";
import { requestIp } from "@/lib/auth/request";
import { signUpSchema } from "@/lib/auth/schemas";
import {
  createSessionToken,
  hashSessionToken,
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
  sessionCookieOptions,
} from "@/lib/auth/session-token";
import { prisma } from "@/lib/db/prisma";

export async function POST(request: Request) {
  try {
    assertTrustedOrigin(request);
    const ipAddress = requestIp(request);
    enforceRateLimit(`signup:${ipAddress ?? "unknown"}`, 5, 15 * 60 * 1000);
    const input = signUpSchema.parse(await request.json());
    const passwordHash = await hashPassword(input.password);
    const token = createSessionToken();

    const user = await prisma.$transaction(async (transaction) => {
      const createdUser = await transaction.user.create({
        data: {
          email: input.email,
          passwordHash,
          displayName: input.displayName,
          instanceAdmin:
            Boolean(process.env.INSTANCE_ADMIN_EMAIL) &&
            input.email === process.env.INSTANCE_ADMIN_EMAIL?.trim().toLowerCase(),
        },
        select: { id: true, email: true, displayName: true },
      });

      await transaction.session.create({
        data: {
          userId: createdUser.id,
          tokenHash: hashSessionToken(token),
          expiresAt: new Date(Date.now() + SESSION_TTL_SECONDS * 1000),
        },
      });

      await writeAuditEvent(transaction, {
        userId: createdUser.id,
        action: "auth.signup",
        resourceType: "User",
        resourceId: createdUser.id,
        ipAddress,
      });

      return createdUser;
    });

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, token, sessionCookieOptions);
    return Response.json({ user }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return apiErrorResponse(new ApiError(409, "email_unavailable", "Email is unavailable."));
    }

    return apiErrorResponse(error);
  }
}
