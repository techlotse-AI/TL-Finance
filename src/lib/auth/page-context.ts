import { redirect } from "next/navigation";

import { ensureActiveHousehold } from "@/lib/auth/active-household";
import { requireAuthenticatedContext, requireAuthenticatedSession } from "@/lib/auth/context";

export async function requirePageContext() {
  let session;
  try {
    session = await requireAuthenticatedSession();
  } catch {
    redirect("/signin");
  }
  // A freshly signed-in or older session may have no active household even though
  // the user belongs to one. Resolve and persist a default before deciding to
  // onboard; only send users with no household at all to onboarding.
  const activeHouseholdId = await ensureActiveHousehold(
    session.sessionId,
    session.userId,
    session.activeHouseholdId,
  );
  if (!activeHouseholdId) redirect("/onboarding");
  try {
    return await requireAuthenticatedContext("budget.read");
  } catch {
    redirect("/signin");
  }
}
