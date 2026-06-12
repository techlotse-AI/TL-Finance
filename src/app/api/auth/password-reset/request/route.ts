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
    await enforceRateLimit(`reset-request:${ipAddress ?? "unknown"}:${input.email}`, 5, 60 * 60 * 1000);
    const user = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true, email: true, active: true } });
    if (user?.active) {
      const token = createOneTimeToken();
      await prisma.$transaction(async (transaction) => {
        await transaction.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });
        await transaction.passwordResetToken.create({
          data: { userId: user.id, tokenHash: hashOneTimeToken(token), expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
        });
        await writeAuditEvent(transaction, { userId: user.id, action: "auth.password_reset.request", resourceType: "User", resourceId: user.id, ipAddress });
      });
      try {
        await sendAccountMail({
          to: user.email,
          subject: "Reset your TL Finance password",
          text: `Reset your password: ${publicAppUrl(`/reset-password/${token}`)}\n\nThis link expires in one hour.`,
        });
      } catch {
        console.error("Password-reset email delivery failed.");
      }
    }
    return json({ accepted: true });
  } catch (error) {
    return routeError(error);
  }
}
