import { json, routeError } from "@/lib/api/route";
import { requireAuthenticatedSession } from "@/lib/auth/context";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
    const session = await requireAuthenticatedSession();
    const sessions = await prisma.session.findMany({
      where: { userId: session.userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      select: { id: true, createdAt: true, expiresAt: true, activeHouseholdId: true },
    });
    return json({ currentSessionId: session.sessionId, sessions });
  } catch (error) {
    return routeError(error);
  }
}
