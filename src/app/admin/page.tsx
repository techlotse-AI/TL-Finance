import { ShieldCheck } from "lucide-react";

import { TierAssignForm } from "@/components/create-forms";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { ApiError } from "@/lib/api/errors";
import { requireAuthenticatedSession } from "@/lib/auth/context";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await requireAuthenticatedSession();
  if (!session.instanceAdmin) throw new ApiError(403, "forbidden", "Instance administrator access is required.");
  const households = await prisma.household.findMany({
    where: { active: true }, include: { entitlement: true }, orderBy: { name: "asc" },
  });
  return (
    <div className="mx-auto max-w-app space-y-6">
      <PageHeader
        description="Instance administration and manual household tier assignment."
        title="Administration"
      />
      <Card className="flex items-center gap-3 border-status-warning/30 bg-status-warning/5 px-4 py-3 text-sm text-subdued">
        <ShieldCheck className="size-4 shrink-0 text-status-warning" />
        The production route must require the server-side <code>admin.tiers.manage</code> capability.
      </Card>
      <TierAssignForm households={households.map(({ id, name }) => ({ id, name }))} />
      <Card>
        <DataTable
          caption="Household tier assignments"
          headers={["Household", "Base currency", "Tier", "Source", "Status"]}
          rows={households.map((household) => [
            household.name, household.baseCurrency,
            <Badge key={`${household.id}:tier`}>{household.entitlement?.tier.toLowerCase() ?? "budget"}</Badge>,
            household.entitlement?.source ?? "default",
            <Badge key={`${household.id}:status`} tone={household.entitlement?.active === false ? "danger" : "success"}>{household.entitlement?.active === false ? "Inactive" : "Active"}</Badge>,
          ])}
        />
      </Card>
    </div>
  );
}
