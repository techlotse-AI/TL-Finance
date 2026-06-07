import { redirect } from "next/navigation";

import { requireAuthenticatedContext, requireAuthenticatedSession } from "@/lib/auth/context";

export async function requirePageContext() {
  let session;
  try {
    session = await requireAuthenticatedSession();
  } catch {
    redirect("/signin");
  }
  if (!session.activeHouseholdId) redirect("/onboarding");
  try {
    return await requireAuthenticatedContext("budget.read");
  } catch {
    redirect("/signin");
  }
}
