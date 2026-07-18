import { Download, Users } from "lucide-react";
import Link from "next/link";

import { ExchangeRateCreateForm, HouseholdImportForm, MemberAddForm } from "@/components/create-forms";
import { SessionManagement } from "@/components/account-security";
import { HouseholdSwitcher } from "@/components/household-switcher";
import { TotpSettings } from "@/components/totp-settings";
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
  const [household, members, memberships, sessions, me] = await Promise.all([
    prisma.household.findUniqueOrThrow({ where: { id: context.householdId }, include: { entitlement: true } }),
    prisma.householdMember.findMany({ where: { householdId: context.householdId }, include: { user: { select: { email: true, displayName: true } } }, orderBy: { createdAt: "asc" } }),
    prisma.householdMember.findMany({ where: { userId: context.userId, active: true, household: { active: true } }, select: { household: { select: { id: true, name: true } } }, orderBy: { household: { name: "asc" } } }),
    prisma.session.findMany({ where: { userId: context.userId, revokedAt: null, expiresAt: { gt: new Date() } }, select: { id: true, createdAt: true, expiresAt: true }, orderBy: { createdAt: "desc" } }),
    prisma.user.findUniqueOrThrow({ where: { id: context.userId }, select: { totpActivatedAt: true } }),
  ]);
  return (
    <div className="mx-auto max-w-app space-y-6">
      <PageHeader
        description="Household profile, membership, tier, and data portability. Budget categories moved to their own page."
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
          <Link className="mt-4 inline-block text-sm font-medium text-brand-teal hover:underline" href="/categories">
            Manage budget categories →
          </Link>
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
      <TotpSettings initialEnabled={Boolean(me.totpActivatedAt)} />
      <SessionManagement sessions={sessions.map((session) => ({ ...session, createdAt: session.createdAt.toISOString(), expiresAt: session.expiresAt.toISOString(), current: session.id === context.sessionId }))} />
      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <MemberAddForm />
        <ExchangeRateCreateForm baseCurrency={household.baseCurrency} />
        <HouseholdImportForm />
        <UserBackupImportForm />
        <ExchangeRateRefreshButton />
      </div>
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
