import { Download, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { TierAssignForm } from "@/components/create-forms";
import { DatabaseResetForm, HouseholdMembershipForm, PasswordResetForm, PlatformBackupButton, UserManagementForm } from "@/components/platform-admin-forms";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { requireAuthenticatedSession } from "@/lib/auth/context";
import { AuditLogControls } from "@/components/audit-log-controls";
import { buildAuditWhere, dayBound, paginationMeta, parseAuditQuery } from "@/lib/platform/audit-query";
import { prisma } from "@/lib/db/prisma";
import { s3BackupStatus } from "@/lib/platform/s3-backup";

export const dynamic = "force-dynamic";

interface AdminUserRow {
  id: string;
  email: string;
  active: boolean;
  instanceAdmin: boolean;
  failedLoginCount: number;
  lockedUntil: Date | null;
}

// Module-scope helper (not a component) so the current-time read stays out of
// render and the lock status is computed once per request.
function toManagedUsers(users: AdminUserRow[]) {
  const nowMs = Date.now();
  return users.map((user) => ({
    id: user.id,
    email: user.email,
    active: user.active,
    instanceAdmin: user.instanceAdmin,
    failedLoginCount: user.failedLoginCount,
    locked: user.lockedUntil != null && user.lockedUntil.getTime() > nowMs,
    lockedUntil: user.lockedUntil ? user.lockedUntil.toISOString() : null,
  }));
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  let session;
  try {
    session = await requireAuthenticatedSession();
  } catch {
    redirect("/signin");
  }
  if (!session.instanceAdmin) {
    return <div className="mx-auto max-w-app space-y-6">
      <PageHeader description="Instance-level controls are restricted to platform administrators." title="Platform settings" />
      <Card className="p-5"><Badge tone="locked">Administrator access required</Badge><p className="mt-3 text-sm text-subdued">Your account does not have instance-administrator access.</p></Card>
    </div>;
  }
  const auditQuery = parseAuditQuery(await searchParams);
  const auditWhere = buildAuditWhere({
    action: auditQuery.action,
    resourceType: auditQuery.resourceType,
    fromDate: dayBound(auditQuery.from, "start"),
    toDate: dayBound(auditQuery.to, "end"),
  });
  const [households, users, auditTotal, auditActionRows, auditResourceRows] = await Promise.all([
    prisma.household.findMany({ where: { active: true }, include: { entitlement: true, members: { where: { active: true }, select: { id: true, role: true, user: { select: { id: true, email: true } } }, orderBy: { createdAt: "asc" } } }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ select: { id: true, email: true, active: true, instanceAdmin: true, failedLoginCount: true, lockedUntil: true, createdAt: true }, orderBy: { email: "asc" } }),
    prisma.auditEvent.count({ where: auditWhere }),
    prisma.auditEvent.findMany({ distinct: ["action"], select: { action: true }, orderBy: { action: "asc" } }),
    prisma.auditEvent.findMany({ distinct: ["resourceType"], select: { resourceType: true }, orderBy: { resourceType: "asc" } }),
  ]);
  const auditPageMeta = paginationMeta(auditTotal, auditQuery.page, auditQuery.size);
  const auditEvents = await prisma.auditEvent.findMany({
    where: auditWhere,
    orderBy: { createdAt: "desc" },
    skip: auditPageMeta.skip,
    take: auditPageMeta.size,
  });
  const s3 = s3BackupStatus();
  return (
    <div className="mx-auto max-w-app space-y-6">
      <PageHeader
        description="User management, platform backups, audit logs, tier assignment, and destructive maintenance."
        eyebrow="Platform"
        title="Platform settings"
      />
      <Card className="flex items-center gap-3 border-status-warning/30 bg-status-warning/5 px-4 py-3 text-sm text-subdued">
        <ShieldCheck className="size-4 shrink-0 text-status-warning" />
        All controls on this page require server-verified instance-administrator access.
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <UserManagementForm users={toManagedUsers(users)} />
        <Card className="p-5">
          <h2 className="font-semibold">S3-compatible platform backups</h2>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-subdued">Status</dt><dd className="mt-1"><Badge tone={s3.configured ? "success" : "warning"}>{s3.configured ? "Configured" : "Not configured"}</Badge></dd></div>
            <div><dt className="text-subdued">Bucket</dt><dd className="mt-1">{s3.bucket}</dd></div>
            <div><dt className="text-subdued">Region</dt><dd className="mt-1">{s3.region}</dd></div>
            <div><dt className="text-subdued">Endpoint</dt><dd className="mt-1 truncate">{s3.endpoint}</dd></div>
            <div><dt className="text-subdued">Encryption request</dt><dd className="mt-1">{s3.serverSideEncryption}</dd></div>
          </dl>
          <div className="mt-5"><PlatformBackupButton configured={s3.configured} /></div>
        </Card>
        <TierAssignForm households={households.map(({ id, name }) => ({ id, name }))} />
        <DatabaseResetForm />
      </div>
      <HouseholdMembershipForm
        households={households.map((household) => ({
          id: household.id,
          name: household.name,
          members: household.members.map((member) => ({ userId: member.user.id, email: member.user.email, role: member.role.toLowerCase() })),
        }))}
        users={users.map((user) => ({ id: user.id, email: user.email }))}
      />
      <PasswordResetForm users={users.map((user) => ({ id: user.id, email: user.email, instanceAdmin: user.instanceAdmin }))} />
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
      <Card id="audit">
        <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
          <h2 className="font-semibold">Audit events</h2>
          <Link className="inline-flex min-h-10 items-center gap-2 rounded border bg-muted px-4 text-sm font-semibold" href="/api/admin/audit-export"><Download className="size-4" /> Export CSV</Link>
        </div>
        <AuditLogControls
          actions={auditActionRows.map((row) => row.action)}
          resourceTypes={auditResourceRows.map((row) => row.resourceType)}
          current={{
            action: auditQuery.action,
            resourceType: auditQuery.resourceType,
            from: auditQuery.from,
            to: auditQuery.to,
            size: auditPageMeta.size,
            page: auditPageMeta.page,
            totalPages: auditPageMeta.totalPages,
            total: auditPageMeta.total,
            hasPrev: auditPageMeta.hasPrev,
            hasNext: auditPageMeta.hasNext,
          }}
        />
        <DataTable
          caption="Platform audit events"
          headers={["Time", "Action", "Resource", "User", "Household"]}
          rows={auditEvents.map((event) => [
            event.createdAt.toISOString(),
            event.action,
            `${event.resourceType}${event.resourceId ? ` · ${event.resourceId}` : ""}`,
            event.userId ?? "System",
            event.householdId ?? "Platform",
          ])}
        />
      </Card>
    </div>
  );
}
