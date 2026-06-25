import { Download, ListTree, Users } from "lucide-react";
import Link from "next/link";

import { CategoryCreateForm, ExchangeRateCreateForm, HouseholdImportForm, MemberAddForm } from "@/components/create-forms";
import { CategoryActions } from "@/components/category-actions";
import { SessionManagement } from "@/components/account-security";
import { HouseholdSwitcher } from "@/components/household-switcher";
import { ExchangeRateRefreshButton, UserBackupImportForm } from "@/components/settings-actions";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { requirePageContext } from "@/lib/auth/page-context";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const context = await requirePageContext();
  const [household, groups, categories, members, memberships, sessions] = await Promise.all([
    prisma.household.findUniqueOrThrow({ where: { id: context.householdId }, include: { entitlement: true } }),
    prisma.categoryGroup.findMany({ where: { householdId: context.householdId, deletedAt: null }, select: { id: true, name: true }, orderBy: { sortOrder: "asc" } }),
    prisma.category.findMany({
      where: { householdId: context.householdId, deletedAt: null },
      select: {
        id: true, name: true, kind: true, essential: true, groupId: true,
        group: { select: { name: true } },
        budgetItems: { where: { deletedAt: null }, select: { id: true }, take: 1 },
        incomeSources: { where: { deletedAt: null }, select: { id: true }, take: 1 },
      },
      orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.householdMember.findMany({ where: { householdId: context.householdId }, include: { user: { select: { email: true, displayName: true } } }, orderBy: { createdAt: "asc" } }),
    prisma.householdMember.findMany({ where: { userId: context.userId, active: true, household: { active: true } }, select: { household: { select: { id: true, name: true } } }, orderBy: { household: { name: "asc" } } }),
    prisma.session.findMany({ where: { userId: context.userId, revokedAt: null, expiresAt: { gt: new Date() } }, select: { id: true, createdAt: true, expiresAt: true }, orderBy: { createdAt: "desc" } }),
  ]);
  return (
    <div className="mx-auto max-w-app space-y-6">
      <PageHeader
        description="Household profile, categories, membership, tier, and data portability."
        title="Settings"
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="font-semibold">Household</h2>
          <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div><dt className="text-subdued">Name</dt><dd className="mt-1">{household.name}</dd></div>
            <div><dt className="text-subdued">Base currency</dt><dd className="mt-1">{household.baseCurrency}</dd></div>
            <div><dt className="text-subdued">Country profile</dt><dd className="mt-1">{household.countryProfile}</dd></div>
            <div><dt className="text-subdued">Tier</dt><dd className="mt-1"><Badge>{household.entitlement?.tier.toLowerCase() ?? "budget"}</Badge></dd></div>
          </dl>
        </Card>
        <Card className="p-5">
          <h2 className="font-semibold">User backup</h2>
          <p className="mt-2 text-sm text-subdued">Export the current live Budget plan and reporting rates for every household you can access. Import restores each backup household as a separate household you own.</p>
          <Link className="mt-5 inline-flex min-h-10 items-center gap-2 rounded border bg-muted px-4 text-sm font-semibold" href="/api/household/export">
            <Download className="size-4" /> Export active household
          </Link>
          <Link className="ml-3 mt-5 inline-flex min-h-10 items-center gap-2 rounded border bg-muted px-4 text-sm font-semibold" href="/api/user/backup/export">
            <Download className="size-4" /> Export user backup
          </Link>
        </Card>
      </div>
      <HouseholdSwitcher activeHouseholdId={context.householdId} households={memberships.map((membership) => membership.household)} />
      <SessionManagement sessions={sessions.map((session) => ({ ...session, createdAt: session.createdAt.toISOString(), expiresAt: session.expiresAt.toISOString(), current: session.id === context.sessionId }))} />
      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <CategoryCreateForm groups={groups} />
        <MemberAddForm />
        <ExchangeRateCreateForm baseCurrency={household.baseCurrency} />
        <HouseholdImportForm />
        <UserBackupImportForm />
        <ExchangeRateRefreshButton />
      </div>
      <Card>
        <div className="flex items-center gap-3 border-b px-5 py-4">
          <ListTree className="size-4 text-brand-teal" />
          <h2 className="font-semibold">Categories</h2>
        </div>
        <DataTable
          caption="Budget categories"
          headers={["Category", "Kind", "Group", "Essential", "Actions"]}
          rows={categories.map((category) => [
            category.name,
            category.kind.toLowerCase(),
            category.group?.name ?? "—",
            category.essential ? <Badge key={`${category.id}:ess`} tone="success">Essential</Badge> : "—",
            <CategoryActions
              key={`${category.id}:actions`}
              groups={groups}
              category={{
                id: category.id,
                name: category.name,
                kind: category.kind.toLowerCase(),
                essential: category.essential,
                groupId: category.groupId,
                inUse: category.budgetItems.length > 0 || category.incomeSources.length > 0,
              }}
            />,
          ])}
        />
      </Card>
      <Card>
        <div className="flex items-center gap-3 border-b px-5 py-4">
          <Users className="size-4 text-brand-teal" />
          <h2 className="font-semibold">Members</h2>
        </div>
        <DataTable
          caption="Household members"
          headers={["Member", "Role", "Status"]}
          rows={members.map((member) => [
            member.user.displayName ?? member.user.email, member.role.toLowerCase(),
            <Badge key={member.id} tone={member.active ? "success" : "neutral"}>{member.active ? "Active" : "Inactive"}</Badge>,
          ])}
        />
      </Card>
    </div>
  );
}
