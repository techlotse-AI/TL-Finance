import { Prisma } from "@prisma/client";
import { cookies } from "next/headers";

import { apiErrorResponse, ApiError } from "@/lib/api/errors";
import { writeAuditEvent } from "@/lib/audit/write";
import { shouldAssignInstanceAdmin } from "@/lib/auth/admin-bootstrap";
import { assertTrustedOrigin } from "@/lib/auth/origin";
import { hashPassword } from "@/lib/auth/password";
import { enforceRateLimit } from "@/lib/auth/rate-limit";
import { requestIp } from "@/lib/auth/request";
import { signUpSchema } from "@/lib/auth/schemas";
import { createOneTimeToken, hashOneTimeToken, publicAppUrl } from "@/lib/auth/tokens";
import {
  createSessionToken,
  hashSessionToken,
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
  sessionCookieOptions,
} from "@/lib/auth/session-token";
import { prisma } from "@/lib/db/prisma";
import { mailConfigured, sendAccountMail } from "@/lib/mail/smtp";

export async function POST(request: Request) {
  try {
    assertTrustedOrigin(request);
    const ipAddress = requestIp(request);
    await enforceRateLimit(`signup:${ipAddress ?? "unknown"}`, 5, 15 * 60 * 1000);
    const input = signUpSchema.parse(await request.json());
    const verificationRequired = process.env.EMAIL_VERIFICATION_REQUIRED === "true";
    if (verificationRequired && !mailConfigured()) {
      throw new ApiError(503, "mail_not_configured", "Email verification is required but mail delivery is not configured.");
    }
    const passwordHash = await hashPassword(input.password);
    const token = createSessionToken();
    const verificationToken = createOneTimeToken();

    const user = await prisma.$transaction(async (transaction) => {
      const instanceAdmin = await shouldAssignInstanceAdmin({
        email: input.email,
        countUsers: () => transaction.user.count(),
      });
      const createdUser = await transaction.user.create({
        data: {
          email: input.email,
          passwordHash,
          displayName: input.displayName,
          emailVerifiedAt: verificationRequired ? null : new Date(),
          instanceAdmin,
        },
        select: { id: true, email: true, displayName: true },
      });

      if (verificationRequired) {
        await transaction.emailVerificationToken.create({
          data: {
            userId: createdUser.id,
            tokenHash: hashOneTimeToken(verificationToken),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        });
      } else {
        await transaction.session.create({
          data: {
            userId: createdUser.id,
            tokenHash: hashSessionToken(token),
            expiresAt: new Date(Date.now() + SESSION_TTL_SECONDS * 1000),
          },
        });
      }

      await writeAuditEvent(transaction, {
        userId: createdUser.id,
        action: "auth.signup",
        resourceType: "User",
        resourceId: createdUser.id,
        ipAddress,
      });

      return createdUser;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    let verificationDelivered = true;
    if (verificationRequired) {
      try {
        await sendAccountMail({
          to: user.email,
          subject: "Verify your TL Finance email",
          text: `Verify your email address: ${publicAppUrl(`/verify-email/${verificationToken}`)}\n\nThis link expires in 24 hours.`,
        });
      } catch {
        verificationDelivered = false;
        console.error("Email verification delivery failed after signup.");
      }
    } else {
      const cookieStore = await cookies();
      cookieStore.set(SESSION_COOKIE_NAME, token, sessionCookieOptions);
    }
    return Response.json({ user, verificationRequired, verificationDelivered }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return apiErrorResponse(new ApiError(409, "email_unavailable", "Email is unavailable."));
    }

    return apiErrorResponse(error);
  }
}
