import { ApiError } from "@/lib/api/errors";
import { json, routeError } from "@/lib/api/route";
import { requireAuthenticatedSession } from "@/lib/auth/context";
import { prisma } from "@/lib/db/prisma";

/** Audit actions that constitute the security-event review surface. */
export const SECURITY_EVENT_ACTIONS = [
  "auth.signin",
  "auth.signin.failed",
  "auth.signin.locked",
  "auth.account.locked",
  "auth.account.unlocked",
  "auth.signout",
  "auth.password_reset.request",
  "auth.password_reset.complete",
  "auth.totp.enroll_started",
  "auth.totp.enabled",
  "auth.totp.disabled",
  "auth.totp.failed",
  "auth.totp.recovery_used",
  "auth.totp.admin_reset",
  "auth.new_device",
  "platform.user.update",
] as const;

export async function GET(request: Request) {
  try {
    const session = await requireAuthenticatedSession();
    if (!session.instanceAdmin) {
      throw new ApiError(403, "forbidden", "Instance administrator access is required.");
    }
    const url = new URL(request.url);
    const requested = Number.parseInt(url.searchParams.get("take") ?? "100", 10);
    const take = Math.min(Math.max(Number.isFinite(requested) ? requested : 100, 1), 500);

    const events = await prisma.auditEvent.findMany({
      where: { action: { in: [...SECURITY_EVENT_ACTIONS] } },
      orderBy: { createdAt: "desc" },
      take,
      select: {
        id: true,
        action: true,
        userId: true,
        resourceType: true,
        resourceId: true,
        ipHash: true,
        metadata: true,
        createdAt: true,
      },
    });
    return json({ events });
  } catch (error) {
    return routeError(error);
  }
}
