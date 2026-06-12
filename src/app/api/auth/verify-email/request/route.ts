import { json, readJson, routeError } from "@/lib/api/route";
import { writeAuditEvent } from "@/lib/audit/write";
import { enforceRateLimit } from "@/lib/auth/rate-limit";
import { requestIp } from "@/lib/auth/request";
import { accountEmailRequestSchema } from "@/lib/auth/schemas";
import { createOneTimeToken, hashOneTimeToken, publicAppUrl } from "@/lib/auth/tokens";
import { prisma } from "@/lib/db/prisma";
import { sendAccountMail } from "@/lib/mail/smtp";

export async function POST(request: Request) {
  try {
    const ipAddress = requestIp(request);
    const input = await readJson(request, accountEmailRequestSchema);
    await enforceRateLimit(`verify-request:${ipAddress ?? "unknown"}:${input.email}`, 5, 60 * 60 * 1000);
    const user = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true, email: true, emailVerifiedAt: true, active: true } });
    if (user?.active && !user.emailVerifiedAt) {
      const token = createOneTimeToken();
      await prisma.$transaction(async (transaction) => {
        await transaction.emailVerificationToken.deleteMany({ where: { userId: user.id, usedAt: null } });
        await transaction.emailVerificationToken.create({
          data: { userId: user.id, tokenHash: hashOneTimeToken(token), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
        });
        await writeAuditEvent(transaction, { userId: user.id, action: "auth.email_verification.request", resourceType: "User", resourceId: user.id, ipAddress });
      });
      try {
        await sendAccountMail({
          to: user.email,
          subject: "Verify your TL Finance email",
          text: `Verify your email address: ${publicAppUrl(`/verify-email/${token}`)}\n\nThis link expires in 24 hours.`,
        });
      } catch {
        console.error("Email verification delivery failed.");
      }
    }
    return json({ accepted: true });
  } catch (error) {
    return routeError(error);
  }
}
